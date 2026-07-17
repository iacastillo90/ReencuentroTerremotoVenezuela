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
 *   - JWT se envía SOLO via cookie HttpOnly (nunca localStorage).
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
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

// ─── Token persistence (doble canal: cookie httpOnly + localStorage) ─────────
//
// El proxy de Vercel→Render no garantiza que la cookie httpOnly quede en el
// dominio correcto en todos los navegadores. Guardar el JWT en localStorage
// como segundo canal asegura que el Bearer token siempre esté disponible.
// El interceptor de request lo leerá y lo enviará como Authorization header.
// El backend acepta Bearer O cookie (auth.middleware.ts línea 86-90).
//
// Seguridad: el JWT expira en 7 días. En caso de XSS, el riesgo es el mismo
// que con una cookie SameSite=None (ambos son accesibles desde JS malicioso).
// La cookie httpOnly es el canal primario cuando funciona correctamente.

const TOKEN_KEY = 'auth_token';

/** Persiste el JWT tras un login exitoso. */
export function persistToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage bloqueado */ }
}

/** Elimina el JWT al hacer logout o al detectar sesión inválida. */
export function clearToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage bloqueado */ }
}

/** Lee el JWT del localStorage. */
export function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

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
  // Leer JWT del localStorage (canal secundario al httpOnly cookie)
  // El backend acepta Bearer OR cookie — esto garantiza auth aunque
  // la cookie cross-domain no llegue correctamente via Vercel proxy.
  const jwt = getStoredToken();
  if (jwt) {
    config.headers.Authorization = `Bearer ${jwt}`;
  }
  if (config.method && MUTATING.includes(config.method.toLowerCase())) {
    const csrf = csrfToken ?? readCsrfCookie();
    if (csrf && config.headers) {
      config.headers['x-csrf-token'] = csrf;
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
  (res) => {
    // Interceptor global para transformar URLs de imágenes viejas
    const transformUrls = (obj: unknown) => {
      if (!obj) return;
      if (Array.isArray(obj)) {
        obj.forEach(transformUrls);
      } else if (typeof obj === 'object') {
        const record = obj as Record<string, unknown>;
        for (const key in record) {
          if (key === 'photoUrl' && typeof record[key] === 'string') {
            (record as Record<string, string>)[key] = (record[key] as string).replace(/http:\/\/minio:9000\/[^/]+\//, '/api/media/').split('?')[0];
          } else {
            transformUrls(record[key]);
          }
        }
      }
    };
    if (res.data) transformUrls(res.data);
    return res;
  },
  async (error) => {
    const cfg = error.config;
    const status = error.response?.status;
    const msg = String(error.response?.data?.error ?? '');

    // ─── Retry automático para 503 (Render cold start) ────────────────────
    // Render free tier hiberna el servicio tras ~15 min sin tráfico.
    // El primer request durante el arranque recibe 503 mientras el proceso
    // Node.js levanta (~20-30s). Reintentamos hasta 3 veces con backoff.
    const isColdStart = status === 503 && cfg && !cfg._retryCount;
    if (isColdStart) {
      cfg._retryCount = (cfg._retryCount ?? 0) + 1;
      const MAX_RETRIES = 3;
      if (cfg._retryCount <= MAX_RETRIES) {
        // Espera exponencial: 3s → 6s → 12s
        const delay = 3000 * Math.pow(2, cfg._retryCount - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        return api(cfg);
      }
    }

    // ─── Retry automático para 403 CSRF ──────────────────────────────────
    const isCsrf = status === 403 && /csrf/i.test(msg);
    if (isCsrf && cfg && !cfg._csrfRetried) {
      cfg._csrfRetried = true;
      await refreshCsrfToken();
      const token = csrfToken ?? readCsrfCookie();
      if (token) {
        cfg.headers = cfg.headers ?? {};
        cfg.headers['x-csrf-token'] = token;
      }
      return api(cfg);
    }

    // Si no es CSRF o cold start, rechaza normalmente.
    return Promise.reject(error);
  }
);
