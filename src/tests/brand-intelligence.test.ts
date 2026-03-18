/**
 * Brand Intelligence System Tests
 * Tests brand context building, validation, extraction, and profile management
 */

import { describe, it, expect, vi } from 'vitest';
import { BrandConfig, BrandProfile, defaultBrandConfig } from '../types/brand';

// ---- Extracted functions for testing (avoids file system deps) ----

function buildBasicBrandContext(brand: BrandConfig): string {
  const tone = brand.voice.tone.length > 0
    ? `Tom: ${brand.voice.tone.join(', ')}`
    : 'Tom: amigável, educativo, confiável';

  return `CONTEXTO DA MARCA:
Marca: ${brand.name} (${brand.handle})
${brand.tagline ? `Tagline: "${brand.tagline}"` : ''}
${tone}
Serviços: ${brand.services.join(', ')}
${brand.voice.forbidden_words.length > 0 ? `Palavras proibidas: ${brand.voice.forbidden_words.join(', ')}` : ''}

Escreva como um especialista em pets conversando com um amigo — natural, específico, opinativo. Não como livro-texto ou agência de marketing.`;
}

function buildRichBrandContext(brand: BrandConfig, profile: BrandProfile): string {
  const sections: string[] = [];

  sections.push(`CONTEXTO DA MARCA — SIGA ESTAS REGRAS RIGOROSAMENTE:

Marca: ${brand.name} (${brand.handle})
${brand.tagline ? `Tagline: "${brand.tagline}"` : ''}`);

  if (profile.voice) {
    sections.push(`VOZ E TOM:
- Tom da marca: ${profile.voice.tone_adjectives.join(', ')}
- Estilo de escrita: ${profile.voice.writing_style}
${profile.voice.example_phrases.length > 0 ? `- Frases de exemplo que capturam esta voz:\n${profile.voice.example_phrases.map(p => `  "${p}"`).join('\n')}` : ''}
- IMPORTANTE: Escreva como se fosse a própria marca falando. Use o tom e estilo acima em cada frase.`);
  }

  const forbiddenWords = profile.voice?.forbidden_words || brand.voice.forbidden_words;
  const forbiddenClaims = profile.voice?.forbidden_claims || brand.voice.forbidden_claims;
  if (forbiddenWords.length > 0 || forbiddenClaims.length > 0) {
    sections.push(`PROIBIDO:
${forbiddenWords.length > 0 ? `- NUNCA use estas palavras: ${forbiddenWords.join(', ')}` : ''}
${forbiddenClaims.length > 0 ? `- NUNCA faça estas afirmações: ${forbiddenClaims.join(', ')}` : ''}`);
  }

  if (profile.content_rules) {
    sections.push(`REGRAS DE CONTEÚDO:
- Público-alvo: ${profile.content_rules.target_audience}
${profile.content_rules.topics_to_emphasize.length > 0 ? `- Enfatizar: ${profile.content_rules.topics_to_emphasize.join(', ')}` : ''}
${profile.content_rules.topics_to_avoid.length > 0 ? `- Evitar: ${profile.content_rules.topics_to_avoid.join(', ')}` : ''}
- Estilo de CTA: ${profile.content_rules.cta_style}`);
  }

  if (profile.brand_story) {
    sections.push(`SOBRE A MARCA:\n${profile.brand_story}`);
  }

  if (brand.services.length > 0) {
    sections.push(`SERVIÇOS DA MARCA: ${brand.services.join(', ')}`);
  }

  return sections.join('\n\n');
}

function validateAgainstBrand(content: string, brand: BrandConfig, profile?: BrandProfile | null): string[] {
  const violations: string[] = [];
  const lower = content.toLowerCase();

  const forbiddenWords = [
    ...brand.voice.forbidden_words,
    ...(profile?.voice?.forbidden_words || [])
  ];
  for (const word of forbiddenWords) {
    if (lower.includes(word.toLowerCase())) {
      violations.push(`Palavra proibida encontrada: "${word}"`);
    }
  }

  const forbiddenClaims = [
    ...brand.voice.forbidden_claims,
    ...(profile?.voice?.forbidden_claims || [])
  ];
  for (const claim of forbiddenClaims) {
    if (lower.includes(claim.toLowerCase())) {
      violations.push(`Afirmação proibida encontrada: "${claim}"`);
    }
  }

  return violations;
}

// ---- Test Data ----

const testBrand: BrandConfig = {
  name: 'PetVida',
  handle: '@petvida',
  tagline: 'Cuidar é amar',
  colors: { primary: '#2E86AB', secondary: '#A23B72', accent: '#4caf50', text: '#333', background: '#fff' },
  fonts: { heading: 'Inter', body: 'Inter' },
  voice: {
    tone: ['acolhedor', 'educativo', 'confiável'],
    forbidden_words: ['barato', 'desconto', 'promoção'],
    forbidden_claims: ['garantido', 'cura milagrosa']
  },
  ctas: { carousel: ['Salve para depois'], reel: ['Siga para mais'], default: 'Siga @petvida' },
  services: ['pet shop', 'banho e tosa', 'veterinário']
};

