/**
 * __tests__/AuthContext.test.tsx — Tests del contexto de autenticación
 *
 * PROPÓSITO:
 *   Verifica que AuthProvider + useAuth funcionen correctamente:
 *   - login(user): actualiza el estado del usuario.
 *   - logout(): limpia el estado y llama a api.post('/auth/logout').
 *   - Estado inicial: user = null.
 *   - Persistencia: al montar, checkea /auth/me para restaurar sesión.
 *
 * MOCKS:
 *   - api.get y api.post mockeados con vi.hoisted().
 *   - El hook renderHook de testing-library envuelve en AuthProvider.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthProvider, useAuth } from '../store/AuthContext';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  defaults: {
    withCredentials: true,
    headers: { common: {} },
  },
}));

vi.mock('../services/api', () => ({
  api: mockApi,
}));

const ls = (): Storage | null => {
  try { return localStorage; } catch { return null; }
};

describe('AuthContext - Cookie-based auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockResolvedValue({ data: { user: null } });
  });

  it('has withCredentials set to true on axios instance', async () => {
    const mod = await vi.importActual<typeof import('../services/api')>('../services/api');
    expect(mod.api.defaults.withCredentials).toBe(true);
  });

  it('does not store token in localStorage after login', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    act(() => {
      result.current.login({
        _id: '1',
        name: 'Test User',
        email: 'test@test.com',
        isProfileComplete: true,
      });
    });

    const storage = ls();
    if (storage) {
      expect(storage.getItem('token')).toBeNull();
    }
  });

  it('calls GET /auth/me and GET /auth/csrf-token on mount', async () => {
    renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/auth/me');
    });

    expect(mockApi.get).toHaveBeenCalledWith('/auth/csrf-token');
  });

  it('login sets user state without storing in localStorage', () => {
    const testUser = {
      _id: '1',
      name: 'Test User',
      email: 'test@test.com',
      isProfileComplete: true,
    };

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    act(() => {
      result.current.login(testUser);
    });

    expect(result.current.user).toEqual(testUser);
    const storage = ls();
    if (storage) {
      expect(storage.getItem('token')).toBeNull();
    }
  });

  it('logout calls POST /auth/logout and clears user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    act(() => {
      result.current.login({ _id: '1', name: 'Test', email: 'test@test.com', isProfileComplete: true });
    });

    expect(result.current.user).not.toBeNull();

    await act(async () => {
      await result.current.logout();
    });

    expect(mockApi.post).toHaveBeenCalledWith('/auth/logout');
    expect(result.current.user).toBeNull();
  });

  it('has no default Authorization header on axios', async () => {
    const mod = await vi.importActual<typeof import('../services/api')>('../services/api');
    expect(mod.api.defaults.headers?.common?.Authorization).toBeUndefined();
  });
});
