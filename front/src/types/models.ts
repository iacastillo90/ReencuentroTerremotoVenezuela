/**
 * Interfaces para los modelos de datos del frontend.
 *
 * PROPÓSITO:
 * Centralizar los tipos usados en la aplicación para evitar `any` y mejorar la
 * seguridad de tipos.
 */

export interface Person {
  idHash: string;
  name: string;
  status: 'missing' | 'found';
  lastSeen: {
    state: string;
    description: string;
  };
  metadata: {
    urgencyScore: number;
    createdAt: string;
  };
  data: {
    cedula?: string;
    origen?: string;
    ficha_url?: string;
    verificado_por?: string;
  };
}

export interface ChatMessage {
  _id: string;
  senderId: string;
  receiverId: string;
  reportId: string;
  message: string;
  createdAt: string;
}

export interface ReportPayload {
  notes: string;
  reportData: {
    name: string;
    cedula?: string;
    contactNumber?: string;
    age?: number;
    lastSeen: string;
    state: string;
    extraDetails?: string;
  };
}

export interface Match {
  _id: string;
  personId: string;
  similarity: number;
  originalReportName: string;
  name: string;
  status: 'missing' | 'found';
  lastSeen: {
    state: string;
    description: string;
  };
  metadata: {
    urgencyScore: number;
    createdAt: string;
  };
}

export interface SearchRequest {
  name: string;
  estado: string;
  municipio: string;
  edad?: string;
  raza?: string;
  fecha?: string;
}

// Solicitud para ser verificador (rol 'verifier')
export interface VerificationRequest {
  notes: string;
}

export interface DisasterEvent {
  id: string;
  name: string;
  active: boolean;
  state: string;
  municipalities: string[];
  startDate: string;
}

export interface Notification {
  _id: string;
  userId: string;
  type: 'match' | 'message' | 'verification';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: {
    matchId?: string;
    messageId?: string;
  };
}

// Error response de Axios
export interface ErrorResponse {
  response?: {
    data?: {
      error?: string;
    };
  };
  message?: string;
}