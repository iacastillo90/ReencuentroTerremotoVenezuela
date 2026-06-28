import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { api } from '../services/api';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock del API
vi.mock('../services/api', () => ({
  api: {
    get: vi.fn()
  }
}));

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
    (api.get as any).mockReturnValue(new Promise(() => {})); // Promesa sin resolver
    render(<App />);
    expect(screen.getByText(/Cargando datos geoespaciales/i)).toBeInTheDocument();
  });

  it('renders persons and disasters successfully', async () => {
    const mockPersons = [
      { idHash: '123', name: 'Juan Perez', status: 'missing', lastSeen: { state: 'Miranda' }, metadata: { urgencyScore: 80 } }
    ];
    const mockDisasters = [
      { _id: 'd1', title: 'Sismo Fuerte', type: 'earthquake', severity: 'high', coordinates: { coordinates: [-66, 10] } }
    ];

    (api.get as any).mockImplementation((url: string) => {
      if (url === '/persons') return Promise.resolve({ data: mockPersons });
      if (url === '/disasters/active') return Promise.resolve({ data: mockDisasters });
      return Promise.resolve({ data: [] });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      expect(screen.getAllByText('1').length).toBeGreaterThan(0); // Alertas activas y desaparecidos
    });
  });
});
