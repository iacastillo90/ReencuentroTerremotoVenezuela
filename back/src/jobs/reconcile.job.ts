import { PersonModel } from '../models/unified-person.model';
import { DisasterEventModel } from '../models/disaster-event.model';
import { distance } from 'fastest-levenshtein';
import mongoose from 'mongoose';

// Calculamos la similitud en porcentaje entre dos strings usando Levenshtein
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return (maxLen - distance(a, b)) / maxLen;
}

export async function runGeospatialCrossover() {
  console.log('[Reconcile] Iniciando cruce geoespacial...');
  
  // Buscar personas con coordenadas válidas pero sin desastres vinculados aún
  const persons = await PersonModel.find({
    'lastSeen.coordinates': { $exists: true, $ne: null },
    possiblyRelatedDisasters: { $size: 0 }
  }).limit(500); // Procesar en lotes de 500

  let updatedCount = 0;

  for (const person of persons) {
    if (!person.lastSeen?.coordinates) continue;

    const coords = person.lastSeen.coordinates.coordinates;

    // Buscar desastres numéricamente cerca (radio de ~50km)
    // 50km aprox = 50000 metros en $maxDistance
    const nearbyDisasters = await DisasterEventModel.find({
      coordinates: {
        $near: {
          $geometry: { type: 'Point', coordinates: coords },
          $maxDistance: 50000 
        }
      }
    });

    if (nearbyDisasters.length > 0) {
      person.possiblyRelatedDisasters = nearbyDisasters.map(d => d._id as mongoose.Types.ObjectId);
      
      // Aumentar la urgencia si hay un desastre crítico cerca
      const hasHighSeverity = nearbyDisasters.some(d => d.severity === 'high' || d.severity === 'critical');
      if (hasHighSeverity) {
        person.metadata.urgencyScore = Math.min(100, person.metadata.urgencyScore + 15);
      }

      await person.save();
      updatedCount++;
    }
  }

  console.log(`[Reconcile] Cruce geoespacial completado. ${updatedCount} personas vinculadas a desastres.`);
}

export async function runFuzzyMatching() {
  console.log('[Reconcile] Iniciando fuzzy matching para detectar duplicados...');
  
  // Traer personas que no han sido auditadas todavía
  const candidates = await PersonModel.find({
    'metadata.auditStatus': 'clean'
  }).limit(1000).lean();

  let duplicatesFound = 0;

  for (let i = 0; i < candidates.length; i++) {
    const current = candidates[i];
    
    // Comparar con el resto
    for (let j = i + 1; j < candidates.length; j++) {
      const other = candidates[j];
      
      // Mismo status y estado (geográfico) para limitar los falsos positivos
      if (current.status !== other.status || current.lastSeen?.state !== other.lastSeen?.state) continue;

      const nameSim = similarity(current.normalizedName, other.normalizedName);
      
      // Si la similitud es mayor al 85%
      if (nameSim > 0.85) {
        duplicatesFound++;
        
        // Aquí deberíamos enviarlo a una cola de revisión (auditQueue), 
        // por ahora lo marcaremos en la BD
        await PersonModel.updateMany(
          { _id: { $in: [current._id, other._id] } },
          { $set: { 'metadata.auditStatus': 'pending_review' } }
        );
      }
    }
  }

  console.log(`[Reconcile] Fuzzy matching completado. ${duplicatesFound} posibles duplicados detectados (auditStatus = pending_review).`);
}
