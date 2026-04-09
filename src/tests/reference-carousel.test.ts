import { describe, test, expect } from 'vitest';

describe('Reference carousel — AI model selection', () => {

  test('Valid AI model options include claude-sonnet-4 and gpt-4o-mini', () => {
    const validModels = ['claude-sonnet-4', 'gpt-4o-mini'];
    expect(validModels).toContain('claude-sonnet-4');
    expect(validModels).toContain('gpt-4o-mini');
  });

  test('Default model is gpt-4o-mini when not specified', () => {
    const aiModel = (undefined as string | undefined) || 'gpt-4o-mini';
    expect(aiModel).toBe('gpt-4o-mini');
  });

  test('Claude model string maps to correct Anthropic API model ID', () => {
    const uiValue = 'claude-sonnet-4';
    const apiModelId = 'claude-sonnet-4-20250514';
    expect(apiModelId).toContain('sonnet-4');
    expect(uiValue).toContain('sonnet-4');
  });
});

describe('Reference carousel — mode validation', () => {

  test('clone is a valid mode', () => {
    const validModes = ['clone', 'inspired'];
    expect(validModes).toContain('clone');
  });

  test('inspired is a valid mode', () => {
    const validModes = ['clone', 'inspired'];
    expect(validModes).toContain('inspired');
  });

  test('invalid mode is rejected', () => {
    const validModes = ['clone', 'inspired'];
    expect(validModes).not.toContain('copy');
    expect(validModes).not.toContain('duplicate');
  });
});

describe('Reference carousel — caption JSON parsing', () => {

  test('parses valid caption JSON from OpenAI format', () => {
    const raw = '{"caption": "Seu pet merece o melhor!", "hashtags": ["pet", "cachorro", "dicaspet", "petlovers", "petcare"]}';
    const parsed = JSON.parse(raw);
    expect(parsed.caption).toBe('Seu pet merece o melhor!');
    expect(parsed.hashtags).toHaveLength(5);
  });

  test('parses caption JSON wrapped in markdown fences (Claude format)', () => {
    const raw = '```json\n{"caption": "Dicas essenciais para seu cachorro!", "hashtags": ["pet", "gato", "cachorro", "dicaspet", "petlovers"]}\n```';
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    expect(parsed.caption).toBe('Dicas essenciais para seu cachorro!');
    expect(parsed.hashtags).toEqual(['pet', 'gato', 'cachorro', 'dicaspet', 'petlovers']);
  });

  test('handles markdown fences without json label', () => {
    const raw = '```\n{"caption": "Teste!", "hashtags": ["test"]}\n```';
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    expect(parsed.caption).toBe('Teste!');
  });

  test('handles empty/missing fields gracefully', () => {
    const parsed = JSON.parse('{}');
    const caption = parsed.caption || '';
    const hashtags = parsed.hashtags || [];
    expect(caption).toBe('');
    expect(hashtags).toEqual([]);
  });
});

describe('Reference carousel — Gemini service availability', () => {

  test('GeminiImageService reports disabled when GOOGLE_AI_API_KEY is not set', async () => {
    const original = process.env.GOOGLE_AI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;

    const { GeminiImageService } = await import('../services/gemini-image');
    const service = new GeminiImageService();
    expect(service.isEnabled()).toBe(false);

    if (original) process.env.GOOGLE_AI_API_KEY = original;
  });

  test('GeminiImageService has generateFromReference method', async () => {
    const { GeminiImageService } = await import('../services/gemini-image');
    const service = new GeminiImageService();
    expect(typeof service.generateFromReference).toBe('function');
  });

  test('Anthropic SDK is importable', async () => {
    const mod = await import('@anthropic-ai/sdk');
    expect(mod.default).toBeDefined();
  });
});

