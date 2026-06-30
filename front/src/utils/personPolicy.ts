/**
 * Política de visibilidad de datos en el cliente (defensa en profundidad).
 * La fuente de verdad real es el backend (toPublicPerson); esto evita además
 * mostrar PII si por alguna vía llegara al cliente.
 */

type UserLike = { role?: string } | null | undefined;

/**
 * Menor protegido (LOPNNA). El backend ya lo marca con `protected:true`;
 * como respaldo, también se deriva de la edad (<18).
 */
export function isProtectedMinor(person: any): boolean {
  if (person?.protected) return true;
  const age = person?.age != null ? Number(person.age) : NaN;
  return !Number.isNaN(age) && age > 0 && age < 18;
}

/**
 * Datos sensibles (ubicación exacta, datos de menores, ficha original,
 * identidad del reportante) SOLO para organizaciones verificadas o admin.
 * El login básico NO desbloquea PII sensible: solo habilita acciones.
 */
export function canViewSensitive(user?: UserLike): boolean {
  const role = user?.role;
  return role === 'admin' || role === 'verifier';
}
