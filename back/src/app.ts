import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
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
import { requireAdminApiKey } from './middlewares/auth.middleware';
import { csrfProtection } from './middlewares/csrf.middleware';

const app = express();

// --- 1. Seguridad HTTP con Helmet + CSP ---
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    reportOnly: process.env.CSP_ENFORCE !== 'true',
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://*.googleapis.com'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      reportUri: '/api/csp-report',
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// --- 2. CORS restringido ---
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4000')
  .split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-partner-api-key', 'x-csrf-token'],
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

// --- 5. Cookie parser (needed for CSRF) ---
app.use(cookieParser());

// --- 6. CSRF Protection ---
app.use(csrfProtection);

// --- 7. Body Parsers y Prevención de Contaminación de Parámetros ---
app.use(express.json({ limit: '1mb' }));
app.use(hpp());

// --- 8. Rutas de la Aplicación ---
app.use('/api/persons', personRouter);
app.use('/api/webhooks', webhooksRouter);
// Ruta administrativa protegida
app.use('/api/admin', requireAdminApiKey, adminRouter);
app.use('/api/disasters', disastersRouter);
app.use('/api/media', mediaRouter);
app.use('/api/auth', authRouter);
app.use('/api/partners', partnerRouter);
app.use('/api/localizados', localizadoRouter);
app.use('/api/contacts', contactRouter);
app.use('/api/cne', cneRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

export default app;
