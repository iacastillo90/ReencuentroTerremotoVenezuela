import { DisasterEventModel } from '../models/disaster-event.model';
import { z } from 'zod';

export const disasterQuerySchema = z.object({
  type: z.enum(['earthquake', 'flood', 'fire', 'hurricane', 'landslide', 'social']).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  lat: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
  lng: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
  radius: z.string().regex(/^\d+(\.\d+)?$/).optional(),
});

export async function queryDisasters(params: z.infer<typeof disasterQuerySchema>) {
  const { lat, lng, radius, type, from, to } = params;

  const filter: any = {};

  if (type) {
    filter.type = type;
  }

  if (from || to) {
    filter.occurredAt = {};
    if (from) filter.occurredAt.$gte = new Date(from);
    if (to) filter.occurredAt.$lte = new Date(to);
  }

  if (lat && lng && radius) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusMeters = parseFloat(radius) * 1000;

    filter.coordinates = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: radiusMeters
      }
    };
  }

  const disasters = await DisasterEventModel.find(filter)
    .limit(100)
    .sort(lat && lng ? undefined : { occurredAt: -1 })
    .lean();

  return disasters;
}

export async function getActiveDisasters() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const activeFilter = {
    $or: [
      { validUntil: { $gte: now } },
      { validUntil: { $exists: false }, occurredAt: { $gte: sevenDaysAgo } }
    ]
  };

  const disasters = await DisasterEventModel.find(activeFilter)
    .limit(100)
    .sort({ occurredAt: -1 })
    .lean();

  return disasters;
}
