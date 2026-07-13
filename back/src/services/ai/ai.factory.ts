/**
 * services/ai/ai.factory — Fábrica de proveedores de IA
 *
 * PROPÓSITO:
 *   Provee una función factory que retorna la implementación concreta
 *   del proveedor de IA según la variable de entorno AI_PROVIDER.
 *
 * CARACTERÍSTICAS:
 *   - Soporta anthropic (default), openai y gemini
 *   - Fácil extensión: solo agregar nuevo case al switch
 *
 * @module ai.factory
 */

import { IAIProvider } from './ai.interface';
import { AnthropicProvider } from './anthropic.service';
import { OpenAIProvider } from './openai.service';
import { GeminiProvider } from './gemini.service';

export function getAIProvider(): IAIProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase() || 'anthropic';

  switch (provider) {
    case 'openai':
      return new OpenAIProvider();
    case 'gemini':
      return new GeminiProvider();
    case 'anthropic':
    default:
      return new AnthropicProvider();
  }
}
