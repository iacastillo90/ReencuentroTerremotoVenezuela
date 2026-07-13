/**
 * models/state-history.model.ts — Historial de cambios de estado
 *
 * PROPÓSITO:
 *   Almacena el historial de cambios de estado de una persona (missing →
 *   found, etc.). Proporciona trazabilidad completa para auditoría.
 *   Solo tiene createdAt (no updatedAt, ya que el historial es inmutable).
 *
 * CARACTERÍSTICAS:
 *   - reportId: idHash de la persona (indexado)
 *   - changedBy: Usuario que realizó el cambio
 *   - previousState: Estado anterior
 *   - newState: Estado nuevo
 *   - notes: Notas opcionales sobre el cambio
 *   - createdAt: Timestamp automático (inmutable)
 *
 * @module state-history.model
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IStateHistory extends Document {
  reportId: string; // idHash de Person
  changedBy?: mongoose.Types.ObjectId; // User que hizo el cambio
  previousState: string;
  newState: string;
  notes?: string;
  createdAt: Date;
}

const StateHistorySchema = new Schema<IStateHistory>(
  {
    reportId: { type: String, required: true, index: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    previousState: { type: String, required: true },
    newState: { type: String, required: true },
    notes: { type: String }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const StateHistoryModel = mongoose.model<IStateHistory>('StateHistory', StateHistorySchema);
