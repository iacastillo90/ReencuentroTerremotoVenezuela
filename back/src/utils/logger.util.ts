/**
 * utils/logger.util.ts — Logger estructurado (Pino)
 *
 * PROPÓSITO:
 *   Configura Pino como logger estructurado para toda la aplicación.
 *   Provee logging por niveles, serialización de errores/requests,
 *   y redacción automática de datos sensibles (passwords, tokens).
 *
 * CARACTERÍSTICAS:
 *   - Nivel configurable: LOG_LEVEL env var (default: debug dev, info prod)
 *   - Transport: Pino/file con colores en desarrollo, JSON en producción
 *   - Serializers: Errores, requests y responses con formato Pino estándar
 *   - Redact: Autorización, cookies, passwords, tokens — censurado en logs
 *   - Timestamps ISO: Formato estándar ISO 8601 para correlación
 *
 * SEGURIDAD:
 *   - Redact automático: req.headers.authorization → [REDACTED]
 *   - Redact: cookies, body.password, body.token — nunca en logs planos
 *   - No Pino-pretty en producción (solo JSON stream a stdout)
 *   - Serializers estándar: Previenen fugas de datos en serialización
 *
 * DECISIONES TÉCNICAS:
 *   - Pino sobre Winston: Más rápido, menor overhead, mejor ecosistema
 *   - pino/file con colorize: Legible en dev, JSON en prod
 *   - redact paths: Específico, no genérico (no redacta todo el body)
 *   - isDev check: Diferente comportamiento sin depender de LOG_LEVEL
 *
 * NIVELES DE LOG (recomendados):
 *   - fatal: Error irrecuperable (exit inminente)
 *   - error: Error operacional (API externa falló, BD caída)
 *   - warn: Situación anómala (rate limit, auth fallido)
 *   - info: Evento de negocio (usuario creado, match encontrado)
 *   - debug: Información de desarrollo (no en producción)
 *
 * CÓMO USAR:
 *   logger.info({ userId }, 'Usuario registrado');
 *   logger.error({ err: error, body: redactedBody }, 'Error en registro');
 *   logger.fatal('JWT_SECRET no configurado — abortando');
 */
import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev ? {
    target: 'pino/file',
    options: { destination: 1, colorize: true },
  } : undefined,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.token', 'body.contactNumber', 'body.cedula', 'body.phone', 'error.config'],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
