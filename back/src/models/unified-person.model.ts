import { Schema, model, Document, Types } from 'mongoose';

export interface UnifiedPerson extends Document {
  externalIds: Array<{
    source: 'venezuela-te-busca' | 'whatsapp' | 'web-form' | 'telegram' | 'manual' | string;
    id: string;
    addedAt: Date;
  }>;
  type: 'person' | 'animal';
  name: string;
  normalizedName: string;
  idHash: string;
  aliases: string[];
  status: 'missing' | 'found' | 'deceased' | 'unknown';
  lastSeen: {
    description: string;
    state: string;
    municipality?: string;
    coordinates?: {
      type: 'Point';
      coordinates: [number, number];
    };
    date: Date;
  };
  age?: number;
  gender?: 'M' | 'F' | 'other' | 'unknown';
  description?: string;
  photoUrl?: string;
  contactPerson?: {
    name: string;
    phone?: string;
    relationship: string;
  };
  possiblyRelatedDisasters?: Types.ObjectId[];
  // WARNING: Schema.Types.Mixed below — must be validated with Zod before reaching the model.
  // See personPayloadSchema in validators/person.validator.ts for the expected shape.
  data?: {
    cedula_hash?: string;
    [key: string]: any;
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    lastSync: Date;
    source: string;
    urgencyScore: number;
    confidenceScore?: number;
    confidenceLabel?: string;
    aiProcessed: boolean;
    auditStatus: 'clean' | 'pending_review' | 'merged' | 'dismissed';
    reportedBy?: Types.ObjectId | string;
    reporterIp?: string;
    reporterLocation?: { lat: number; lng: number };
  };
  embedding?: number[];
}

const UnifiedPersonSchema = new Schema<UnifiedPerson>({
  externalIds: [{ source: String, id: String, addedAt: Date }],
  type: { type: String, enum: ['person', 'animal'], required: true },
  name: { type: String, required: true },
  normalizedName: { type: String, required: true },
  idHash: { type: String, required: true, unique: true },
  aliases: [String],
  status: { type: String, enum: ['missing', 'found', 'deceased', 'unknown'], default: 'missing' },
  lastSeen: {
    description: String,
    state: String,
    municipality: String,
    coordinates: {
      type: { type: String, enum: ['Point'] },
      coordinates: [Number],
    },
    date: Date,
  },
  age: Number,
  gender: { type: String, enum: ['M', 'F', 'other', 'unknown'] },
  description: String,
  photoUrl: String,
  contactPerson: {
    name: String,
    phone: String,
    relationship: String,
  },
  possiblyRelatedDisasters: [{ type: Schema.Types.ObjectId, ref: 'DisasterEvent' }],
  // WARNING: Must be validated with Zod before saving — see personPayloadSchema.
  data: { type: Schema.Types.Mixed },
  metadata: {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastSync: { type: Date, default: Date.now },
    source: String,
    urgencyScore: { type: Number, default: 0 },
    confidenceScore: Number,
    confidenceLabel: String,
    aiProcessed: { type: Boolean, default: false },
    auditStatus: { type: String, enum: ['clean', 'pending_review', 'merged', 'dismissed'], default: 'clean' },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reporterIp: String,
    reporterLocation: {
      lat: Number,
      lng: Number
    }
  },
  embedding: { type: [Number], select: false } // Vector embedding para IA
});

UnifiedPersonSchema.index({ normalizedName: 1, 'lastSeen.state': 1 });
UnifiedPersonSchema.index({ idHash: 1 }, { unique: true });
UnifiedPersonSchema.index({ status: 1, 'metadata.urgencyScore': -1 });
UnifiedPersonSchema.index({ 'lastSeen.coordinates': '2dsphere' });
UnifiedPersonSchema.index({ 'externalIds.source': 1, 'externalIds.id': 1 });

export const PersonModel = model<UnifiedPerson>('UnifiedPerson', UnifiedPersonSchema);
