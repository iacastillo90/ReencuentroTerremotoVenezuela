/**
 * models/localizado.model.ts — Personas localizadas en refugios/hospitales
 *
 * PROPÓSITO:
 *   Almacena registros de personas que han sido localizadas (encontradas)
 *   en refugios, hospitales o albergues durante desastres. Datos provistos
 *   por partners (protección civil, hospitales, ONGs).
 *
 * CARACTERÍSTICAS:
 *   - name: Nombre completo (índice text)
 *   - cedula: Cédula de identidad (índice text)
 *   - age, gender: Datos demográficos
 *   - origin: Procedencia
 *   - location: Hospital/Refugio/Albergue
 *   - isVerified: Verificado en el registro
 *   - sourceUrl: URL de la ficha original
 *   - timestamps: createdAt + updatedAt
 *
 * ÍNDICES:
 *   - name: text + cedula: text (text search compuesto)
 *   - name: index (búsqueda exacta)
 *   - cedula: index (búsqueda por cédula)
 *
 * @module localizado.model
 */
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
