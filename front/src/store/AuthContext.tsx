/**
 * ═══════════════════════════════════════════════════════════
 * store/AuthContext.tsx — Estado de autenticación global
 * 
 * PROPÓSITO:
 *   Mantiene el usuario logueado en un contexto de React
 *   para que cualquier componente pueda accederlo con useAuth().
 * 
 * ¿QUÉ GUARDA?
 *   - user: objeto User | null (null = no hay sesión)
 *   - isLoading: si está verificando la sesión al cargar
 *   - login/logout/updateUser: métodos para mutar el estado
 * 
 * FLUJO AL INICIAR:
 *   1. Se monta AuthProvider.
 *   2. useEffect → refreshCsrfToken() (siembra cookie CSRF).
 *   3. GET /auth/me → si la cookie de sesión es válida,
 *      el backend devuelve el usuario. Si no, lanza error
 *      (y user queda null).
 *   4. isLoading = false → la app ya sabe si hay sesión.
 * 
 * CONTROL DE ACCESO:
 *   - useAuth() lanza error si se usa fuera de AuthProvider.
 *   - login() se llama desde LoginPage o AuthModal después
 *     de autenticar con Google OAuth o email/password.
 *   - logout() llama POST /auth/logout y limpia user.
 *   - updateUser() actualiza el user sin cerrar sesión
 *     (útil cuando el usuario completa su perfil).
 * 
 * DEPENDENCIAS:
 *   - api (services/api.ts): instancia de Axios con CSRF.
 *   - refreshCsrfToken: para sembrar el token CSRF al inicio.
 * ═══════════════════════════════════════════════════════════
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { api, refreshCsrfToken } from '../services/api';

// ─── Interfaz User ──────────────────────────────────────
// Representa al usuario logueado. Campos clave:
//   - _id: ObjectId de MongoDB.
//   - name, email, picture: perfil básico.
//   - isProfileComplete: ¿completó su perfil con teléfono y sector?
//     Si es false, la app le muestra AuthModal para completar datos.
//   - sector: "gobierno" | "ong" | "voluntario" | "familia" | ...
//   - role: "user" | "verifier" | "admin" (controla acceso a admin).
//   - status: para usuarios que pidieron ser verificadores.
interface User {
  _id: string;
  name: string;
  email: string;
  picture?: string;
  isProfileComplete: boolean;
  sector?: string;
  contactNumber?: string;
  role?: string;
  status?: 'pending' | 'approved' | 'rejected';
}

// ─── Interfaz del contexto ─────────────────────────────
// Todo componente hijo puede acceder a:
//   - user: el usuario actual (null si no logueado).
//   - login(user): establece la sesión local.
//   - logout(): limpia la sesión.
//   - updateUser(user): actualiza datos sin cerrar sesión.
//   - isLoading: true mientras se verifica la sesión inicial.
interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  isLoading: boolean;
}

// ─── Creación del contexto ─────────────────────────────
// El valor inicial es undefined (NO un objeto vacío) para
// que useAuth() pueda detectar si se usa fuera del provider.
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── AuthProvider ───────────────────────────────────────
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ─── Efecto de inicialización ───────────────────────
  // Se ejecuta UNA VEZ al montar el provider.
  // Intenta restaurar la sesión del usuario:
  //   1. Siembra el token CSRF (necesario para POST/PUT/DELETE).
  //   2. Pide /auth/me con la cookie de sesión.
  //   3. Si el backend responde ok → hay sesión.
  //   4. Si error → sesión expirada o nunca existió (user = null).
  useEffect(() => {
    const initAuth = async () => {
      // Siempre refresca el CSRF al cargar la app.
      // Esto asegura que la cookie csrf-token exista antes
      // de cualquier request mutante.
      await refreshCsrfToken();

      try {
        // Intenta obtener el usuario desde la cookie de sesión.
        // El backend lee la cookie HTTP-only 'connect.sid' (express-session).
        const res = await api.get('/auth/me');
        setUser(res.data.user);
      } catch {
        // No hay sesión activa (cookie expirada o ausente).
        // user se queda en null → el usuario ve HomeGateway.
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  // ─── login ──────────────────────────────────────────
  // Se llama después de una autenticación exitosa.
  // Recibe el User devuelto por el backend y lo guarda
  // en el estado del contexto.
  const login = (newUser: User) => {
    setUser(newUser);
  };

  // ─── logout ─────────────────────────────────────────
  // 1. Llama POST /auth/logout para limpiar la cookie de
  //    sesión en el servidor.
  // 2. Si falla (ej: servidor caído), igual limpia el
  //    estado local — el usuario no debe quedar atascado.
  // 3. setUser(null) → la app vuelve al estado no-logueado.
  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Si el servidor no responde, igual cerramos sesión
      // localmente para no dejar al usuario atascado.
    }
    setUser(null);
  };

  // ─── updateUser ─────────────────────────────────────
  // Actualiza el usuario sin cerrar sesión.
  // Útil cuando:
  //   - El usuario completa su perfil (isProfileComplete → true).
  //   - El administrador cambia el rol del usuario.
  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  // Renderiza el provider con el valor del contexto.
  // Cualquier componente hijo puede usar useAuth().
  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

// ─── Hook useAuth ────────────────────────────────────────
// Hook personalizado para consumir el contexto de auth.
//
// USO:
//   const { user, login, logout, isLoading } = useAuth();
//
// SEGURIDAD:
//   Si alguien usa useAuth() fuera de <AuthProvider>,
//   lanza un error explícito. Esto evita el error silencioso
//   de React donde useContext devuelve undefined.
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
