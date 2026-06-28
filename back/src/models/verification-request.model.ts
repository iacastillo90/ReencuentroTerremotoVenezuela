import mongoose, { Schema, Document } from 'mongoose';

export interface IVerificationRequest extends Document {
  user: mongoose.Types.ObjectId;
  requestedRole: 'verifier';
  evidenceUrl?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

const VerificationRequestSchema = new Schema<IVerificationRequest>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestedRole: { type: String, enum: ['verifier'], default: 'verifier' },
    evidenceUrl: { type: String },
    notes: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
  },
  { timestamps: true }
);

export const VerificationRequestModel = mongoose.model<IVerificationRequest>('VerificationRequest', VerificationRequestSchema);
