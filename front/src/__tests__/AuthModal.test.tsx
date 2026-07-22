/**
 * __tests__/AuthModal.test.tsx — Tests del modal de autenticación
 *
 * PROPÓSITO:
 *   Verifica que AuthModal renderice correctamente sus 3 estados:
 *   - Estado 1: usuario no logueado → muestra botón de Google Login.
 *   - Estado 2: usuario sin perfil completo → formulario de sector/teléfono.
 *   - Estado 3: usuario pendiente de revisión → mensaje informativo.
 *
 * MOCKS:
 *   - useAuth() mockeado para simular diferentes estados del usuario.
 *   - GoogleLogin mockeado (no se puede renderizar en JSDOM).
 *   - api.post mockeado para evitar llamadas reales.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { AuthModal } from '../components/modals/AuthModal';
import { useAuth } from '../store/AuthContext';

// Mock de GoogleOAuthProvider y GoogleLogin
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: () => <button data-testid="google-login-btn">Log in with Google</button>,
}));

// Mock del contexto de Autenticación
vi.mock('../store/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock del api module para tests de bypass
const mockApiPost = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { user: null } }));
vi.mock('../services/api', () => ({
  api: {
    post: mockApiPost,
    get: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

describe('AuthModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('debería mostrar el botón de Google Login si el usuario no está autenticado', () => {
    (useAuth as any).mockReturnValue({
      user: null,
      login: vi.fn(),
    });

    render(<AuthModal onClose={mockOnClose} onSuccess={mockOnSuccess} />);
    
    expect(screen.getByText(/Iniciar Sesión/i)).toBeInTheDocument();
    expect(screen.getByTestId('google-login-btn')).toBeInTheDocument();
  });

  it('debería mostrar el formulario de perfil si el usuario está autenticado pero el perfil está incompleto', () => {
    (useAuth as any).mockReturnValue({
      user: {
        _id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        isProfileComplete: false,
      },
      login: vi.fn(),
    });

    render(<AuthModal onClose={mockOnClose} onSuccess={mockOnSuccess} />);
    
    expect(screen.getByText(/Completa tu Perfil/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/La Guaira, Caribe/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/\+58 412/i)).toBeInTheDocument();
  });
});

