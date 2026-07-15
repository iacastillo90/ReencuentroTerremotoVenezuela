import { PersonModel } from '../models/unified-person.model';
import { MatchModel } from '../models/match.model';
import { logger } from '../utils/logger.util';

const VISION_SERVICE_URL = process.env.VISION_SERVICE_URL || 'http://vision:8000';
const API_BASE_URL = process.env.API_BASE_URL || 'http://api:4000';

async function extractFaceEncoding(imageUrl: string): Promise<number[] | null> {
  try {
    const response = await fetch(`${VISION_SERVICE_URL}/extract-face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, timeout: 30 }),
      signal: AbortSignal.timeout(35000),
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    if (!result.face_detected || !result.face_encoding) {
      return null;
    }

    return result.face_encoding;
  } catch (error: any) {
    logger.warn({ err: error, imageUrl }, '[BiometricSweep] Error extracting face');
    return null;
  }
}

export async function runBiometricSweepJob(): Promise<void> {
  logger.info('[BiometricSweep] Starting 12-hour sanitation sweep...');

  const query = {
    photoUrl: { $exists: true, $nin: [null, ''] },
    'metadata.biometricHash': { $exists: false }
  };

  const total = await PersonModel.countDocuments(query);
  if (total === 0) {
    logger.info('[BiometricSweep] No orphan records found. Database is sanitized.');
    return;
  }

  logger.info({ total }, '[BiometricSweep] Found orphan records to process');

  const cursor = PersonModel.find(query).cursor();
  let success = 0;

  for await (const person of cursor) {
    let imageUrl = person.photoUrl;
    if (!imageUrl) continue;
    
    if (imageUrl.startsWith('/api/media/')) {
      imageUrl = `${API_BASE_URL}${imageUrl}`;
    }

    const faceEncoding = await extractFaceEncoding(imageUrl);
    
    if (faceEncoding && faceEncoding.length > 0) {
      const buffer = Buffer.from(new Float32Array(faceEncoding).buffer);
      const biometricHash = require('crypto').createHash('sha256').update(buffer).digest('hex').substring(0, 16);
      
      const existingDuplicate = await PersonModel.findOne({ 'metadata.biometricHash': biometricHash }).lean();

      await PersonModel.updateOne(
        { _id: person._id },
        { 
          $set: { 
            faceEncoding: faceEncoding,
            'metadata.biometricHash': biometricHash
          } 
        }
      );
      success++;

      if (existingDuplicate && existingDuplicate.idHash !== person.idHash) {
        await MatchModel.create({
          reportId: person.idHash,
          matchedPersonId: existingDuplicate.idHash,
          score: 1.0,
          status: 'revisar'
        });
        logger.info({ new: person.idHash, existing: existingDuplicate.idHash }, '[BiometricSweep] Found historical duplicate');
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  logger.info({ success, total }, '[BiometricSweep] Sweep completed successfully');
}
