import { DisasterEventModel, IDisasterEvent } from '../models/disaster-event.model';
import { Types } from 'mongoose';

export async function findNearbyDisasters(
  coordinates: [number, number], // [lng, lat]
  radiusKm: number = 30
): Promise<IDisasterEvent[]> {
  const radiusMeters = radiusKm * 1000;
  
  // Buscar desastres recientes (últimos 7 días) o que aún estén activos
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const disasters = await DisasterEventModel.find({
    coordinates: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: radiusMeters
      }
    },
    $or: [
      { validUntil: { $gte: new Date() } },
      { validUntil: { $exists: false }, occurredAt: { $gte: sevenDaysAgo } }
    ]
  }).lean();

  return disasters as IDisasterEvent[];
}

export function calculateDisasterUrgencyBonus(events: IDisasterEvent[]): number {
  if (!events || events.length === 0) return 0;

  // Calculamos el bonus basado en el evento más severo
  const severityBonusMap: Record<string, number> = {
    critical: 40,
    high: 25,
    medium: 10,
    low: 5
  };

  let maxBonus = 0;
  for (const event of events) {
    const bonus = severityBonusMap[event.severity] || 0;
    if (bonus > maxBonus) {
      maxBonus = bonus;
    }
  }

  return maxBonus;
}
