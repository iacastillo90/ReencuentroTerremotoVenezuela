import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import 'dotenv/config';

// The DSN provided by the user for the Node.js backend project
const SENTRY_DSN = process.env.SENTRY_DSN || 'https://d10e1c76943918eb513b0afc26ef11e3@o4511719339458560.ingest.us.sentry.io/4511720283242496';

if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SENTRY === 'true') {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      nodeProfilingIntegration(),
    ],
    // Tracing
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,
    environment: process.env.NODE_ENV || 'development',
  });
  console.log('[Sentry] Initialized in backend');
} else {
  console.log('[Sentry] Disabled in development (set ENABLE_SENTRY=true to test)');
}
