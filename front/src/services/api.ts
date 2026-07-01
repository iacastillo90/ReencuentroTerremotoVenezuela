import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  withCredentials: true,
});

// ── CSRF (patrón double-submit) ────────────────────────────────────────────
// Token CSRF mantenido en memoria como fuente de verdad del cliente. Se toma del
// CUERPO de /auth/csrf-token (no solo de document.cookie) para evitar ambigüedades
// por cookies viejas/duplicadas. Si el servidor responde 403 de CSRF, se refresca
// el token y se reintenta la petición una vez, de forma transparente al usuario.
let csrfToken: string | null = null;
const MUTATING = ['post', 'put', 'patch', 'delete'];

function readCsrfCookie(): string | null {
  const row = document.cookie.split('; ').find((r) => r.startsWith('csrf-token='));
  return row ? decodeURIComponent(row.split('=')[1]) : null;
}

/** Pide un token CSRF fresco al backend (siembra la cookie y lo guarda en memoria). */
export async function refreshCsrfToken(): Promise<string | null> {
  try {
    const { data } = await api.get('/auth/csrf-token');
    csrfToken = data?.token ?? readCsrfCookie();
  } catch {
    csrfToken = readCsrfCookie();
  }
  return csrfToken;
}

// Adjunta el header CSRF en métodos que mutan estado.
api.interceptors.request.use((config) => {
  if (config.method && MUTATING.includes(config.method.toLowerCase())) {
    const token = csrfToken ?? readCsrfCookie();
    if (token && config.headers) config.headers['x-csrf-token'] = token;
  }
  return config;
});

// Auto-recuperación: ante un 403 por CSRF, refresca el token y reintenta 1 vez.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const cfg = error.config;
    const status = error.response?.status;
    const msg = String(error.response?.data?.error ?? '');
    const isCsrf = status === 403 && /csrf/i.test(msg);

    if (isCsrf && cfg && !cfg._csrfRetried) {
      cfg._csrfRetried = true;
      await refreshCsrfToken(); // vuelve a sembrar la cookie (sobrescribe la vieja) + token en memoria
      const token = csrfToken ?? readCsrfCookie();
      if (token) {
        cfg.headers = cfg.headers ?? {};
        cfg.headers['x-csrf-token'] = token;
      }
      return api(cfg); // reintenta la petición original
    }
    return Promise.reject(error);
  }
);
