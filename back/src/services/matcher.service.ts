import { PersonModel } from '../models/unified-person.model';
import { SearchRequestModel } from '../models/search-request.model';
import { MatchModel } from '../models/match.model';

/**
 * Servicio básico de matching. En el futuro esto puede ser reemplazado
 * por búsquedas vectoriales (embeddings) o IA real.
 */
export async function runMatchingForSearchRequest(searchRequestId: string) {
  try {
    const request = await SearchRequestModel.findById(searchRequestId);
    if (!request || request.status !== 'activa') return;

    // Buscar personas cuyo nombre coincida parcialmente
    // Esto es un mock de similitud semántica.
    const queryTokens = request.searchName.toLowerCase().split(' ').filter(t => t.length > 2);
    
    if (queryTokens.length === 0) return;

    const regex = new RegExp(queryTokens.join('|'), 'i');
    
    // Buscar personas que estén desaparecidas o que hayan sido reportadas.
    // Lo ideal es cruzar contra todos los registros.
    const candidates = await PersonModel.find({
      $or: [
        { name: regex },
        { description: regex },
        { normalizedName: regex }
      ]
    }).lean();

    for (const candidate of candidates) {
      // Calcular un "score" muy básico
      let score = 0.5;
      const cName = candidate.name.toLowerCase();
      
      // Si coinciden múltiples tokens, aumentar score
      let matches = 0;
      for (const token of queryTokens) {
        if (cName.includes(token)) matches++;
      }
      
      score += (matches / queryTokens.length) * 0.4; // Max 0.9

      // Guardar el match
      await MatchModel.findOneAndUpdate(
        { reportId: candidate.idHash, searchRequestId: request._id },
        { score, status: score > 0.8 ? 'probable' : 'posible' },
        { upsert: true, new: true }
      );
    }
    
    console.log(`[Matcher] Encontrados ${candidates.length} candidatos para SearchRequest ${searchRequestId}`);

  } catch (error) {
    console.error('[Matcher] Error running matching:', error);
  }
}

export async function runMatchingForNewPerson(personIdHash: string) {
  try {
    const person = await PersonModel.findOne({ idHash: personIdHash }).lean();
    if (!person) return;

    const pNameTokens = person.name.toLowerCase().split(' ').filter(t => t.length > 2);
    if (pNameTokens.length === 0) return;
    
    const regex = new RegExp(pNameTokens.join('|'), 'i');

    const activeRequests = await SearchRequestModel.find({
      status: 'activa',
      $or: [
        { searchName: regex },
        { description: regex }
      ]
    });

    for (const request of activeRequests) {
      await MatchModel.findOneAndUpdate(
        { reportId: person.idHash, searchRequestId: request._id },
        { score: 0.7, status: 'posible' }, // Dummy score
        { upsert: true, new: true }
      );
    }

  } catch (error) {
    console.error('[Matcher] Error running matching for new person:', error);
  }
}
