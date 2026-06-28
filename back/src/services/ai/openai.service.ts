import OpenAI from 'openai';
import { IAIProvider, AIProcessResult, SYSTEM_PROMPT } from './ai.interface';

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
      console.error('OpenAI Error:', error);
      throw error;
    }
  }
}
