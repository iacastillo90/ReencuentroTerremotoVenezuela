import { Schema, model, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  personIdHash: string;
  action: 'case_closed' | 'status_changed' | 'merged';
  previousStatus?: string;
  newStatus: string;
  resolutionNotes?: string;
  performedBy?: Types.ObjectId; // User ID if authenticated
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  digitalSignature?: string; // Optional field for future cryptographic hashing
}

const AuditLogSchema = new Schema<IAuditLog>({
  personIdHash: { type: String, required: true },
  action: { type: String, required: true, enum: ['case_closed', 'status_changed', 'merged'] },
  previousStatus: { type: String },
  newStatus: { type: String, required: true },
  resolutionNotes: { type: String },
  performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  ipAddress: { type: String, required: true },
  userAgent: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  digitalSignature: { type: String }
});

// Important index for querying history of a specific case
AuditLogSchema.index({ personIdHash: 1, timestamp: -1 });

export const AuditLogModel = model<IAuditLog>('AuditLog', AuditLogSchema);
