/**
 * ═══════════════════════════════════════════════════════════
 * services/api.ts — Cliente HTTP (Axios + CSRF automático)
 * 
 * PROPÓSITO:
 *   Provee una instancia compartida de Axios configurada para
 *   comunicarse con el backend del proyecto. Todas las llamadas
 *   HTTP de la aplicación pasan por aquí.
 * 
 * CARACTERÍSTICAS:
 *   - withCredentials: true (envía cookies HTTP-only).
 *   - CSRF automático (doble envío: cookie + header).
 *   - Auto-recuperación: si el backend responde 403 CSRF,
 *     refresca el token y reintenta 1 vez.
 * 
 * CÓMO USARLO:
 *   import { api } from '../../services/api';
 *   const { data } = await api.get('/persons');
 * 
 * FLUJO CSRF:
 *   1. Al iniciar la app (AuthContext), se llama a
 *      refreshCsrfToken() que hace GET /auth/csrf-token.
 *      El backend setea la cookie csrf-token y devuelve
 *      el token en el body.
 *   2. Antes de cada POST/PUT/PATCH/DELETE, el interceptor
 *      de request lee el token de memoria (o de la cookie
 *      como fallback) y lo agrega como header x-csrf-token.
 *   3. Si el backend responde 403 con error CSRF, el
 *      interceptor de response refresca el token y reintenta.
 * 
 * SEGURIDAD:
 *   - El token CSRF nunca se expone al JavaScript de terceros.
 *   - La cookie csrf-token tiene HttpOnly=false (la necesita
 *     el frontend) pero SameSite=Strict y Secure en prod.
 *   - El backend valida que el header coincida con la cookie.
 * ═══════════════════════════════════════════════════════════
 */

// Axios es el cliente HTTP. No usamos fetch directo porque
// Axios maneja interceptores, transformación de JSON, y
// errores de red de forma más declarativa.
import axios from 'axios';

/**
 * Instancia compartida de Axios.
 * - baseURL: se configura con VITE_API_URL (variable de entorno).
 *   Por defecto apunta a localhost:4000/api para desarrollo.
 * - withCredentials: true → envía cookies HTTP-only en cada
 *   request (necesario para la cookie de sesión y CSRF).
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  withCredentials: true,
});

// ─── CSRF (patrón double-submit) ────────────────────────────────────────────

/**
 * Token CSRF mantenido en memoria como fuente de verdad del cliente.
 *
 * ¿Por qué no solo leer la cookie?
 *   La cookie csrf-token puede quedar desactualizada si el backend
 *   la rota (por tiempo o por evento de seguridad). Mantener el
 *   token en memoria nos da control explícito sobre cuándo refrescarlo.
 *
 * ¿Por qué no está en un estado de React?
 *   El token se necesita en los interceptores de Axios, que corren
 *   fuera del ciclo de vida de React. Una variable de módulo es
 *   más simple y no causa re-renders.
 */
let csrfToken: string | null = null;

/**
 * Métodos HTTP que mutan estado y requieren CSRF.
 * GET y HEAD son idempotentes y no necesitan protección.
 */
const MUTATING = ['post', 'put', 'patch', 'delete'];

/**
 * Lee el token CSRF de la cookie del navegador.
 * Fallback por si el token en memoria se perdió (ej: recarga
 * de página sin refrescar el token).
 */
function readCsrfCookie(): string | null {
  // Busca la cookie que empieza con 'csrf-token='
  const row = document.cookie.split('; ').find((r) => r.startsWith('csrf-token='));
  if (!row) return null;
  // decodeURIComponent porque el backend puede codificar caracteres especiales
  return row.split('=')[1] ? decodeURIComponent(row.split('=')[1]) : null;
}

/**
 * Pide un token CSRF fresco al backend.
 *
 * ¿Cuándo se llama?
 *   1. Al iniciar la app (desde AuthContext useEffect).
 *   2. Cuando un request recibe 403 CSRF (auto-recuperación).
 *
 * ¿Qué hace?
 *   - GET /auth/csrf-token → el backend setea la cookie y
 *     devuelve { token: '...' }.
 *   - Si la respuesta no tiene token (API antigua), lee la
 *     cookie como fallback.
 *   - Si todo falla (servidor caído), retorna null.
 *
 * Returns: el token CSRF o null si no se pudo obtener.
 */
export async function refreshCsrfToken(): Promise<string | null> {
  try {
    const { data } = await api.get('/auth/csrf-token');
    // Prioridad: body de la respuesta > cookie
    csrfToken = data?.token ?? readCsrfCookie();
  } catch {
    // Si el servidor no responde, intentamos leer la cookie
    // que podría haber quedado de una sesión anterior.
    csrfToken = readCsrfCookie();
  }
  return csrfToken;
}

// ─── Interceptor de request: adjunta header CSRF ──────────────────────────

/**
 * Antes de cada request:
 *   - Si el método muta estado (POST, PUT, PATCH, DELETE),
 *     agrega el header x-csrf-token.
 *   - El token se toma de memoria (csrfToken) o de la cookie
 *     como fallback.
 *
 * Esto asegura que TODOS los requests mutantes lleven CSRF,
 * sin que cada componente tenga que acordarse de hacerlo.
 */
api.interceptors.request.use((config) => {
  if (config.method && MUTATING.includes(config.method.toLowerCase())) {
    const token = csrfToken ?? readCsrfCookie();
    if (token && config.headers) {
      config.headers['x-csrf-token'] = token;
    }
  }
  return config;
});

// ─── Interceptor de response: auto-recuperación CSRF ─────────────────────

/**
 * Después de cada response:
 *   - Si es exitoso (2xx), lo deja pasar.
 *   - Si es 403 con mensaje CSRF:
 *       a) Refresca el token (refreshCsrfToken).
 *       b) Reintenta el request original UNA VEZ.
 *       c) Si vuelve a fallar, rechaza la promesa.
 *
 * _csrfRetried: bandera personalizada en la config de Axios
 * para evitar reintentos infinitos.
 */
api.interceptors.response.use(
  (res) => res, // Respuestas exitosas pasan sin cambios
  async (error) => {
    const cfg = error.config;
    const status = error.response?.status;
    const msg = String(error.response?.data?.error ?? '');
    const isCsrf = status === 403 && /csrf/i.test(msg);

    // Solo reintenta si:
    //   1. Es error 403 CSRF.
    //   2. Aún no hemos reintentado (_csrfRetried es false/undefined).
    //   3. Tenemos la config del request original (cfg existe).
    if (isCsrf && cfg && !cfg._csrfRetried) {
      cfg._csrfRetried = true; // Marca para no reintentar de nuevo

      // Refresca el token (vuelve a sembrar la cookie y actualiza memoria)
      await refreshCsrfToken();

      // Re-intenta con el token nuevo
      const token = csrfToken ?? readCsrfCookie();
      if (token) {
        cfg.headers = cfg.headers ?? {};
        cfg.headers['x-csrf-token'] = token;
      }

      // Ejecuta el request original nuevamente.
      // El usuario no nota nada — el reintento es transparente.
      return api(cfg);
    }

    // Si no es CSRF o ya se reintentó, rechaza normalmente.
    return Promise.reject(error);
  }
);
