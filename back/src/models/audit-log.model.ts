import { Schema, model } from 'mongoose';

export interface IAuditLog {
  eventType:
    | 'auth_login_success'
    | 'auth_login_failure'
    | 'auth_logout'
    | 'admin_action'
    | 'ingestion_webhook'
    | 'ingestion_partner'
    | 'validation_failure'
    | 'security_violation';
  severity: 'info' | 'warning' | 'error' | 'critical';
  actor: string;
  action: string;
  resource?: string;
  detail?: Record<string, any>;
  ip: string;
  userAgent?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  eventType: {
    type: String,
    enum: [
      'auth_login_success',
      'auth_login_failure',
      'auth_logout',
      'admin_action',
      'ingestion_webhook',
      'ingestion_partner',
      'validation_failure',
      'security_violation',
    ],
    required: true,
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    required: true,
  },
  actor: { type: String, required: true },
  action: { type: String, required: true },
  resource: { type: String },
  detail: {
    type: Schema.Types.Mixed,
    validate: {
      validator: function (v: Record<string, any>) {
        if (!v) return true;
        const str = JSON.stringify(v);
        return str.length <= 2000;
      },
      message: 'Detail field exceeds 2000 character limit',
    },
  },
  ip: { type: String, required: true },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now },
}, {
  collection: 'audit_logs',
  capped: { size: 1073741824, max: 1000000 },
});

export const AuditLogModel = model<IAuditLog>('AuditLog', AuditLogSchema);
