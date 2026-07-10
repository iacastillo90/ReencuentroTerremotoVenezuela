import { Router, Request, Response, NextFunction } from 'express';
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
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryValidation = disasterQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: queryValidation.error.issues });
    }

    const { lat, lng, radius, type, from, to } = queryValidation.data;
    
    const filter: any = {};
    
    if (type) {
      filter.type = type;
    }
    
    if (from || to) {
      filter.occurredAt = {};
      if (from) filter.occurredAt.$gte = new Date(from as string);
      if (to) filter.occurredAt.$lte = new Date(to as string);
    }

    if (lat && lng && radius) {
      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);
      const radiusMeters = parseFloat(radius as string) * 1000;
      
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

    return res.status(200).json(disasters);
  } catch (error) {
    next(error);
  }
});

// GET /api/disasters/active
router.get('/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
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

    return res.status(200).json(disasters);
  } catch (error) {
    next(error);
  }
});

export const disastersRouter = router;
