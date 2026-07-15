/**
 * models/case-contact.model.ts — Mensajes entre usuarios sobre reportes
 *
 * PROPÓSITO:
 *   Almacena los mensajes enviados entre usuarios acerca de un reporte
 *   de persona específico. Es la capa de persistencia para el sistema
 *   de mensajería interna (contact.controller).
 *
 * CARACTERÍSTICAS:
 *   - reportId: idHash de la persona (referencia a PersonModel)
 *   - senderId: Usuario que envía el mensaje
 *   - receiverId: Usuario que reportó la persona (opcional, inferido)
 *   - message: Contenido del mensaje
 *   - isRead: Flag de lectura
 *   - status: pending | approved | rejected (para moderación futura)
 *   - timestamps: createdAt + updatedAt automáticos
 *
 * ÍNDICES:
 *   - reportId: index (búsqueda de conversaciones por reporte)
 *
 * @module case-contact.model
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface ICaseContact extends Document {
  reportId: string; // idHash de Person
  senderId: mongoose.Types.ObjectId; // User que envía el mensaje (ej. quien busca)
  receiverId?: mongoose.Types.ObjectId; // User que reportó la persona (si existe)
  message: string;
  isRead: boolean;
  status: 'pending' | 'approved' | 'rejected'; // Para moderación si es necesario
  createdAt: Date;
  updatedAt: Date;
}

const CaseContactSchema = new Schema<ICaseContact>(
  {
    reportId: { type: String, required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: 'User' },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
  },
  { timestamps: true }
);

export const CaseContactModel = mongoose.model<ICaseContact>('CaseContact', CaseContactSchema);
