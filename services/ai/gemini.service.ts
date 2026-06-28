import { GoogleGenAI } from '@google/genai';
import { IAIProvider, AIProcessResult, SYSTEM_PROMPT } from './ai.interface';

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
      console.error('Gemini Error:', error);
      throw error;
    }
  }
}
