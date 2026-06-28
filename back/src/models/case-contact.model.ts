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