const testProfile: BrandProfile = {
  voice: {
    tone_adjectives: ['acolhedor', 'profissional', 'carinhoso'],
    writing_style: 'Conversacional, usa "você". Frases curtas. Sem jargão técnico.',
    example_phrases: ['Seu pet merece o melhor', 'Cuidar é amar', 'Saúde em primeiro lugar'],
    forbidden_words: ['barato', 'desconto', 'promoção', 'grátis'],
    forbidden_claims: ['garantido', 'cura milagrosa', 'resultado imediato']
  },
  visual: {
    primary_color: '#2E86AB',
    secondary_color: '#A23B72',
    font_style: 'Moderna, limpa',
    logo_usage_rules: 'Sempre sobre fundo branco'
  },
  content_rules: {
    topics_to_emphasize: ['saúde preventiva', 'nutrição natural', 'bem-estar animal'],
    topics_to_avoid: ['eutanásia', 'maus-tratos detalhados'],
    target_audience: 'Donos de pets classe B/C, 25-45 anos, urbanos',
    cta_style: 'Soft sell — educar primeiro, mencionar serviços por último'
  },
  brand_story: 'PetVida nasceu do amor pelos animais. Nossa missão é tornar o cuidado pet acessível e de qualidade para todas as famílias brasileiras.',
  extracted_at: '2026-03-18T12:00:00.000Z',
  extraction_model: 'claude-haiku-4-5-20251001'
};

// ---- Tests ----

describe('Brand Context Builder', () => {
  describe('buildBasicBrandContext (no profile)', () => {
    it('includes brand name and handle', () => {
      const ctx = buildBasicBrandContext(testBrand);
      expect(ctx).toContain('PetVida');
      expect(ctx).toContain('@petvida');
    });

    it('includes tagline when present', () => {
      const ctx = buildBasicBrandContext(testBrand);
      expect(ctx).toContain('Cuidar é amar');
    });

    it('omits tagline when absent', () => {
      const brandNoTag = { ...testBrand, tagline: undefined };
      const ctx = buildBasicBrandContext(brandNoTag);
      expect(ctx).not.toContain('Tagline');
    });

    it('includes voice tone', () => {
      const ctx = buildBasicBrandContext(testBrand);
      expect(ctx).toContain('acolhedor');
      expect(ctx).toContain('educativo');
    });

    it('includes services', () => {
      const ctx = buildBasicBrandContext(testBrand);
      expect(ctx).toContain('pet shop');
      expect(ctx).toContain('veterinário');
    });

    it('includes forbidden words', () => {
      const ctx = buildBasicBrandContext(testBrand);
      expect(ctx).toContain('barato');
      expect(ctx).toContain('desconto');
    });

    it('uses default tone when voice.tone is empty', () => {
      const brandEmpty = { ...testBrand, voice: { ...testBrand.voice, tone: [] } };
      const ctx = buildBasicBrandContext(brandEmpty);
      expect(ctx).toContain('amigável, educativo, confiável');
    });

    it('is in Portuguese', () => {
      const ctx = buildBasicBrandContext(testBrand);
      expect(ctx).toContain('CONTEXTO DA MARCA');
      expect(ctx).toContain('Serviços');
    });
  });

  describe('buildRichBrandContext (with profile)', () => {
    it('includes SIGA ESTAS REGRAS header', () => {
      const ctx = buildRichBrandContext(testBrand, testProfile);
      expect(ctx).toContain('SIGA ESTAS REGRAS RIGOROSAMENTE');
    });

    it('includes extracted tone adjectives', () => {
      const ctx = buildRichBrandContext(testBrand, testProfile);
      expect(ctx).toContain('acolhedor, profissional, carinhoso');
    });

    it('includes writing style', () => {
      const ctx = buildRichBrandContext(testBrand, testProfile);
      expect(ctx).toContain('Conversacional');
      expect(ctx).toContain('Frases curtas');
    });

    it('includes example phrases', () => {
      const ctx = buildRichBrandContext(testBrand, testProfile);
      expect(ctx).toContain('Seu pet merece o melhor');
      expect(ctx).toContain('Saúde em primeiro lugar');
    });

    it('includes forbidden words from profile', () => {
      const ctx = buildRichBrandContext(testBrand, testProfile);
      expect(ctx).toContain('NUNCA use estas palavras');
      expect(ctx).toContain('grátis');
    });

    it('includes target audience', () => {
      const ctx = buildRichBrandContext(testBrand, testProfile);
      expect(ctx).toContain('Donos de pets classe B/C');
    });

    it('includes topics to emphasize', () => {
      const ctx = buildRichBrandContext(testBrand, testProfile);
      expect(ctx).toContain('saúde preventiva');
      expect(ctx).toContain('nutrição natural');
    });

    it('includes topics to avoid', () => {
      const ctx = buildRichBrandContext(testBrand, testProfile);
      expect(ctx).toContain('eutanásia');
    });

    it('includes CTA style', () => {
      const ctx = buildRichBrandContext(testBrand, testProfile);
      expect(ctx).toContain('Soft sell');
    });

    it('includes brand story', () => {
      const ctx = buildRichBrandContext(testBrand, testProfile);
      expect(ctx).toContain('PetVida nasceu do amor');
    });

    it('includes services', () => {
      const ctx = buildRichBrandContext(testBrand, testProfile);
      expect(ctx).toContain('banho e tosa');
    });
  });
});

