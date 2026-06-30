import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import { personRouter } from './routes/person.route';
import { webhooksRouter } from './routes/webhooks.route';
import { adminRouter } from './routes/admin.route';
import { disastersRouter } from './routes/disasters.route';
import { mediaRouter } from './routes/media.route';
import { authRouter } from './routes/auth.route';
import { partnerRouter } from './routes/partner.route';
import { localizadoRouter } from './routes/localizado.route';
import { searchRequestRouter } from './routes/search-request.route';
import { contactRouter } from './routes/contact.route';
import { requireAdminOrVerifier } from './middlewares/auth.middleware';

const app = express();

// --- 1. Seguridad Básica HTTP ---
app.use(helmet()); // Protege contra vulnerabilidades web comunes configurando Headers HTTP

// --- 2. Protección contra ataques de denegación de servicio (Rate Limiting Global) ---
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite de 100 requests por IP por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Por favor, intente más tarde.' }
});
app.use(globalLimiter);

// --- 3. CORS restringido, Body Parsers y Prevención de Contaminación de Parámetros ---
// Lista blanca desde FRONTEND_URL (admite varios orígenes separados por coma) + orígenes de desarrollo.
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const devOrigins = ['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173'];
app.use(
  cors({
    origin(origin, callback) {
      // Permitir peticiones sin Origin (curl, apps móviles, health checks).
      if (!origin) return callback(null, true);
      if ([...allowedOrigins, ...devOrigins].includes(origin)) return callback(null, true);
      // En desarrollo, si no se configuró FRONTEND_URL, no bloquear (con aviso).
      if (process.env.NODE_ENV !== 'production' && allowedOrigins.length === 0) {
        return callback(null, true);
      }
      return callback(new Error(`Origin no permitido por CORS: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' })); // Limitar el peso de los payloads para prevenir ataques
app.use(hpp()); // Protege contra HTTP Parameter Pollution

// --- 4. Rutas de la Aplicación ---
app.use('/api/persons', personRouter);
app.use('/api/webhooks', webhooksRouter);
// Ruta administrativa protegida
app.use('/api/admin', requireAdminOrVerifier, adminRouter);
app.use('/api/disasters', disastersRouter);
app.use('/api/media', mediaRouter);
app.use('/api/auth', authRouter);
app.use('/api/partners', partnerRouter);
app.use('/api/localizados', localizadoRouter);
app.use('/api/search-requests', searchRequestRouter);
app.use('/api/contacts', contactRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

export default app;
