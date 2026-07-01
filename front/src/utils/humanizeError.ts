import type { AxiosError } from 'axios';

/**
 * Convierte errores técnicos del backend en mensajes serenos y accionables para
 * la persona. Nunca debe mostrarse jerga (p. ej. "Invalid CSRF token") en un
 * producto de crisis: el tono es humano, claro y sin alarmar.
 */
const TECH_MAP: { match: RegExp; message: string }[] = [
  { match: /csrf/i,                         message: 'No pudimos validar tu sesión. Intenta de nuevo.' },
  { match: /internal server error/i,        message: 'Tuvimos un problema de nuestro lado. Intenta en un momento.' },
  { match: /validation error/i,             message: 'Revisa los datos ingresados e intenta de nuevo.' },
  { match: /too many|demasiados/i,          message: 'Demasiados intentos. Espera unos minutos e intenta otra vez.' },
  { match: /network|timeout|econnrefused/i, message: 'Sin conexión con el servidor. Verifica tu internet e intenta de nuevo.' },
];

export function humanizeError(err: unknown, fallback = 'Algo salió mal. Intenta de nuevo.'): string {
  const ax = err as AxiosError<{ error?: string }>;
  const raw = ax?.response?.data?.error;

  // Errores de red (sin respuesta del servidor).
  if (!ax?.response) {
    const netMsg = String((ax as any)?.message ?? '');
    const hit = TECH_MAP.find((m) => m.match.test(netMsg));
    if (hit) return hit.message;
  }

  if (typeof raw === 'string' && raw.trim()) {
    const hit = TECH_MAP.find((m) => m.match.test(raw));
    if (hit) return hit.message;
    // Si el backend ya devuelve un mensaje humano en español, se respeta tal cual
    // (p. ej. "Correo o contraseña incorrectos", "Ya existe una cuenta con ese correo").
    if (/[áéíóúñ¿¡]|correo|contrase|cuenta|sesi[oó]n|usuario/i.test(raw)) return raw;
  }

  return fallback;
}
