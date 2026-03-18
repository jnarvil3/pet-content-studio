/**
 * Brand Context Builder
 * Builds the brand context block that's prepended to every AI generation prompt.
 * This replaces the hardcoded "write like a dog owner" instructions with
 * actual brand-specific voice, tone, and rules.
 */

import { BrandConfig, BrandProfile } from '../types/brand';
import { BrandExtractor } from '../services/brand-extractor';

/**
 * Build brand context string for AI prompts
 * Uses extracted profile if available, falls back to basic brand config
 */
export function buildBrandContext(brand: BrandConfig): string {
  const profile = brand.profile || BrandExtractor.loadProfile();

  if (profile) {
    return buildRichBrandContext(brand, profile);
  }

  return buildBasicBrandContext(brand);
}

/**
 * Rich brand context from extracted profile
 */
function buildRichBrandContext(brand: BrandConfig, profile: BrandProfile): string {
  const sections: string[] = [];

  sections.push(`CONTEXTO DA MARCA — SIGA ESTAS REGRAS RIGOROSAMENTE:

Marca: ${brand.name} (${brand.handle})
${brand.tagline ? `Tagline: "${brand.tagline}"` : ''}`);

  // Voice & Tone
  if (profile.voice) {
    sections.push(`VOZ E TOM:
- Tom da marca: ${profile.voice.tone_adjectives.join(', ')}
- Estilo de escrita: ${profile.voice.writing_style}
${profile.voice.example_phrases.length > 0 ? `- Frases de exemplo que capturam esta voz:\n${profile.voice.example_phrases.map(p => `  "${p}"`).join('\n')}` : ''}
- IMPORTANTE: Escreva como se fosse a própria marca falando. Use o tom e estilo acima em cada frase.`);
  }

  // Forbidden words/claims
  const forbiddenWords = profile.voice?.forbidden_words || brand.voice.forbidden_words;
  const forbiddenClaims = profile.voice?.forbidden_claims || brand.voice.forbidden_claims;
  if (forbiddenWords.length > 0 || forbiddenClaims.length > 0) {
    sections.push(`PROIBIDO:
${forbiddenWords.length > 0 ? `- NUNCA use estas palavras: ${forbiddenWords.join(', ')}` : ''}
${forbiddenClaims.length > 0 ? `- NUNCA faça estas afirmações: ${forbiddenClaims.join(', ')}` : ''}`);
  }

  // Content rules
  if (profile.content_rules) {
    sections.push(`REGRAS DE CONTEÚDO:
- Público-alvo: ${profile.content_rules.target_audience}
${profile.content_rules.topics_to_emphasize.length > 0 ? `- Enfatizar: ${profile.content_rules.topics_to_emphasize.join(', ')}` : ''}
${profile.content_rules.topics_to_avoid.length > 0 ? `- Evitar: ${profile.content_rules.topics_to_avoid.join(', ')}` : ''}
- Estilo de CTA: ${profile.content_rules.cta_style}`);
  }

  // Brand story
  if (profile.brand_story) {
    sections.push(`SOBRE A MARCA:
${profile.brand_story}`);
  }

  // Services
  if (brand.services.length > 0) {
    sections.push(`SERVIÇOS DA MARCA: ${brand.services.join(', ')}`);
  }

  return sections.join('\n\n');
}

/**
 * Basic brand context from config only (no extracted profile)
 */
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

/**
 * Validate generated content against brand rules
 * Returns list of violations found
 */
export function validateAgainstBrand(content: string, brand: BrandConfig): string[] {
  const violations: string[] = [];
  const profile = brand.profile || BrandExtractor.loadProfile();
  const lower = content.toLowerCase();

  // Check forbidden words
  const forbiddenWords = [
    ...brand.voice.forbidden_words,
    ...(profile?.voice?.forbidden_words || [])
  ];
  for (const word of forbiddenWords) {
    if (lower.includes(word.toLowerCase())) {
      violations.push(`Palavra proibida encontrada: "${word}"`);
    }
  }

  // Check forbidden claims
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
