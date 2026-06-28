import { render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
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
      token: null,
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
      token: 'fake-token',
    });

    render(<AuthModal onClose={mockOnClose} onSuccess={mockOnSuccess} />);
    
    expect(screen.getByText(/Completa tu Perfil/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/La Guaira, Caribe/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/\+58 412/i)).toBeInTheDocument();
  });
});
