import mongoose, { Schema, Document } from 'mongoose';

export interface ILocalizado extends Document {
  name: string;
  cedula?: string;
  age?: string;
  gender?: string;
  origin?: string; // Procedencia
  location: string; // Hospital o lugar
  isVerified: boolean; // En el registro
  sourceUrl?: string; // Ficha url
  createdAt: Date;
  updatedAt: Date;
}

const LocalizadoSchema: Schema = new Schema({
  name: { type: String, required: true, index: true },
  cedula: { type: String, index: true },
  age: { type: String },
  gender: { type: String },
  origin: { type: String },
  location: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  sourceUrl: { type: String },
}, {
  timestamps: true,
  collection: 'localizados'
});

// Índice compuesto para búsquedas
LocalizadoSchema.index({ name: 'text', cedula: 'text' });

export const LocalizadoModel = mongoose.model<ILocalizado>('Localizado', LocalizadoSchema);
