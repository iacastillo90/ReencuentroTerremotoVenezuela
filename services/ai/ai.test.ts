import { AnthropicProvider } from './anthropic.service';
import { OpenAIProvider } from './openai.service';
import { GeminiProvider } from './gemini.service';
import { getAIProvider } from './ai.factory';

// Mocks
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"name": "Juan", "estado": "Zulia", "safeDescription": "Mocked Anthropic", "medicalStatus": "estable", "urgencyScore": 10}' }]
      })
    }
  }));
});

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '{"name": "Juan", "estado": "Zulia", "safeDescription": "Mocked OpenAI", "medicalStatus": "herido", "urgencyScore": 50}' } }]
        })
      }
    }
  }));
});

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn().mockResolvedValue({
        text: '{"name": "Juan", "estado": "Zulia", "safeDescription": "Mocked Gemini", "medicalStatus": "crisis", "urgencyScore": 90}'
      })
    }
  }))
}));

describe('AI Services', () => {
  const dummyText = 'Test input data';

  afterEach(() => {
    delete process.env.AI_PROVIDER;
  });

  describe('AnthropicProvider', () => {
    it('should parse response correctly', async () => {
      const provider = new AnthropicProvider('dummy');
      const result = await provider.processRecord(dummyText);
      expect(result.safeDescription).toBe('Mocked Anthropic');
      expect(result.medicalStatus).toBe('estable');
      expect(result.urgencyScore).toBe(10);
    });
  });

  describe('OpenAIProvider', () => {
    it('should parse response correctly', async () => {
      const provider = new OpenAIProvider('dummy');
      const result = await provider.processRecord(dummyText);
      expect(result.safeDescription).toBe('Mocked OpenAI');
      expect(result.medicalStatus).toBe('herido');
      expect(result.urgencyScore).toBe(50);
    });
  });

  describe('GeminiProvider', () => {
    it('should parse response correctly', async () => {
      const provider = new GeminiProvider('dummy');
      const result = await provider.processRecord(dummyText);
      expect(result.safeDescription).toBe('Mocked Gemini');
      expect(result.medicalStatus).toBe('crisis');
      expect(result.urgencyScore).toBe(90);
    });
  });

  describe('Factory getAIProvider', () => {
    it('should return Anthropic by default', () => {
      const provider = getAIProvider();
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it('should return OpenAI when env is set', () => {
      process.env.AI_PROVIDER = 'openai';
      const provider = getAIProvider();
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should return Gemini when env is set', () => {
      process.env.AI_PROVIDER = 'gemini';
      const provider = getAIProvider();
      expect(provider).toBeInstanceOf(GeminiProvider);
    });
  });
});
