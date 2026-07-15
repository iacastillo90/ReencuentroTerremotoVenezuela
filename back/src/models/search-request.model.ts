/**
 * models/search-request.model.ts — Solicitudes de búsqueda de usuarios
 *
 * PROPÓSITO:
 *   Almacena las solicitudes de búsqueda creadas por usuarios. Cada
 *   solicitud activa (status='activa') alimenta el motor de matching
 *   que busca coincidencias en la BD de personas. El campo embedding
 *   permite búsqueda vectorial (select: false por defecto).
 *
 * CARACTERÍSTICAS:
 *   - user: Referencia al usuario que creó la solicitud
 *   - assignedTo: Opcional, admin/moderador asignado
 *   - searchName: Nombre de la persona buscada
 *   - description: Contexto adicional
 *   - category: menor | adulto | adulto_mayor | mascota
 *   - status: activa | resuelta | cancelada
 *   - isMinor: Flag de menor de edad
 *   - embedding: Vector para búsqueda semántica (select: false)
 *
 * @module search-request.model
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface ISearchRequest extends Document {
  user: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  searchName: string;
  description?: string;
  category?: 'menor' | 'adulto' | 'adulto_mayor' | 'mascota';
  status: 'activa' | 'resuelta' | 'cancelada';
  isMinor: boolean;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

const SearchRequestSchema = new Schema<ISearchRequest>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    searchName: { type: String, required: true },
    description: { type: String },
    category: { type: String, enum: ['menor', 'adulto', 'adulto_mayor', 'mascota'] },
    status: { type: String, enum: ['activa', 'resuelta', 'cancelada'], default: 'activa' },
    isMinor: { type: Boolean, default: false },
    embedding: { type: [Number], select: false }
  },
  { timestamps: true }
);

export const SearchRequestModel = mongoose.model<ISearchRequest>('SearchRequest', SearchRequestSchema);
