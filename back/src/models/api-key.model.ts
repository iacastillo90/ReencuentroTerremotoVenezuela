import mongoose, { Schema, Document } from 'mongoose';

export interface ApiKeyDocument extends Document {
  key: string;
  keyPrefix: string;
  name: string;
  type: 'admin' | 'webhook' | 'partner';
  active: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  permissions?: string[];
}

const apiKeySchema = new Schema<ApiKeyDocument>({
  key: { type: String, required: true, unique: true },
  keyPrefix: { type: String, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['admin', 'webhook', 'partner'], required: true, index: true },
  active: { type: Boolean, default: true, index: true },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date },
  expiresAt: { type: Date },
  permissions: [{ type: String }],
});

export const ApiKeyModel = mongoose.model<ApiKeyDocument>('ApiKey', apiKeySchema);
