import Anthropic from '@anthropic-ai/sdk';
import { IAIProvider, AIProcessResult, SYSTEM_PROMPT } from './ai.interface';

export class AnthropicProvider implements IAIProvider {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY || 'dummy' });
  }

  async processRecord(rawData: string): Promise<AIProcessResult> {
    try {
      const response = await this.client.messages.create({
        model: 'Anthropic-3-sonnet-20240229',
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
      console.error('Anthropic Error:', error);
      throw error;
    }
  }
}
