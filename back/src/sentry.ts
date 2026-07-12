import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import 'dotenv/config';
import { logger } from './utils/logger.util';

const SENTRY_DSN = process.env.SENTRY_DSN || '';

if ((process.env.NODE_ENV === 'production' || process.env.ENABLE_SENTRY === 'true') && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    environment: process.env.NODE_ENV || 'development',
  });
  logger.info('[Sentry] Initialized in backend');
} else {
  logger.info('[Sentry] Disabled (set ENABLE_SENTRY=true to test)');
}
