import * as Sentry from '@sentry/node';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { personRouter } from './routes/person.route';
import { webhooksRouter } from './routes/webhooks.route';
import { adminRouter } from './routes/admin.route';
import { disastersRouter } from './routes/disasters.route';
import { mediaRouter } from './routes/media.route';
import { authRouter } from './routes/auth.route';
import { partnerRouter } from './routes/partner.route';
import { localizadoRouter } from './routes/localizado.route';
import { contactRouter } from './routes/contact.route';
import { cneRouter } from './routes/cne.route';
import { searchRouter } from './routes/search.route';
import { matchesRouter } from './routes/matches.route';
import { requireAdminApiKey } from './middlewares/auth.middleware';
import { csrfProtection } from './middlewares/csrf.middleware';
import { auditLog } from './middlewares/audit.middleware';
import { errorHandler } from './middlewares/error.middleware';
import { buildAllowedOrigins, isOriginAllowed } from './utils/cors.util';
import { logger } from './utils/logger.util';
import { bullBoardRouter } from './services/bull-board.service';
import { connection as redis } from './config/redis.config';

const app = express();

// Trust reverse proxy (necesario en Render para rate limiting y cookies 'secure')
app.set('trust proxy', 1);

// --- 1. Seguridad HTTP con Helmet + CSP ---
const isDev = process.env.NODE_ENV !== 'production';
const frameAncestors = ["'self'"];
if (isDev) frameAncestors.push('http://localhost:5173');

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    reportOnly: !isDev,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: isDev ? ["'self'", "'unsafe-inline'"] : ["'self'"],
      styleSrc: isDev ? ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'] : ["'self'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://*.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      frameAncestors,
      baseUri: ["'self'"],
      formAction: ["'self'"],
      reportUri: '/api/csp-report',
    },
  },
  crossOriginEmbedderPolicy: isDev ? false : true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// --- 2. CORS restringido ---
// Allowlist normalizada UNA vez al arranque. Coincidencia exacta del origin
// (esquema incluido): cada origin de producción debe listarse explícitamente
// en CORS_ORIGINS — sin substrings ni equivalencia http/https, que permitían
// bypass (https://localhost:5173.evil.com) o downgrade con credenciales.
const corsOrigins = buildAllowedOrigins(
  process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4000'
);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origen (ej. curl, postman)
    if (!origin) return callback(null, true);

    if (isOriginAllowed(origin, corsOrigins)) {
      return callback(null, true);
    }

    logger.error({ origin, allowedOrigins: [...corsOrigins] }, '[CORS] Origin rejected');
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-partner-api-key', 'x-csrf-token', 'sentry-trace', 'baggage'],
}));

// --- 3. Logging de peticiones HTTP (Morgan) ---
const morganFormat = process.env.MORGAN_FORMAT || (process.env.NODE_ENV === 'production' ? 'combined' : 'dev');
app.use(morgan(morganFormat, { skip: () => process.env.NODE_ENV === 'test' }));

// --- 4. Protección contra ataques de denegación de servicio (Rate Limiting Global) ---
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: Number(process.env.GLOBAL_RATE_LIMIT) || 500, // Configurable, por defecto 500
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Por favor, intente más tarde.' }
});
app.use(globalLimiter);

// --- 5. Compression (gzip/brotli) ---
app.use(compression());

// --- 6. Cookie parser (needed for CSRF) ---
app.use(cookieParser());

// --- 6. CSRF Protection ---
app.use(csrfProtection);

// --- 7. Body Parsers y Prevención de Contaminación de Parámetros ---
app.use(express.json({ limit: '1mb' }));
app.use(hpp());

// --- 8. Rutas de la Aplicación ---
app.use('/api/persons', personRouter);
app.use('/api/webhooks', webhooksRouter);
// Panel de monitoreo de colas BullMQ (debe ir ANTES del adminRouter genérico)
// Nota: middleware que elimina X-Frame-Options solo para esta ruta (necesario para iframe desde frontend)
app.use('/api/admin/queues', (_req, res, next) => {
  res.removeHeader('X-Frame-Options');
  next();
}, requireAdminApiKey, bullBoardRouter);
// Ruta administrativa protegida
app.use('/api/admin', requireAdminApiKey, adminRouter);
app.use('/api/disasters', disastersRouter);
app.use('/api/media', mediaRouter);
app.use('/api/auth', authRouter);
app.use('/api/partners', partnerRouter);
app.use('/api/localizados', localizadoRouter);
app.use('/api/contacts', contactRouter);
app.use('/api/cne', cneRouter);
app.use('/api/search', searchRouter);
app.use('/api/matches', matchesRouter);

app.get('/health', async (req, res) => {
  const checks: Record<string, string> = {};

  checks.mongodb = mongoose.connection.readyState === 1 ? 'ok' : 'disconnected';
  checks.redis = redis.status === 'ready' ? 'ok' : redis.status;

  const allOk = Object.values(checks).every(v => v === 'ok');

  res.status(allOk ? 200 : 503).json({ status: allOk ? 'ok' : 'degraded', checks });
});

// Sentry verification endpoint (intentional error)
app.get('/debug-sentry', (req, res) => {
  throw new Error('My first Sentry error!');
});

// --- 9. Sentry Error Handler (debe ir antes del nuestro) ---
Sentry.setupExpressErrorHandler(app);

// --- 10. Error handling middleware (must be last) ---
app.use(errorHandler);

export default app;
