/**
 * ═══════════════════════════════════════════════════════════
 * main.tsx — Punto de entrada de la aplicación
 * 
 * PROPÓSITO:
 *   Monta el árbol de React en el DOM. Envuelve toda la app
 *   con los providers necesarios: autenticación (Google OAuth),
 *   estado de sesión (AuthContext) y websockets (SocketContext).
 * 
 * ORDEN DE PROVIDERS (importa):
 *   1. GoogleOAuthProvider → provee el SDK de Google Login
 *      (debe estar lo más afuera posible para que funcione
 *       en cualquier componente hijo).
 *   2. AuthProvider → contexto de sesión (usa el api de axios
 *      con CSRF automático, ver store/AuthContext.tsx).
 *   3. SocketProvider → conexión websocket para chat en
 *      tiempo real (depende de que AuthProvider ya exista
 *      para obtener el userId).
 * 
 * FLUJO:
 *   main.tsx → provee providers → App.tsx decide qué
 *   vista mostrar según el estado (ruteo por estado,
 *   no por URL — ver App.tsx para más detalle).
 * ═══════════════════════════════════════════════════════════
 */

// ─── React 19 y DOM ───────────────────────────────────────
// createRoot es la API moderna de React 18+. Reemplaza
// ReactDOM.render(). StrictMode activa advertencias en
// desarrollo (doble render, detección de efectos impuros).
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Estilos globales (CSS variables del tema oscuro, reset,
// tipografía Inter, utilidades). Ver index.css para los
// tokens de diseño.
import './index.css'

// Componente raíz que maneja el ruteo por estado.
// NO usa react-router — la navegación se controla con
// useState<View> en App.tsx.
import App from './App.tsx'

// ─── Providers externos ───────────────────────────────────
// GoogleOAuthProvider: inicializa el SDK de Google Login.
// Necesita el CLIENT_ID de las variables de entorno Vite.
// Si no está configurado, usa un dummy para no romper
// en desarrollo local.
import { GoogleOAuthProvider } from '@react-oauth/google';

// AuthProvider: contexto que mantiene el usuario logueado,
// su rol, y métodos login/logout/updateUser.
// Se apoya en axios (services/api.ts) para llamar a /auth/me.
import { AuthProvider } from './store/AuthContext.tsx';

// SocketProvider: conexión websocket para el chat.
// Escucha eventos como 'new_message' y expone sendMessage().
import { SocketProvider } from './store/SocketContext.tsx';

// ─── Variables de entorno ──────────────────────────────────
// VITE_GOOGLE_CLIENT_ID se define en .env (no subido al repo).
// Ver front/AGENTS.md para la lista completa de vars.
// El fallback 'dummy-client-id' evita un crash si alguien
// olvida configurarlo localmente.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id';

// ─── Mount ─────────────────────────────────────────────────
// Toma el nodo <div id="root"> del index.html (Vite lo genera).
// El operador ! (non-null assertion) es seguro porque
// Vite siempre incluye <div id="root"></div> en la plantilla.
createRoot(document.getElementById('root')!).render(
  // StrictMode: solo afecta desarrollo. Ayuda a detectar
  // efectos con limpieza faltante y componentes impuros.
  <StrictMode>
    {/* GoogleOAuthProvider envuelve TODO para que el hook
        useGoogleLogin() funcione en AuthModal y LoginPage. */}
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {/* AuthProvider provee useAuth() a toda la app.
          Al montarse, intenta restaurar la sesión llamando
          a /auth/me con la cookie HTTP-only que envió el backend. */}
      <AuthProvider>
        {/* SocketProvider necesita el userId de AuthContext
            para conectar el websocket a la sala correcta. */}
        <SocketProvider>
          {/* App es el componente raíz. Maneja 13 vistas
              distintas con un solo useState<View>. */}
          <App />
        </SocketProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
)
