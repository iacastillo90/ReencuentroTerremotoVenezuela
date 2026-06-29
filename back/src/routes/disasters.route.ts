import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { DisasterEventModel } from '../models/disaster-event.model';

const router = Router();

const disasterQuerySchema = z.object({
  type: z.enum(['earthquake', 'flood', 'fire', 'hurricane', 'landslide', 'social']).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  lat: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
  lng: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
  radius: z.string().regex(/^\d+(\.\d+)?$/).optional(),
});

// GET /api/disasters
router.get('/', async (req: Request, res: Response) => {
  try {
    const queryValidation = disasterQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: queryValidation.error.issues });
    }

    const { lat, lng, radius, type, from, to } = queryValidation.data;
    
    const filter: any = {};
    
    // Filtrar por tipo (earthquake, flood, etc.)
    if (type) {
      filter.type = type;
    }
    
    // Filtrar por fechas
    if (from || to) {
      filter.occurredAt = {};
      if (from) filter.occurredAt.$gte = new Date(from as string);
      if (to) filter.occurredAt.$lte = new Date(to as string);
    }

    // Filtro geoespacial ($near)
    if (lat && lng && radius) {
      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);
      const radiusMeters = parseFloat(radius as string) * 1000; // Convert km to meters
      
      filter.coordinates = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude] // MongoDB espera [lng, lat]
          },
          $maxDistance: radiusMeters
        }
      };
    }

    const disasters = await DisasterEventModel.find(filter)
      .limit(100)
      .sort(lat && lng ? undefined : { occurredAt: -1 }) // $near automatically sorts by distance
      .lean();

    return res.status(200).json(disasters);
  } catch (error) {
    console.error('[DisastersRoute] GET / Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/disasters/active
router.get('/active', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    // Considerar como activo si validUntil está en el futuro,
    // o si no tiene validUntil y ocurrió hace menos de 7 días
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

    return res.status(200).json(disasters);
  } catch (error) {
    console.error('[DisastersRoute] GET /active Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export const disastersRouter = router;
