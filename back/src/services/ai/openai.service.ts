/**
 * services/ai/openai.service — Proveedor de IA OpenAI (GPT-4)
 *
 * PROPÓSITO:
 *   Implementa IAIProvider usando el SDK de OpenAI para procesar
 *   reportes de texto y transcribir audio con Whisper.
 *
 * CARACTERÍSTICAS:
 *   - processRecord: extrae datos estructurados con response_format json_object
 *   - transcribeAudio: transcripción con Whisper-1 (español)
 *
 * @module openai.service
 */

import OpenAI from 'openai';
import { IAIProvider, AIProcessResult, SYSTEM_PROMPT } from './ai.interface';
import { logger } from '../../utils/logger.util';

export class OpenAIProvider implements IAIProvider {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY || 'dummy' });
  }

  async processRecord(rawData: string): Promise<AIProcessResult> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4-turbo',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: rawData }
        ]
      });

      const text = response.choices[0].message.content || '{}';
      return JSON.parse(text) as AIProcessResult;
    } catch (error) {
      logger.error({ err: error }, 'OpenAI Error');
      throw error;
    }
  }

  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
    // OpenAI requiere un stream o un objeto con path/name para su API.
    // Usaremos un File object simulado mediante form-data o fetch nativo,
    // o simplemente usando su SDK oficial con un buffer.
    const file = new File([new Uint8Array(audioBuffer)], "audio.webm", { type: mimeType });
    try {
      const response = await this.client.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'es'
      });
      return response.text;
    } catch (error) {
      logger.error({ err: error }, 'OpenAI Transcription Error');
      throw new Error('No se pudo transcribir el audio usando OpenAI Whisper.');
    }
  }
}