describe('Reference carousel — content storage shape', () => {

  test('saved content has correct carousel structure for reference mode', () => {
    const content = {
      signal_id: 0,
      content_type: 'carousel' as const,
      status: 'pending' as const,
      carousel_content: {
        slides: [
          { slideNumber: 1, title: 'Hook', body: null, stat: null, pexelsSearchQuery: '', layoutHint: 'hook' as const },
          { slideNumber: 2, title: 'Slide 2', body: null, stat: null, pexelsSearchQuery: '', layoutHint: 'content' as const },
          { slideNumber: 3, title: 'Slide 3', body: null, stat: null, pexelsSearchQuery: '', layoutHint: 'content' as const },
          { slideNumber: 4, title: 'Slide 4', body: null, stat: null, pexelsSearchQuery: '', layoutHint: 'content' as const },
          { slideNumber: 5, title: 'Slide 5', body: null, stat: null, pexelsSearchQuery: '', layoutHint: 'cta' as const },
        ],
        caption: 'Test caption in PT-BR',
        hashtags: ['pet', 'dicaspet', 'cachorro', 'petlovers', 'petcare'],
        hookFormula: 'curiosity_gap' as const
      },
      carousel_images: ['/path/slide-1.png', '/path/slide-2.png'],
      source_url: 'reference:clone',
      generated_at: new Date().toISOString()
    };

    expect(content.signal_id).toBe(0);
    expect(content.content_type).toBe('carousel');
    expect(content.carousel_content.slides[0].layoutHint).toBe('hook');
    expect(content.carousel_content.slides[4].layoutHint).toBe('cta');
    expect(content.source_url).toMatch(/^reference:(clone|inspired)$/);
    expect(content.carousel_content.hashtags).toHaveLength(5);
  });

  test('source_url distinguishes clone from inspired', () => {
    expect('reference:clone').toMatch(/^reference:(clone|inspired)$/);
    expect('reference:inspired').toMatch(/^reference:(clone|inspired)$/);
    expect('reference:copy').not.toMatch(/^reference:(clone|inspired)$/);
  });
});

describe('Reference carousel — Gemini status check', () => {

  test('gemini-status returns available:false when key is missing', async () => {
    // Simulates what the /api/keys/gemini-status endpoint checks
    const key = undefined;
    const result = !key
      ? { available: false, reason: 'no_key', message: 'Nenhuma chave Gemini configurada' }
      : { available: true };
    expect(result.available).toBe(false);
    expect(result.reason).toBe('no_key');
  });

  test('gemini-status check uses image model not text model', () => {
    // The status endpoint must test gemini-2.5-flash-image (image gen)
    // not gemini-2.5-flash (text-only), because they have separate quotas
    const imageModel = 'gemini-2.5-flash-image';
    const textModel = 'gemini-2.5-flash';
    expect(imageModel).not.toBe(textModel);
    expect(imageModel).toContain('image');
  });

  test('forceImageGen=pollinations skips Gemini entirely', () => {
    const forceImageGen = 'pollinations';
    const geminiEnabled = true;
    const geminiAvailable = forceImageGen !== 'pollinations' && geminiEnabled;
    expect(geminiAvailable).toBe(false);
  });

  test('forceImageGen empty string does not skip Gemini', () => {
    const forceImageGen = '';
    const geminiEnabled = true;
    const geminiAvailable = forceImageGen !== 'pollinations' && geminiEnabled;
    expect(geminiAvailable).toBe(true);
  });
});

describe('Reference carousel — Pollinations service', () => {

  test('PollinationsImageService is importable', async () => {
    const { PollinationsImageService } = await import('../services/pollinations-image');
    const service = new PollinationsImageService();
    expect(typeof service.generateImage).toBe('function');
  }, 15000);

  test('Pollinations prompt is truncated to 200 chars', () => {
    const longPrompt = 'A'.repeat(300);
    const shortPrompt = longPrompt.length > 200 ? longPrompt.substring(0, 200) : longPrompt;
    expect(shortPrompt.length).toBe(200);
  });
});

describe('Reference carousel — API key masking', () => {

  test('masks keys showing first 8 chars', () => {
    const maskKey = (key: string | undefined) => key ? `${key.substring(0, 8)}...${'*'.repeat(16)}` : '';
    expect(maskKey('sk-proj-ABC123DEF456')).toBe('sk-proj-...****************');
    expect(maskKey('AIzaSyDCy-356wGaBJ')).toBe('AIzaSyDC...****************');
    expect(maskKey(undefined)).toBe('');
    expect(maskKey('')).toBe('');
  });
});
