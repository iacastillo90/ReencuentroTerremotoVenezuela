import { Schema, model, Document } from 'mongoose';

export interface SyncState extends Document {
  externalId: string;
  source: string;
  lastProcessed: Date;
  checksum: string;
  processCount: number;
  lastError?: string;
}

const SyncStateSchema = new Schema<SyncState>({
  externalId: { type: String, required: true },
  source: { type: String, required: true },
  lastProcessed: { type: Date, required: true, default: Date.now },
  checksum: { type: String, required: true },
  processCount: { type: Number, default: 0 },
  lastError: { type: String }
});

SyncStateSchema.index({ externalId: 1, source: 1 }, { unique: true });

export const SyncStateModel = model<SyncState>('SyncState', SyncStateSchema);
