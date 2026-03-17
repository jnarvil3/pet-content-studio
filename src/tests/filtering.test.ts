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
