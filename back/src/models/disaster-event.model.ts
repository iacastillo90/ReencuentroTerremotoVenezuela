import mongoose, { Schema, Document } from 'mongoose';

export interface IDisasterEvent extends Document {
  type: 'earthquake' | 'flood' | 'fire' | 'hurricane' | 'landslide' | 'social';
  severity: 'low' | 'medium' | 'high' | 'critical';
  coordinates: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  radius_km?: number;
  title: string;
  description: string;
  source: string;
  externalId: string;
  occurredAt: Date;
  validUntil?: Date;
  affectedAreas: string[];
  metadata: {
    magnitude?: number;
    depth_km?: number;
    windSpeed_kmh?: number;
    rainfallMm?: number;
    rawData: any;
  };
}

const disasterEventSchema = new Schema<IDisasterEvent>({
  type: {
    type: String,
    enum: ['earthquake', 'flood', 'fire', 'hurricane', 'landslide', 'social'],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  radius_km: { type: Number },
  title: { type: String, required: true },
  description: { type: String, required: true },
  source: { type: String, required: true },
  externalId: { type: String, required: true, unique: true },
  occurredAt: { type: Date, required: true },
  validUntil: { type: Date },
  affectedAreas: [{ type: String }],
  metadata: {
    magnitude: { type: Number },
    depth_km: { type: Number },
    windSpeed_kmh: { type: Number },
    rainfallMm: { type: Number },
    rawData: { type: Schema.Types.Mixed, default: {} }
  }
}, { timestamps: true });

// CRÍTICO: Índice geoespacial para cruces eficientes (Fuzzy y Radio)
disasterEventSchema.index({ coordinates: '2dsphere' });
disasterEventSchema.index({ type: 1, severity: 1, occurredAt: -1 });
disasterEventSchema.index({ validUntil: 1 });

export const DisasterEventModel = mongoose.model<IDisasterEvent>('DisasterEvent', disasterEventSchema);
