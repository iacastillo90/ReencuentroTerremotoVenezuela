import { render, screen, fireEvent } from '@testing-library/react';
import { AuthModal } from '../../components/modals/AuthModal';
import { useAuth } from '../../store/AuthContext';

// Mock de GoogleOAuthProvider y GoogleLogin
jest.mock('@react-oauth/google', () => ({
  GoogleLogin: () => <button data-testid="google-login-btn">Log in with Google</button>,
}));

// Mock del contexto de Autenticación
jest.mock('../../store/AuthContext', () => ({
  useAuth: jest.fn(),
}));

describe('AuthModal Component', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debería mostrar el botón de Google Login si el usuario no está autenticado', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      login: jest.fn(),
      token: null,
    });

    render(<AuthModal onClose={mockOnClose} onSuccess={mockOnSuccess} />);
    
    expect(screen.getByText(/Iniciar Sesión/i)).toBeInTheDocument();
    expect(screen.getByTestId('google-login-btn')).toBeInTheDocument();
  });

  it('debería mostrar el formulario de perfil si el usuario está autenticado pero el perfil está incompleto', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        _id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        isProfileComplete: false,
      },
      login: jest.fn(),
      token: 'fake-token',
    });

    render(<AuthModal onClose={mockOnClose} onSuccess={mockOnSuccess} />);
    
    expect(screen.getByText(/Completa tu Perfil/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/La Guaira, Caribe/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/\+58 412/i)).toBeInTheDocument();
  });
});
