/**
 * validators/admin.validator — Esquemas Zod para rutas de administración
 *
 * PROPÓSITO:
 *   Define esquemas de validación para las operaciones administrativas:
 *   actualización de estado, fusión, moderación, gestión de matches y usuarios.
 *
 * SCHEMAS:
 *   - adminStatusUpdateSchema: status (missing/found/deceased/unknown)
 *   - adminMergeSchema: targetIdHash
 *   - adminModerateSchema: action (approve/reject)
 *   - adminUpdateMatchStatusSchema: status (pending/confirmed/rejected)
 *   - adminUpdateUserRoleSchema: role (user/admin)
 *   - adminUpdateUserStatusSchema: status (pending/approved/suspended)
 *   - adminAuditStatusQuerySchema: filtros de auditoría con paginación
 *
 * @module admin.validator
 */

import { z } from 'zod';
import { sanitizedString } from '../utils/sanitize.util';

export const adminStatusUpdateSchema = z.object({
  status: z.enum(['missing', 'found', 'deceased', 'unknown']),
});

export const adminMergeSchema = z.object({
  targetIdHash: sanitizedString.pipe(z.string().min(1).max(128)),
});

export const adminModerateSchema = z.object({
  action: z.enum(['approve', 'reject']),
});

export const adminUpdateMatchStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'rejected']),
});

export const adminUpdateUserRoleSchema = z.object({
  role: z.enum(['user', 'admin']),
});

export const adminUpdateUserStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'suspended']),
});

export const adminAuditStatusQuerySchema = z.object({
  auditStatus: z.enum(['pending_moderation', 'pending_review', 'approved', 'rejected', 'dismissed', 'flagged_moderation']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

export type AdminStatusUpdate = z.infer<typeof adminStatusUpdateSchema>;
export type AdminMergePayload = z.infer<typeof adminMergeSchema>;
export type AdminModerate = z.infer<typeof adminModerateSchema>;
export type AdminUpdateMatchStatus = z.infer<typeof adminUpdateMatchStatusSchema>;
export type AdminUpdateUserRole = z.infer<typeof adminUpdateUserRoleSchema>;
export type AdminUpdateUserStatus = z.infer<typeof adminUpdateUserStatusSchema>;
