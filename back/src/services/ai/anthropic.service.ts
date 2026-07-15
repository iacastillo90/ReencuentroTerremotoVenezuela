/**
 * services/ai/anthropic.service — Proveedor de IA Anthropic (Claude)
 *
 * PROPÓSITO:
 *   Implementa IAIProvider usando el SDK de Anthropic para procesar
 *   reportes de texto libre con Claude.
 *
 * CARACTERÍSTICAS:
 *   - processRecord: extrae datos estructurados de texto libre
 *   - transcribeAudio: lanza error (Anthropic no soporta audio nativo)
 *   - Limpia wrappers markdown del JSON de respuesta
 *
 * @module anthropic.service
 */

import Anthropic from '@anthropic-ai/sdk';
import { IAIProvider, AIProcessResult, SYSTEM_PROMPT } from './ai.interface';
import { logger } from '../../utils/logger.util';

export class AnthropicProvider implements IAIProvider {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY || 'dummy' });
  }

  async processRecord(rawData: string): Promise<AIProcessResult> {
    try {
      // El identificador del modelo se define por entorno (no se versiona),
      // así el repositorio público no fija un modelo concreto.
      const model = process.env.ANTHROPIC_MODEL;
      if (!model) {
        throw new Error('Define ANTHROPIC_MODEL en el .env para usar el proveedor de IA de Anthropic.');
      }
      const response = await this.client.messages.create({
        model,
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: rawData }]
      });

      let text = '';
      if (response.content && response.content[0] && response.content[0].type === 'text') {
        text = response.content[0].text;
      }
      
      // Clean possible markdown wrapper if model ignores instructions
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(text) as AIProcessResult;
    } catch (error) {
      logger.error({ err: error }, 'Anthropic Error');
      throw error;
    }
  }

  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
    throw new Error('Anthropic no soporta transcripción de audio nativa. Por favor cambia AI_PROVIDER a gemini o openai en el .env');
  }
}
