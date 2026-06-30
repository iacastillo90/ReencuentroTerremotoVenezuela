export interface Person {
  idHash: string;
  name: string;
  status: 'missing' | 'found' | 'deceased' | 'unknown';
  lastSeen: {
    state: string;
    description: string;
    municipality?: string;
    date?: string;
    coordinates?: {
      coordinates: [number, number];
    }
  };
  age?: number;
  ageBand?: 'menor' | 'adulto' | null;
  gender?: string;
  description?: string;
  photoUrl?: string;
  approxLocation?: [number, number];   // [lng, lat] aproximado (mapa público)
  protected?: boolean;                 // menor enmascarado por el backend
  metadata: {
    urgencyScore: number;
    createdAt?: string;
    reportedBy?: { name: string } | string;
  };
  data?: {
    cedula?: string;
    ficha_url?: string;
    origen?: string;
    verificado_por?: string;
  };
}

export interface Disaster {
  _id: string;
  title: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  coordinates: {
    coordinates: [number, number];
  };
  occurredAt: string;
}
