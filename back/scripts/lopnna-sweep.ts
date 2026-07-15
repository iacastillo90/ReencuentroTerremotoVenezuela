import mongoose from 'mongoose';
import { PersonModel } from '../src/models/unified-person.model';
import 'dotenv/config';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reencuentro';
const VISION_SERVICE_URL = process.env.VISION_SERVICE_URL || 'http://vision:8000';
const API_BASE_URL = process.env.API_BASE_URL || 'http://api:4000';

async function checkLopnna(imageUrl: string) {
  try {
    const response = await fetch(`${VISION_SERVICE_URL}/extract-face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, timeout: 30 }),
      signal: AbortSignal.timeout(35000),
    });

    if (!response.ok) return null;

    const result = await response.json();
    return {
      containsMinor: result.contains_minor || false,
      faces: result.faces || []
    };
  } catch (error: any) {
    console.log(`[!] Error in vision for ${imageUrl}:`, error.message);
    return null;
  }
}

async function runLopnnaSweep() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.');

  // Find all people with a photo that haven't been audited for LOPNNA yet
  const query = {
    photoUrl: { $exists: true, $nin: [null, ''] },
    'metadata.containsMinor': { $exists: false }
  };

  const total = await PersonModel.countDocuments(query);
  console.log(`Found ${total} persons to scan for LOPNNA compliance.`);

  const cursor = PersonModel.find(query).cursor();
  let count = 0;
  let flagged = 0;

  for await (const person of cursor) {
    count++;
    process.stdout.write(`\r[${count}/${total}] Scanning ${person.idHash}... `);
    
    let imageUrl = person.photoUrl;
    if (!imageUrl) continue;
    
    if (imageUrl.startsWith('/api/media/')) {
      imageUrl = `${API_BASE_URL}${imageUrl}`;
    }

    const visionResult = await checkLopnna(imageUrl);
    
    if (visionResult) {
      let containsMinor = visionResult.containsMinor;
      const containsMinorAges: Array<{ age_range: string; age_approx: number }> = [];

      for (const face of visionResult.faces) {
        if (face.age_approx && face.age_approx < 18) {
          containsMinor = true;
          containsMinorAges.push({ age_range: face.age_range, age_approx: face.age_approx });
        }
      }

      if (containsMinor) {
        flagged++;
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
        console.log(`\n[!] FLAGGED MINOR: ${person.name} (${containsMinorAges.map(a => a.age_approx).join(', ')} yrs)`);
      } else {
        // Mark as processed but clean
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
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log(`\nLOPNNA Sweep complete! Flagged ${flagged} minors out of ${total} scanned.`);
  process.exit(0);
}

runLopnnaSweep().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
