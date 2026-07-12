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
