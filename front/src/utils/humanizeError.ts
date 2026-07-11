/**
 * utils/humanizeError.ts — Traduce errores técnicos a mensajes humanos
 *
 * PROPÓSITO:
 *   En un producto de crisis, mostrar "Invalid CSRF token" o
 *   "Internal Server Error" asusta a la persona usuaria.
 *   Esta función convierte esos errores del backend en mensajes
 *   serenos, claros y accionables, en español.
 *
 * CÓMO FUNCIONA:
 *   1. Recibe cualquier error (throw catch).
 *   2. Busca coincidencias en TECH_MAP (regex sobre el mensaje).
 *   3. Si encuentra match, devuelve el mensaje humano.
 *   4. Si el backend ya devolvió un mensaje en español amigable
 *      (con tildes, "correo", "contraseña"), lo respeta.
 *   5. Si no hay match, devuelve un fallback genérico.
 *
 * EJEMPLOS:
 *   humanizeError({ response: { data: { error: 'CSRF token mismatch' } } })
 *   → "No pudimos validar tu sesión. Intenta de nuevo."
 *
 *   humanizeError(new Error('Network Error'))
 *   → "Sin conexión con el servidor. Verifica tu internet e intenta de nuevo."
 *
 *   humanizeError({ response: { data: { error: 'Correo o contraseña incorrectos' } } })
 *   → "Correo o contraseña incorrectos" (se respeta el mensaje del backend)
 */
import type { AxiosError } from 'axios';

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

  if (!ax?.response) {
    const netMsg = String((ax as any)?.message ?? '');
    const hit = TECH_MAP.find((m) => m.match.test(netMsg));
    if (hit) return hit.message;
  }

  if (typeof raw === 'string' && raw.trim()) {
    const hit = TECH_MAP.find((m) => m.match.test(raw));
    if (hit) return hit.message;
    if (/[áéíóúñ¿¡]|correo|contrase|cuenta|sesi[oó]n|usuario/i.test(raw)) return raw;
  }

  return fallback;
}
