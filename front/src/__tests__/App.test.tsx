import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { api } from '../services/api';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock de useAuth para que App no necesite AuthProvider
vi.mock('../store/AuthContext', () => ({
  useAuth: vi.fn().mockReturnValue({
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

// Mock del API
vi.mock('../services/api', () => ({
  api: {
    get: vi.fn()
  }
}));

// Mock de IntersectionObserver porque jsdom no lo soporta
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

// Mock de React Leaflet porque no se puede renderizar en JSDOM sin errores
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: any) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
  Circle: () => <div data-testid="circle" />
}));

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (api.get as any).mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(screen.getByText(/Cargando registros/i)).toBeInTheDocument();
  });

  it('renders persons and disasters successfully', async () => {
    const mockPersons = [
      { idHash: '123', name: 'Juan Perez', status: 'missing', lastSeen: { state: 'Miranda' }, metadata: { urgencyScore: 80 } }
    ];
    const mockDisasters = [
      { _id: 'd1', title: 'Sismo Fuerte', type: 'earthquake', severity: 'high', coordinates: { coordinates: [-66, 10] } }
    ];

    (api.get as any).mockImplementation((url: string) => {
      if (url === '/persons/counts') return Promise.resolve({ data: { missing: 1, found: 0, total: 1 } });
      if (url.startsWith('/persons')) return Promise.resolve({ data: { total: mockPersons.length, persons: mockPersons } });
      if (url === '/disasters/active') return Promise.resolve({ data: mockDisasters });
      if (url.startsWith('/localizados')) return Promise.resolve({ data: { data: [], total: 0 } });
      return Promise.resolve({ data: [] });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    });
  });
});
