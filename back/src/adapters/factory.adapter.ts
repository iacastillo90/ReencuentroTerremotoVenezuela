/**
 * adapters/factory.adapter — Fábrica y registro de adaptadores de fuentes
 *
 * PROPÓSITO:
 *   Mantiene un registro centralizado de adaptadores disponibles y provee
 *   una función factory para obtener la instancia correcta según la fuente.
 *
 * CARACTERÍSTICAS:
 *   - Registro basado en mapa clave → instancia de adaptador
 *   - Error temprano si se solicita una fuente no registrada
 *   - Fácil extensión: solo agregar al registry
 *
 * @module factory.adapter
 */

import { ISourceAdapter } from './base.adapter';
import { ReencuentroAdapter } from './reencuentro.adapter';
import { VenezuelaReportaAdapter } from './venezuelareporta.adapter';

const registry: Record<string, ISourceAdapter> = {
  'reencuentro-api': new ReencuentroAdapter(),
  'venezuelareporta': new VenezuelaReportaAdapter(),
};

export function getAdapter(source: string): ISourceAdapter {
  const adapter = registry[source];
  if (!adapter) {
    throw new Error(`No adapter registered for source: ${source}`);
  }
  return adapter;
}

export function registerAdapter(source: string, adapter: ISourceAdapter): void {
  registry[source] = adapter;
}
