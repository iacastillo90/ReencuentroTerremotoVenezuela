import { PersonModel } from '../models/unified-person.model';
import { logger } from '../utils/logger.util';

const VISION_SERVICE_URL = process.env.VISION_SERVICE_URL || 'http://vision:8000';
const API_BASE_URL = process.env.API_BASE_URL || 'http://api:4000';

interface VisionResponse {
  face_detected: boolean;
  contains_minor?: boolean;
  faces?: Array<{ age_approx: number; age_range: string }>;
}

async function checkLopnna(imageUrl: string): Promise<VisionResponse | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.VISION_API_KEY) headers['x-vision-api-key'] = process.env.VISION_API_KEY;
    const response = await fetch(`${VISION_SERVICE_URL}/extract-face`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ image_url: imageUrl, timeout: 30 }),
      signal: AbortSignal.timeout(35000),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json() as VisionResponse;
  } catch (error: any) {
    logger.warn({ err: error, imageUrl }, '[LopnnaSweep] Error checking image');
    return null;
  }
}

export async function runLopnnaSweepJob(): Promise<void> {
  logger.info('[LopnnaSweep] Starting background sweep for historical LOPNNA compliance...');

  // Scan records that have photos but haven't been audited for minors yet.
  const query = {
    photoUrl: { $exists: true, $nin: [null, ''] },
    'metadata.containsMinor': { $exists: false }
  };

  const total = await PersonModel.countDocuments(query);
  if (total === 0) {
    logger.info('[LopnnaSweep] No pending records found. Database is LOPNNA compliant.');
    return;
  }

  logger.info({ total }, '[LopnnaSweep] Found pending records to scan for LOPNNA compliance');

  const cursor = PersonModel.find(query).cursor();
  let success = 0;
  let flagged = 0;

  for await (const person of cursor) {
    let imageUrl = person.photoUrl;
    if (!imageUrl) continue;
    
    // Convert relative URLs to absolute URLs so the vision service can fetch them
    if (imageUrl.startsWith('/api/media/')) {
      imageUrl = `${API_BASE_URL}${imageUrl}`;
    }

    const visionResult = await checkLopnna(imageUrl);
    
    if (visionResult) {
      let containsMinor = visionResult.contains_minor || false;
      const containsMinorAges: Array<{ age_range: string; age_approx: number }> = [];

      if (visionResult.faces) {
        for (const face of visionResult.faces) {
          if (face.age_approx && face.age_approx <= 20) {
            containsMinor = true;
            containsMinorAges.push({ age_range: face.age_range, age_approx: face.age_approx });
          }
        }
      }

      if (containsMinor) {
        await PersonModel.updateOne(
          { _id: person._id },
          { 
            $set: { 
              'metadata.containsMinor': true,
              'metadata.containsMinorAges': containsMinorAges,
              'metadata.auditStatus': 'flagged_moderation'
            } 
          }
        );
        flagged++;
        logger.info({ idHash: person.idHash, ages: containsMinorAges.map(a => a.age_approx) }, '[LopnnaSweep] Flagged historical record for LOPNNA moderation');
      } else {
        await PersonModel.updateOne(
          { _id: person._id },
          { 
            $set: { 
              'metadata.containsMinor': false,
              'metadata.containsMinorAges': []
            } 
          }
        );
      }
      success++;
    }
    
    // Small delay to prevent overwhelming the Vision microservice
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  logger.info({ success, flagged, total }, '[LopnnaSweep] Sweep completed successfully');
}
