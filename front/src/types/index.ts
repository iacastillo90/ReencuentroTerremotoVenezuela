export interface Person {
  idHash: string;
  type?: 'person' | 'animal';
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
  gender?: string;
  description?: string;
  photoUrl?: string;
  metadata: {
    urgencyScore: number;
    createdAt?: string;
    reportedBy?: { name: string };
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
  description: string;
  source: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  coordinates: {
    coordinates: [number, number];
  };
  occurredAt: string;
  metadata?: any;
}
