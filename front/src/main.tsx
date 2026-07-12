/**
 * ═══════════════════════════════════════════════════════════
 * main.tsx — Punto de entrada de la aplicación
 * 
 * PROPÓSITO:
 *   Monta el árbol de React en el DOM con Sentry (monitoreo),
 *   ErrorBoundary, Google OAuth, sesión (AuthContext) y
 *   websockets (SocketContext).
 * 
 * SENTRY:
 *   Inicializado lo antes posible para capturar errores de
 *   renderizado, tracing de rendimiento y session replays.
 *   El ErrorBoundary de Sentry reemplaza el nuestro: reporta
 *   automáticamente el error a Sentry + muestra UI empática.
 * 
 * ORDEN DE PROVIDERS:
 *   1. Sentry.ErrorBoundary → captura + reporta errores.
 *   2. GoogleOAuthProvider → SDK de Google Login.
 *   3. AuthProvider → contexto de sesión.
 *   4. SocketProvider → websocket para chat.
 * ═══════════════════════════════════════════════════════════
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react';

import './index.css'
import App from './App.tsx'
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './store/AuthContext.tsx';
import { SocketProvider } from './store/SocketContext.tsx';

Sentry.init({
  dsn: "https://4dbc1ed175d31a1908263519ff64da80@o4511719339458560.ingest.us.sentry.io/4511719432650752",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  tracePropagationTargets: ["localhost", /^https:\/\/reencuentroterremotovenezuela\.onrender\.com\/api/],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
});

const FALLBACK_UI = (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '100vh', padding: '2rem',
    background: 'var(--clr-bg)', color: 'var(--clr-text)',
    fontFamily: "'Inter', system-ui, sans-serif", textAlign: 'center',
    gap: '1rem',
  }}>
    <div style={{ fontSize: '3rem' }}>{'⚠️'}</div>
    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Algo salió mal</h1>
    <p style={{ color: 'var(--clr-text-muted)', maxWidth: 400, lineHeight: 1.5, margin: 0 }}>
      Ocurrió un error inesperado. El equipo ya fue notificado. Intenta recargar la página.
    </p>
    <button
      onClick={() => window.location.reload()}
      style={{
        marginTop: '0.5rem', padding: '0.75rem 2rem', borderRadius: 8,
        border: 'none', background: 'var(--clr-primary)', color: '#fff',
        fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      Recargar página
    </button>
  </div>
);

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={FALLBACK_UI}>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <AuthProvider>
          <SocketProvider>
            <App />
          </SocketProvider>
        </AuthProvider>
      </GoogleOAuthProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
