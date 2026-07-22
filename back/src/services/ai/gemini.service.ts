/**
 * services/ai/gemini.service — Proveedor de IA Google Gemini
 *
 * PROPÓSITO:
 *   Implementa IAIProvider usando el SDK de Google GenAI para procesar
 *   reportes de texto, transcribir audio y analizar imágenes.
 *
 * CARACTERÍSTICAS:
 *   - processRecord: extrae datos estructurados (usa responseMimeType JSON)
 *   - transcribeAudio: transcripción nativa de archivos de audio
 *   - analyzeImageDraft: separa rasgos permanentes de ropa/accesorios
 *   - generateEmbedding: genera embeddings con text-embedding-004
 *
 * @module gemini.service
 */

import { GoogleGenAI } from '@google/genai';
import { IAIProvider, AIProcessResult, ImageDraftAnalysis, SYSTEM_PROMPT } from './ai.interface';
import { logger } from '../../utils/logger.util';

export class GeminiProvider implements IAIProvider {
  private client: GoogleGenAI;

  constructor(apiKey?: string) {
    this.client = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY || 'dummy' });
  }

  async processRecord(rawData: string): Promise<AIProcessResult> {
    try {
      const response = await this.client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: rawData,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
        }
      });

      const text = response.text;
      if (!text) throw new Error('No text returned from Gemini');
      
      return JSON.parse(text) as AIProcessResult;
    } catch (error) {
      logger.error({ err: error }, 'Gemini Error');
      throw error;
    }
  }

  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
    try {
      const response = await this.client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: audioBuffer.toString('base64'),
                  mimeType: mimeType
                }
              },
              {
                text: 'Transcribe exactamente lo que se dice en este audio, palabra por palabra, en el idioma en que fue hablado. Solo devuelve el texto transcrito, sin comentarios adicionales.'
              }
            ]
          }
        ]
      });

      return response.text || '';
    } catch (error) {
      logger.error({ err: error }, 'Gemini Transcription Error');
      throw new Error('No se pudo transcribir el audio usando Gemini.');
    }
  }

  async analyzeImageDraft(imageBuffer: Buffer, mimeType: string): Promise<ImageDraftAnalysis> {
    try {
      const prompt = `
Analiza la siguiente imagen de una persona desaparecida. Tu objetivo es separar los rasgos PERMANENTES de los PASAJEROS (ropa).
Devuelve estrictamente un JSON con esta estructura:
{
  "permanentFeatures": "Descripción física (edad aproximada, sexo, color de piel, color de cabello, marcas, lentes médicos si parece usarlos siempre)",
  "clothingQuestion": "Si detectas ropa o accesorios evidentes, formula una pregunta amigable corta. Ejemplo: 'He notado que en la foto lleva una chaqueta roja. ¿Llevaba esta misma ropa al momento de desaparecer?' Si no se ve ropa clara, devuelve null."
}
No agregues comentarios ni markdown fuera del JSON.
      `;

      const response = await this.client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType: mimeType
            }
          },
          { text: prompt }
        ],
        config: {
          responseMimeType: 'application/json',
        }
      });

      const text = response.text || '{}';
      return JSON.parse(text) as ImageDraftAnalysis;
    } catch (error) {
      logger.error({ err: error }, 'Gemini Image Analysis Error');
      throw new Error('No se pudo analizar la imagen usando Gemini.');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.models.embedContent({
        model: 'gemini-embedding-2',
        contents: text
      });
      return response.embeddings?.[0]?.values || [];
    } catch (error) {
      logger.error({ err: error }, 'Gemini Embedding Error');
      throw new Error('No se pudo generar el embedding con Gemini.');
    }
  }
}
