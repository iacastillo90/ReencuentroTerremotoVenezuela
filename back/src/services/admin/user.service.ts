/**
 * services/admin/user.service — Gestión administrativa de usuarios
 *
 * PROPÓSITO:
 *   Provee operaciones administrativas sobre usuarios: consulta paginada,
 *   actualización de roles y estados.
 *
 * CARACTERÍSTICAS:
 *   - getAdminUsers: lista usuarios (-passwordHash) paginada
 *   - updateUserRole: cambia rol (user/verifier/admin)
 *   - updateUserStatus: cambia estado (pending/approved/rejected)
 *   - Audit logging de todas las acciones
 *
 * @module user.service
 */

import { UserModel } from '../../models/user.model';
import { auditLog } from '../../middlewares/audit.middleware';
import type { Request } from 'express';

const VALID_ROLES = ['user', 'verifier', 'admin'] as const;
const VALID_STATUSES = ['pending', 'approved', 'rejected'] as const;

export async function getAdminUsers(limit: number, offset: number) {
  const [users, total] = await Promise.all([
    UserModel.find({}, '-passwordHash').sort({ createdAt: -1 }).skip(offset).limit(limit),
    UserModel.countDocuments({}),
  ]);
  return { total, limit, offset, users };
}

export async function updateUserRole(id: string, role: string, actor: string, req: Request) {
  if (!VALID_ROLES.includes(role as any)) {
    return { status: 400, error: 'Rol inválido' };
  }

  if (id === actor) {
    return { status: 403, error: 'No puedes cambiar tu propio rol' };
  }

  const user = await UserModel.findByIdAndUpdate(id, { role }, { new: true });
  if (!user) return { status: 404, error: 'Usuario no encontrado' };

  auditLog({
    eventType: 'admin_action',
    severity: 'info',
    actor,
    action: 'PATCH /admin/users/:id/role',
    resource: id,
    detail: { newRole: role },
    req,
  });

  return { status: 200, data: user };
}

export async function updateUserStatus(id: string, status: string, actor: string, req: Request) {
  if (!VALID_STATUSES.includes(status as any)) {
    return { status: 400, error: 'Estado inválido' };
  }

  if (id === actor) {
    return { status: 403, error: 'No puedes cambiar tu propio estado' };
  }

  const user = await UserModel.findByIdAndUpdate(id, { status }, { new: true });
  if (!user) return { status: 404, error: 'Usuario no encontrado' };

  auditLog({
    eventType: 'admin_action',
    severity: 'info',
    actor,
    action: 'PATCH /admin/users/:id/status',
    resource: id,
    detail: { newStatus: status },
    req,
  });

  return { status: 200, data: user };
}

export function getVerifications() {
  return [];
}
