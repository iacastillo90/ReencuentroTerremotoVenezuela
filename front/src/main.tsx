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
import { ToastProvider } from './store/ToastContext.tsx';

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
  <>
    <style>{`
      .fallback-ui {
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; min-height: 100vh; padding: 2rem;
        background: var(--clr-bg); color: var(--clr-text);
        font-family: 'Inter', system-ui, sans-serif; text-align: center;
        gap: 1rem;
      }
      .fallback-ui__icon { font-size: 3rem; }
      .fallback-ui__title { font-size: 1.5rem; font-weight: 700; margin: 0; }
      .fallback-ui__text {
        color: var(--clr-text-muted); max-width: 400px;
        line-height: 1.5; margin: 0;
      }
      .fallback-ui__btn {
        margin-top: 0.5rem; padding: 0.75rem 2rem; border-radius: 8px;
        border: none; background: var(--clr-primary); color: #fff;
        font-weight: 700; font-size: 0.95rem; cursor: pointer;
        font-family: inherit;
      }
    `}</style>
    <div className="fallback-ui">
      <div className="fallback-ui__icon">{'⚠️'}</div>
      <h1 className="fallback-ui__title">Algo salió mal</h1>
      <p className="fallback-ui__text">
        Ocurrió un error inesperado. El equipo ya fue notificado. Intenta recargar la página.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="fallback-ui__btn"
      >
        Recargar página
      </button>
    </div>
  </>
);

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={FALLBACK_UI}>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <AuthProvider>
          <SocketProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </SocketProvider>
        </AuthProvider>
      </GoogleOAuthProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
