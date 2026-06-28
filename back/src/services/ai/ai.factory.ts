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
