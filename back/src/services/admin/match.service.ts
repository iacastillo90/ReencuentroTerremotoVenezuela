import { MatchModel } from '../../models/match.model';
import { auditLog } from '../../middlewares/audit.middleware';
import type { Request } from 'express';

export async function getAdminMatches(limit: number, offset: number) {
  const total = await MatchModel.countDocuments({ status: { $in: ['posible', 'probable', 'revisar'] } });

  const matches = await MatchModel.aggregate([
    { $match: { status: { $in: ['posible', 'probable', 'revisar'] } } },
    { $sort: { score: -1 } },
    { $skip: offset },
    { $limit: limit },
    {
      $lookup: {
        from: 'unifiedpersons',
        localField: 'person',
        foreignField: '_id',
        as: 'person'
      }
    },
    { $unwind: { path: '$person', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'unifiedpersons',
        localField: 'matchedPerson',
        foreignField: '_id',
        as: 'matchedPerson'
      }
    },
    { $unwind: { path: '$matchedPerson', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'searchrequests',
        localField: 'searchRequestId',
        foreignField: '_id',
        as: 'searchRequestId'
      }
    },
    { $unwind: { path: '$searchRequestId', preserveNullAndEmptyArrays: true } },
  ]);
  return { data: matches, total, limit, offset };
}

export async function updateMatchStatus(id: string, status: string, actor: string, req: Request) {
  const match = await MatchModel.findByIdAndUpdate(id, { status }, { new: true });
  if (!match) return { status: 404, error: 'Coincidencia no encontrada' };

  auditLog({
    eventType: 'admin_action',
    severity: 'info',
    actor,
    action: 'PATCH /admin/matches/:id/status',
    resource: id,
    detail: { newStatus: status },
    req,
  });

  return { status: 200, data: match };
}
