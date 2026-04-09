/**
 * Tests for pet content filtering, trending data, and review flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Client-side isPetRelatedClient (extracted for testing)
function isPetRelatedClient(text: string): boolean {
  const petKeywords = [
    'pet', 'dog', 'cat', 'puppy', 'kitten', 'animal', 'pup', 'kitty', 'canine', 'feline', 'doggo', 'pupper', 'fur baby', 'vet', 'breed',
    'cachorro', 'cachorra', 'gato', 'gata', 'filhote', 'cão', 'cadela', 'gatinho', 'gatinha', 'animal de estimação', 'animais', 'veterinário', 'veterinaria', 'raça', 'pets', 'canil', 'felino', 'canino', 'bichinho', 'peludo', 'patinha', 'banho e tosa', 'ração', 'petshop', 'pet shop', 'cãozinho', 'doguinho', 'miau', 'latido', 'pata', 'focinho'
  ];
  const lower = (text || '').toLowerCase();
  return petKeywords.some(kw => lower.includes(kw));
}

// Server-side isPetRelated (extracted for testing)
function isPetRelated(themes: string): boolean {
  const petKeywords = [
    'pet', 'dog', 'cat', 'puppy', 'kitten', 'animal', 'pup', 'kitty', 'canine', 'feline', 'doggo', 'pupper', 'fur baby', 'vet', 'breed',
    'cachorro', 'cachorra', 'gato', 'gata', 'filhote', 'cão', 'cadela', 'gatinho', 'gatinha', 'animais', 'veterinário', 'veterinaria', 'pets', 'felino', 'canino', 'miau', 'pata', 'focinho', 'cãozinho', 'doguinho'
  ];
  const lower = (themes || '').toLowerCase();
  return petKeywords.some(kw => lower.includes(kw));
}

describe('Pet content filtering', () => {
  describe('isPetRelatedClient - Portuguese keywords', () => {
    it('matches "cachorro" in title', () => {
      expect(isPetRelatedClient('pov: cachorros kkk #memestiktok')).toBe(true);
    });

    it('matches "gato" in title', () => {
      expect(isPetRelatedClient('Os miados kkkkkkkkk #humor #gatos')).toBe(true);
    });

    it('matches "gatinho" in title', () => {
      expect(isPetRelatedClient('O gatinho mais carinhoso de todos')).toBe(true);
    });

    it('matches "filhote" in title', () => {
      expect(isPetRelatedClient('Filhote de labrador brincando')).toBe(true);
    });

    it('matches "cão" in title', () => {
      expect(isPetRelatedClient('Cão de guarda muito fiel')).toBe(true);
    });

    it('matches "miau" in title', () => {
      expect(isPetRelatedClient('#ad Miau miau miau #cats #gatos')).toBe(true);
    });

    it('matches "veterinário" in title', () => {
      expect(isPetRelatedClient('Consulta no veterinário hoje')).toBe(true);
    });

    it('matches "banho e tosa" in title', () => {
      expect(isPetRelatedClient('Levei pro banho e tosa')).toBe(true);
    });

    it('does NOT match unrelated Portuguese content', () => {
      expect(isPetRelatedClient('Receita de bolo de chocolate caseiro')).toBe(false);
    });

    it('does NOT match general news', () => {
      expect(isPetRelatedClient('Economia brasileira cresce 3% no trimestre')).toBe(false);
    });

    it('does NOT match tech content', () => {
      expect(isPetRelatedClient('Novo iPhone lançado no Brasil')).toBe(false);
    });
  });

  describe('isPetRelatedClient - English keywords', () => {
    it('matches "dog" in title', () => {
      expect(isPetRelatedClient('Why You Should Never Keep A Fox As A Pet')).toBe(true);
    });

    it('matches "puppy" in title', () => {
      expect(isPetRelatedClient('The little puppy carved a wooden doll')).toBe(true);
    });

    it('does NOT match unrelated English content', () => {
      expect(isPetRelatedClient('How to make pasta at home')).toBe(false);
    });
  });

  describe('isPetRelated (server-side) - content_themes JSON', () => {
    it('matches themes with "pet"', () => {
      expect(isPetRelated('["pet rescue","transformation","emotional"]')).toBe(true);
    });

    it('matches themes with "funny cats"', () => {
      expect(isPetRelated('["funny cats","pet humor","comedy"]')).toBe(true);
    });

    it('matches themes with "cachorro"', () => {
      expect(isPetRelated('["cachorro engraçado","humor"]')).toBe(true);
    });

    it('does NOT match non-pet themes', () => {
      expect(isPetRelated('["cooking","recipe","food"]')).toBe(false);
    });

    it('handles empty string', () => {
      expect(isPetRelated('')).toBe(false);
    });

    it('handles null/undefined', () => {
      expect(isPetRelated(null as any)).toBe(false);
    });
  });
});

describe('Status labels', () => {
  const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendente',
    approved: 'Aprovado',
    rejected: 'Rejeitado',
    published: 'Publicado',
    revision_requested: 'Revisão Solicitada'
  };

  function statusLabel(status: string): string {
    return STATUS_LABELS[status] || status;
  }

  it('returns Portuguese label for pending', () => {
    expect(statusLabel('pending')).toBe('Pendente');
  });

  it('returns Portuguese label for revision_requested', () => {
    expect(statusLabel('revision_requested')).toBe('Revisão Solicitada');
  });

  it('returns raw value for unknown status', () => {
    expect(statusLabel('unknown_status')).toBe('unknown_status');
  });
});

describe('Hook labels', () => {
  const HOOK_LABELS: Record<string, string> = {
    curiosity_gap: '🤔 Fato curioso que prende atenção',
    contrarian: '🚫 Opinião contrária ao senso comum',
    emotional: '❤️ Conexão emocional com o pet',
    humor: '😂 Humor e entretenimento',
    shocking_fact: '😲 Dado surpreendente',
    tutorial: '📚 Tutorial passo a passo',
    question_hook: '❓ Pergunta que gera curiosidade',
    question: '❓ Pergunta que gera curiosidade',
    mistake_hook: '⚠️ Erro comum que donos cometem',
    personal: '🗣️ História pessoal com o pet',
    before_after: '✨ Antes e depois / transformação',
  };

  function hookLabel(formula: string): string {
    return HOOK_LABELS[formula] || formula;
  }

  it('returns descriptive PT-BR label for curiosity_gap', () => {
    expect(hookLabel('curiosity_gap')).toContain('Fato curioso');
  });

  it('returns descriptive PT-BR label for humor', () => {
    expect(hookLabel('humor')).toContain('Humor');
  });

  it('returns descriptive PT-BR label for emotional', () => {
    expect(hookLabel('emotional')).toContain('emocional');
  });

  it('returns raw value for unknown hook', () => {
    expect(hookLabel('some_new_hook')).toBe('some_new_hook');
  });
});

describe('Hashtag rendering', () => {
  function formatHashtags(tags: string[]): string[] {
    return tags.map(h => h.startsWith('#') ? h : '#' + h);
  }

  it('adds # to tags without it', () => {
    expect(formatHashtags(['dogs', 'petcare'])).toEqual(['#dogs', '#petcare']);
  });

  it('does NOT double-hash tags that already have #', () => {
    expect(formatHashtags(['#SureStepAutomation', 'dogs'])).toEqual(['#SureStepAutomation', '#dogs']);
  });

  it('handles mixed tags', () => {
    expect(formatHashtags(['#cachorro', 'petlovers', '#dicaspet'])).toEqual(['#cachorro', '#petlovers', '#dicaspet']);
  });

  it('handles empty array', () => {
    expect(formatHashtags([])).toEqual([]);
  });
});

describe('Region language matching', () => {
  // Mirrors REGION_LANGUAGE_MARKERS from server.ts
  const REGION_LANGUAGE_MARKERS: Record<string, RegExp> = {
    'BR': /\b(você|seu|como|para|não|que|por|mais|dos|das|uma|esta|esse|isso|muito|porque|quando|também|sobre|aqui|cachorro|gato|ração|banho|tosa|dono|veterinário)\b|[ãõçê]/i,
    'US': /\b(you|your|how|the|this|that|with|from|what|about|just|they|their|when|every|never|always|should|don't|can't|won't)\b/i,
    'MX': /\b(tu|usted|perro|gato|mascota|como|para|qué|por|más|este|esta|muy|también|cuando|aquí|nunca)\b|[ñ¿¡]/i,
    'ES': /\b(tu|perro|gato|mascota|como|para|qué|por|más|este|esta|muy|también|cuando|nunca)\b|[ñ¿¡]/i,
    'DE': /\b(der|die|das|und|für|mit|ein|eine|nicht|auch|wie|dein|hund|katze|haustier|warum)\b|[äöüß]/i,
    'FR': /\b(le|la|les|un|une|des|pour|avec|pas|que|qui|est|sont|votre|chien|chat|animal)\b|[éèêëàâùûîïôç]/i,
  };

  function matchesRegionLanguage(text: string, region: string): boolean {
    const pattern = REGION_LANGUAGE_MARKERS[region];
    if (!pattern) return true;
    return pattern.test(text);
  }

  it('matches Brazilian Portuguese titles to BR', () => {
    expect(matchesRegionLanguage('5 Erros que Todo Dono de Cachorro Comete', 'BR')).toBe(true);
  });

  it('matches Portuguese with diacritics to BR', () => {
    expect(matchesRegionLanguage('Alimentação natural para cães', 'BR')).toBe(true);
  });

  it('matches English titles to US', () => {
    expect(matchesRegionLanguage('How to Train Your Dog in 5 Minutes', 'US')).toBe(true);
  });

  it('does NOT match English title to BR', () => {
    expect(matchesRegionLanguage('How to Train Your Dog in 5 Minutes', 'BR')).toBe(false);
  });

  it('does NOT match Portuguese title to US', () => {
    expect(matchesRegionLanguage('Adestrador revela o ÚNICO comando', 'US')).toBe(false);
  });

  it('matches Spanish titles to MX', () => {
    expect(matchesRegionLanguage('¿Por qué tu perro te sigue al baño?', 'MX')).toBe(true);
  });

  it('matches German titles to DE', () => {
    expect(matchesRegionLanguage('Warum folgt Ihr Hund Ihnen überall hin?', 'DE')).toBe(true);
  });

  it('matches French titles to FR', () => {
    expect(matchesRegionLanguage('Les 5 erreurs que font les propriétaires de chien', 'FR')).toBe(true);
  });

  it('returns true for unknown region (no filter applied)', () => {
    expect(matchesRegionLanguage('any text', 'XX')).toBe(true);
  });
});

describe('Gemini image service availability', () => {
  it('reports disabled when GOOGLE_AI_API_KEY is not set', async () => {
    // Clear env var for this test
    const original = process.env.GOOGLE_AI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;

    const { GeminiImageService } = await import('../services/gemini-image');
    const service = new GeminiImageService();
    expect(service.isEnabled()).toBe(false);

    // Restore
    if (original) process.env.GOOGLE_AI_API_KEY = original;
  });

  it('reports enabled when GOOGLE_AI_API_KEY is set', async () => {
    const original = process.env.GOOGLE_AI_API_KEY;
    process.env.GOOGLE_AI_API_KEY = 'test-key';

    // Need fresh import to pick up env change
    const mod = await import('../services/gemini-image');
    const service = new mod.GeminiImageService();
    expect(service.isEnabled()).toBe(true);

    // Restore
    if (original) { process.env.GOOGLE_AI_API_KEY = original; } else { delete process.env.GOOGLE_AI_API_KEY; }
  });

  it('throws error when generating without API key', async () => {
    const original = process.env.GOOGLE_AI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;

    const { GeminiImageService } = await import('../services/gemini-image');
    const service = new GeminiImageService();
    await expect(service.generateImage('test', '/tmp/test.png')).rejects.toThrow('GOOGLE_AI_API_KEY not configured');

    if (original) process.env.GOOGLE_AI_API_KEY = original;
  });
});

describe('Instagram hooks real-world data structure', () => {
  // Mirrors the structure from /api/instagram-hooks (real-world sourced)
  const trendingThisWeek = [
    { hook: 'When people your age start having kids', category: 'Relatable Humor', why: 'Generational humor', source: 'SocialBee' },
    { hook: 'Born to {preference}… Forced to {adult reality}', category: 'Contrast Meme', why: 'Contrasts desire vs. responsibility', source: 'SocialBee' },
  ];

  const provenFormulas = [
    { hook: 'Stop scrolling if you want to…', category: 'Direct CTA', why: 'Interrupts scrolling', source: 'Taggbox' },
    { hook: 'This one mistake is costing you…', category: 'Problem Awareness', why: 'Hidden pain point', source: 'Taggbox' },
  ];

  it('trending hooks have required fields', () => {
    trendingThisWeek.forEach(h => {
      expect(h.hook).toBeTruthy();
      expect(h.category).toBeTruthy();
      expect(h.why).toBeTruthy();
      expect(h.source).toBeTruthy();
    });
  });

  it('proven formulas have required fields', () => {
    provenFormulas.forEach(h => {
      expect(h.hook).toBeTruthy();
      expect(h.category).toBeTruthy();
      expect(h.source).toBeTruthy();
    });
  });

  it('hooks are attributed to real sources', () => {
    const validSources = ['SocialBee', 'SocialPilot', 'Taggbox'];
    [...trendingThisWeek, ...provenFormulas].forEach(h => {
      expect(validSources).toContain(h.source);
    });
  });
});

describe('Video sorting modes', () => {
  const videos = [
    { title: 'Video A', engagement_rate: 15.0, view_count: 500_000 },
    { title: 'Video B', engagement_rate: 8.0, view_count: 5_000_000 },
    { title: 'Video C', engagement_rate: 20.0, view_count: 100_000 },
  ];

  it('sorts by engagement rate (highest first)', () => {
    const sorted = [...videos].sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0));
    expect(sorted[0].title).toBe('Video C');
    expect(sorted[1].title).toBe('Video A');
    expect(sorted[2].title).toBe('Video B');
  });

  it('sorts by view count (highest first)', () => {
    const sorted = [...videos].sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
    expect(sorted[0].title).toBe('Video B');
    expect(sorted[1].title).toBe('Video A');
    expect(sorted[2].title).toBe('Video C');
  });

  it('highest engagement is NOT necessarily highest views', () => {
    const byEngagement = [...videos].sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0));
    const byViews = [...videos].sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
    expect(byEngagement[0].title).not.toBe(byViews[0].title);
  });
});

describe('Singular/plural (Portuguese)', () => {
  function pluralize(count: number, singular: string, plural: string): string {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  it('uses singular for 1', () => {
    expect(pluralize(1, 'vídeo', 'vídeos')).toBe('1 vídeo');
  });

  it('uses plural for 0', () => {
    expect(pluralize(0, 'vídeo', 'vídeos')).toBe('0 vídeos');
  });

  it('uses plural for 5', () => {
    expect(pluralize(5, 'vídeo', 'vídeos')).toBe('5 vídeos');
  });

  it('uses plural for 100', () => {
    expect(pluralize(100, 'vídeo', 'vídeos')).toBe('100 vídeos');
  });
});