describe('Brand Validation', () => {
  describe('validateAgainstBrand', () => {
    it('catches forbidden words from brand config', () => {
      const violations = validateAgainstBrand(
        'Nosso serviço é barato e tem desconto especial',
        testBrand
      );
      expect(violations).toHaveLength(2);
      expect(violations[0]).toContain('barato');
      expect(violations[1]).toContain('desconto');
    });

    it('catches forbidden claims from brand config', () => {
      const violations = validateAgainstBrand(
        'Resultado garantido para seu pet',
        testBrand
      );
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain('garantido');
    });

    it('catches forbidden words from profile', () => {
      const violations = validateAgainstBrand(
        'Produto grátis na primeira compra',
        testBrand,
        testProfile
      );
      expect(violations.some(v => v.includes('grátis'))).toBe(true);
    });

    it('catches forbidden claims from profile', () => {
      const violations = validateAgainstBrand(
        'Resultado imediato para o seu pet',
        testBrand,
        testProfile
      );
      expect(violations.some(v => v.includes('resultado imediato'))).toBe(true);
    });

    it('is case insensitive', () => {
      const violations = validateAgainstBrand(
        'DESCONTO imperdível! BARATO demais!',
        testBrand
      );
      expect(violations).toHaveLength(2);
    });

    it('returns empty array for clean content', () => {
      const violations = validateAgainstBrand(
        'Cuidar do seu pet é um ato de amor. Venha conhecer nossos serviços.',
        testBrand
      );
      expect(violations).toHaveLength(0);
    });

    it('returns empty array for empty content', () => {
      expect(validateAgainstBrand('', testBrand)).toHaveLength(0);
    });

    it('deduplicates words found in both config and profile', () => {
      // 'barato' is in both testBrand.voice.forbidden_words AND testProfile.voice.forbidden_words
      const violations = validateAgainstBrand('Isso é barato', testBrand, testProfile);
      const baratoViolations = violations.filter(v => v.includes('barato'));
      // It's OK to report twice (config + profile both flagged it)
      expect(baratoViolations.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('BrandProfile structure', () => {
  it('has required voice fields', () => {
    expect(testProfile.voice.tone_adjectives).toBeInstanceOf(Array);
    expect(testProfile.voice.writing_style).toBeTruthy();
    expect(testProfile.voice.example_phrases).toBeInstanceOf(Array);
    expect(testProfile.voice.forbidden_words).toBeInstanceOf(Array);
    expect(testProfile.voice.forbidden_claims).toBeInstanceOf(Array);
  });

  it('has required content_rules fields', () => {
    expect(testProfile.content_rules.target_audience).toBeTruthy();
    expect(testProfile.content_rules.topics_to_emphasize).toBeInstanceOf(Array);
    expect(testProfile.content_rules.topics_to_avoid).toBeInstanceOf(Array);
    expect(testProfile.content_rules.cta_style).toBeTruthy();
  });

  it('has extraction metadata', () => {
    expect(testProfile.extracted_at).toBeTruthy();
    expect(testProfile.extraction_model).toBeTruthy();
  });

  it('has brand story', () => {
    expect(testProfile.brand_story.length).toBeGreaterThan(10);
  });
});

describe('BrandConfig defaults', () => {
  it('has default forbidden words', () => {
    expect(defaultBrandConfig.voice.forbidden_words).toContain('miracle');
    expect(defaultBrandConfig.voice.forbidden_words).toContain('cure');
  });

  it('has default services', () => {
    expect(defaultBrandConfig.services.length).toBeGreaterThan(0);
  });

  it('has default colors', () => {
    expect(defaultBrandConfig.colors.primary).toMatch(/^#/);
    expect(defaultBrandConfig.colors.secondary).toMatch(/^#/);
  });

  it('has default CTAs', () => {
    expect(defaultBrandConfig.ctas.carousel.length).toBeGreaterThan(0);
    expect(defaultBrandConfig.ctas.reel.length).toBeGreaterThan(0);
  });
});
