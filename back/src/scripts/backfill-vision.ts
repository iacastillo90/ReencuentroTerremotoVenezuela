import mongoose from 'mongoose';
import { PersonModel } from '../models/unified-person.model';
import { MatchModel } from '../models/match.model';
import 'dotenv/config';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reencuentro';
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
      console.log(`[!] Vision error for ${imageUrl}: ${response.status}`);
      return null;
    }

    const result = await response.json();
    if (!result.face_detected || !result.face_encoding) {
      console.log(`[-] No face detected in ${imageUrl}`);
      return null;
    }

    return result.face_encoding;
  } catch (error: any) {
    console.log(`[!] Error extracting face for ${imageUrl}:`, error.message);
    return null;
  }
}

async function runBackfill() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.');

  // Find people with a photo but no biometricHash
  const query = {
    photoUrl: { $exists: true, $ne: null, $ne: '' },
    'metadata.biometricHash': { $exists: false }
  };

  const total = await PersonModel.countDocuments(query);
  console.log(`Found ${total} persons to process.`);

  const cursor = PersonModel.find(query).cursor();
  let count = 0;
  let success = 0;

  for await (const person of cursor) {
    count++;
    console.log(`\n[${count}/${total}] Processing ${person.name} (${person.idHash})`);
    
    let imageUrl = person.photoUrl;
    if (imageUrl.startsWith('/api/media/')) {
      imageUrl = `${API_BASE_URL}${imageUrl}`;
    }

    const faceEncoding = await extractFaceEncoding(imageUrl);
    
    if (faceEncoding && faceEncoding.length > 0) {
      const buffer = Buffer.from(new Float32Array(faceEncoding).buffer);
      const biometricHash = require('crypto').createHash('sha256').update(buffer).digest('hex').substring(0, 16);
      
      // Comprobar si ya existe alguien con este hash
      const existingDuplicate = await PersonModel.findOne({ 'metadata.biometricHash': biometricHash });

      // Update the person with the new hash and encoding
      await PersonModel.updateOne(
        { _id: person._id },
        { 
          $set: { 
            faceEncoding: faceEncoding,
            'metadata.biometricHash': biometricHash
          } 
        }
      );
      console.log(`[+] Success! Assigned hash: ${biometricHash}`);
      success++;

      // Si existe un duplicado, crear un caso de auditoría manual (Match)
      if (existingDuplicate) {
        // En lugar de llamar a addToOutbox, insertamos directamente en MatchModel
        // ya que esto es un script offline.
        await MatchModel.create({
          reportId: person.idHash,
          matchedPersonId: existingDuplicate.idHash,
          score: 1.0,
          status: 'revisar' // Para que aparezca en el UI
        });
        console.log(`[*] Discovered duplicate! Created manual audit match against ${existingDuplicate.idHash}`);
      }
    }
    
    // Add a small delay to avoid hammering the vision service
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\nBackfill complete! Successfully processed ${success} out of ${total} records.`);
  process.exit(0);
}

runBackfill().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
