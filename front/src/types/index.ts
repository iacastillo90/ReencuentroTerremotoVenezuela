export interface Person {
  idHash: string;
  name: string;
  status: 'missing' | 'found' | 'deceased' | 'unknown';
  lastSeen: {
    state: string;
    description: string;
    coordinates?: {
      coordinates: [number, number];
    }
  };
  age?: number;
  gender?: string;
  description?: string;
  photoUrl?: string;
  metadata: {
    urgencyScore: number;
    createdAt?: string;
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
