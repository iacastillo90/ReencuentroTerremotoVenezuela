import mongoose, { Schema, Document } from 'mongoose';

export interface OutboxEvent extends Document {
  type: 'person-matching' | 'manual-audit' | 'ia-processing';
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  createdAt: Date;
  processedAt?: Date;
}

const outboxSchema = new Schema<OutboxEvent>({
  type: { type: String, enum: ['person-matching', 'manual-audit', 'ia-processing'], required: true },
  payload: { type: Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 5 },
  lastError: { type: String },
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date },
});

outboxSchema.index({ status: 1, createdAt: 1 });
outboxSchema.index({ type: 1, status: 1 });

export const OutboxModel = mongoose.model<OutboxEvent>('Outbox', outboxSchema);
