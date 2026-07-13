/**
 * models/audit-log.model.ts — Registro de auditoría (capped collection)
 *
 * PROPÓSITO:
 *   Almacena eventos de auditoría del sistema usando una colección
 *   capped de MongoDB (1GB, máx 1M documentos). Los eventos incluyen
 *   autenticaciones, ingestiones, fallos de validación y violaciones
 *   de seguridad.
 *
 * CARACTERÍSTICAS:
 *   - eventType: 8 tipos de eventos (auth, admin_action, ingestion, etc.)
 *   - severity: info | warning | error | critical
 *   - capped collection: 1GB / 1M docs máx (FIFO automático)
 *   - Validación del campo detail: máx 2000 chars serializados
 *   - Campos: actor, action, resource, detail, ip, userAgent
 *
 * EVENTOS:
 *   auth_login_success/failure, auth_logout, admin_action,
 *   ingestion_webhook, ingestion_partner, validation_failure,
 *   security_violation
 *
 * @module audit-log.model
 */
import { Schema, model } from 'mongoose';

export interface IAuditLog {
  eventType:
    | 'auth_login_success'
    | 'auth_login_failure'
    | 'auth_logout'
    | 'admin_action'
    | 'system_action'
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
      'system_action',
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
