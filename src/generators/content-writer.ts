/**
 * OpenAI Content Writer
 * Rewrites topic cards into Instagram-ready content
 */

import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';
import { Signal } from '../types/signal';
import { CarouselContent } from '../types/content';
import { BrandConfig } from '../types/brand';
import { buildBrandContext, validateAgainstBrand } from '../config/brand-context';
import { ViralSignalsConnector, ViralHook } from '../storage/viral-signals-connector';

export interface ViralInsights {
  topHooks: ViralHook[];
  trendingThemes: string[];
  avgEngagement: number;
  recommendedHook?: string;
}

export class ContentWriter {
  private client: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Generate carousel content from a topic signal
   * Uses GPT-4o-mini for cost efficiency
   * Optionally uses viral insights to enhance content
   */
  async generateCarousel(
    signal: Signal,
    brand: BrandConfig,
    viralInsights?: ViralInsights,
    editFeedback?: string,
    previousContent?: CarouselContent,
    preciseMode: boolean = false
  ): Promise<CarouselContent> {
    const prompt = this.buildCarouselPrompt(signal, brand, viralInsights, editFeedback, previousContent, preciseMode);

    const model = preciseMode ? 'gpt-4o' : 'gpt-4o-mini';
    const mode = viralInsights ? 'viral-enhanced' : 'standard';
    console.log(`[ContentWriter] Generating ${mode} carousel for signal #${signal.id}: "${signal.title}" (model: ${model})`);

    if (viralInsights) {
      console.log(`[ContentWriter] 🔥 Using viral insights: Top hook = ${viralInsights.recommendedHook || 'auto'}, Avg engagement = ${viralInsights.avgEngagement.toFixed(1)}%`);
    }

    try {
      const response = await this.client.chat.completions.create({
        model,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const responseText = response.choices[0].message.content || '';

      // Parse JSON response
      const result = JSON.parse(responseText);

      // Precise mode: override caption and hashtags with exact user text
      if (preciseMode && editFeedback) {
        const quotedCaption = ContentWriter.extractQuotedText(editFeedback, 'caption');
        if (quotedCaption) {
          console.log(`[ContentWriter] 🎯 Precise override: replacing AI caption "${result.caption?.substring(0, 40)}..." with user's exact text "${quotedCaption}"`);
          result.caption = quotedCaption;
        }
        const extractedHashtags = ContentWriter.extractHashtags(editFeedback);
        if (extractedHashtags) {
          console.log(`[ContentWriter] 🎯 Precise override: replacing AI hashtags with user's exact hashtags: ${extractedHashtags.join(', ')}`);
          result.hashtags = extractedHashtags;
        }
      }

      console.log(`[ContentWriter] ✅ Generated 5-slide carousel with ${result.hashtags.length} hashtags`);

      return result as CarouselContent;
    } catch (error: any) {
      console.error('[ContentWriter] Error generating carousel:', error.message);
      throw error;
    }
  }

  /**
   * Build the improved system prompt for carousel generation
   * Optionally enhanced with viral insights
   */
  private buildCarouselPrompt(signal: Signal, brand: BrandConfig, viralInsights?: ViralInsights, editFeedback?: string, previousContent?: CarouselContent, preciseMode: boolean = false): string {
    const services = brand.services.join(', ');
    const brandHandle = brand.handle;

    // Build viral context if insights provided
    let viralContext = '';
    if (viralInsights && viralInsights.topHooks.length > 0) {
      const topHook = viralInsights.topHooks[0];

      // Build hook list with ACTUAL EXAMPLES
      const hookListWithExamples = viralInsights.topHooks.slice(0, 3)
        .map((h, i) => {
          let hookSection = `  ${i + 1}. ${h.hook_formula.toUpperCase()} (${h.avg_engagement_rate.toFixed(1)}% avg engagement, ${h.count} videos)`;

          // Add actual video title examples
          if (h.examples && h.examples.length > 0) {
            const exampleTitles = h.examples
              .map(ex => `     ✓ "${ex.title}" (${ex.engagement_rate.toFixed(1)}% engagement)`)
              .join('\n');
            hookSection += '\n' + exampleTitles;
          }

          return hookSection;
        })
        .join('\n\n');

      viralContext = `
---

🔥 VIRAL INSIGHTS (Last 7 Days):
Based on analyzing ${viralInsights.topHooks.reduce((sum, h) => sum + h.count, 0)} viral pet videos:

TOP PERFORMING HOOK FORMULAS WITH REAL EXAMPLES:
${hookListWithExamples}

CRITICAL INSTRUCTION: Your hook MUST mirror the style and pattern of the examples above.
Notice how they:
- Use specific, relatable scenarios
- Create curiosity gaps or pattern interrupts
- Sound like real people talking, not marketing copy
- Are emotionally engaging and scroll-stopping

RECOMMENDED: Use "${viralInsights.recommendedHook || topHook.hook_formula}" hook formula for maximum engagement potential.

${viralInsights.trendingThemes.length > 0 ? `TRENDING THEMES IN VIRAL PET CONTENT: ${viralInsights.trendingThemes.slice(0, 5).join(', ')}` : ''}

---
`;
    }

    // Build feedback context if regenerating
    let feedbackContext = '';
    if (editFeedback && previousContent) {
      const prevSlides = previousContent.slides.map(s =>
        `Slide ${s.slideNumber} (${s.layoutHint}): título="${s.title}" corpo="${s.body || 'nenhum'}" stat="${s.stat ? s.stat.number + ' - ' + s.stat.context : 'nenhum'}"`
      ).join('\n');

      feedbackContext = `
---

⚠️ ISTO É UMA REVISÃO — NÃO GERE DO ZERO.

VERSÃO ANTERIOR (que o cliente revisou):
${prevSlides}

Legenda anterior: "${previousContent.caption}"
Hashtags anteriores: ${previousContent.hashtags.join(', ')}
Gancho usado: ${previousContent.hookFormula}

ALTERAÇÕES SOLICITADAS PELO CLIENTE:
${editFeedback}

INSTRUÇÕES DE REVISÃO:
1. MANTENHA tudo que o cliente NÃO mencionou — não mude o que já está bom
2. ALTERE APENAS o que foi especificamente solicitado acima
3. A nova versão deve ser claramente diferente nos pontos solicitados
4. Preserve o mesmo tom e estilo geral, exceto onde o cliente pediu mudança
${preciseMode ? `
🎯 MODO PRECISO ATIVADO — REGRAS OBRIGATÓRIAS:
- Quando o cliente fornecer texto exato entre aspas, use esse texto LITERALMENTE — não reformule, não expanda, não adicione nada
- Quando o cliente especificar hashtags exatas, use SOMENTE essas hashtags — não adicione extras
- Quando o cliente pedir para substituir algo, substitua EXATAMENTE como pedido
- Trate as instruções do cliente como comandos literais, NÃO como sugestões criativas
- NÃO adicione conteúdo extra além do que foi solicitado
- Se o cliente deu texto exato para a legenda, a legenda deve ser IDÊNTICA ao texto fornecido` : ''}

---
`;
    } else if (editFeedback) {
      feedbackContext = `
---

ALTERAÇÕES SOLICITADAS PELO CLIENTE:
${editFeedback}

${preciseMode ? `🎯 MODO PRECISO: Siga as instruções LITERALMENTE. Texto entre aspas deve ser usado VERBATIM. Hashtags especificadas devem ser as ÚNICAS usadas. Não adicione conteúdo extra.

` : ''}Gere uma versão REVISADA que incorpore todas as alterações acima.

---
`;
    }

    const brandContext = buildBrandContext(brand);

    return `You are an Instagram carousel copywriter.
${viralContext}${feedbackContext}
${brandContext}

Your job is to turn a topic card into a scroll-stopping, save-worthy 5-slide Instagram carousel.

IMPORTANT — LANGUAGE REQUIREMENT:
Write ALL content in Brazilian Portuguese (PT-BR).
- Use natural, conversational Brazilian Portuguese — NOT European Portuguese.
- Use informal "você" (not "tu"). Use contractions natural to PT-BR.
- Adapt cultural references for Brazil.
- Hashtags in Portuguese (e.g., #cachorro, #petlovers, #dicaspet).
- pexelsSearchQuery must REMAIN IN ENGLISH (Pexels search works best in English).

Be specific. Be opinionated. Occasionally ask the reader a question. Never use corporate jargon.

---

TOPIC CARD:
Title: ${signal.title}
Description: ${signal.description || 'N/A'}
Source: ${signal.url || 'N/A'}

---

SLIDE-BY-SLIDE STRUCTURE:

SLIDE 1 — THE HOOK (scroll-stopper)
- Purpose: Make someone stop scrolling. Create a curiosity gap or pattern interrupt.
- Title: 6–12 words MAX. This is the only text on the slide.
- NO subtitle or body text on slide 1.
- The title must use ONE of these proven hook formulas:
  * CURIOSITY GAP: "The one thing most dog owners get wrong about [topic]"
  * CONTRARIAN: "Stop doing [common practice]. Here's why."
  * MISTAKE HOOK: "This common mistake is making your dog's [problem] worse"
  * PERSONAL/SPECIFIC: "I wish someone told me this before getting a [breed/puppy]"
  * QUESTION HOOK: "Is your dog [doing X]? It's not what you think."
  * NUMBER + OUTCOME: "[Number] things that changed how I [specific outcome]"
- NEVER use generic article-style titles like "5 Tips for Dog Owners" or "Understanding Pet Nutrition."
- The hook should feel like something a person would actually say out loud.

SLIDE 2 — THE PROBLEM / SETUP
- Title: 4–8 words, bold. States the problem or sets the context.
- Body: 1–2 short sentences MAX (under 25 words total).
- This slide should make the reader think "yes, that's me" or "wait, really?"

SLIDE 3 — THE KEY INSIGHT (with a data point)
- Title: 4–8 words, bold. The core insight or surprising fact.
- Stat callout: Include ONE specific number, percentage, or data point. Format as large number with brief context.
- Body: 1 sentence MAX explaining why this matters.
- If the source has no stat, create contextual framing using commonly known data.

SLIDE 4 — THE SOLUTION / ACTIONABLE TIP
- Title: 4–8 words, bold. The practical takeaway.
- Body: 1–2 short sentences (under 25 words total). Tell them exactly what to do.
- This should be the most useful slide — something they'd screenshot or save.
- Be specific: "Walk your dog before feeding, not after" beats "Exercise is important."

SLIDE 5 — THE CTA
- Title: Short action phrase (e.g., "Save this for later 🐾" or "Follow for more pet tips")
- Body: Brand handle (${brandHandle}) displayed prominently.
- Include a secondary CTA as a question to drive comments.
- This slide should feel like a warm sign-off, not a sales pitch.

---

COPY RULES (strictly enforce):

1. Billboard, not blog: Every slide readable in under 3 seconds. Max 30 words of body text per slide.
2. One idea per slide: Never stack two tips or two points on one slide.
3. Sound human: Use contractions. Write how dog owners talk in Reddit/Facebook — not veterinary journals.
4. Be specific over general: "Freeze a Kong with peanut butter" beats "Provide mental stimulation."
5. No medical claims: Never diagnose or recommend specific medications. Use "talk to your vet about..."
6. Vary the hook formula: Rotate between curiosity_gap, contrarian, mistake_hook, personal_specific, question_hook, number_outcome.

---

OUTPUT FORMAT (return ONLY valid JSON):

{
  "slides": [
    {
      "slideNumber": 1,
      "title": "Your hook text here",
      "body": null,
      "stat": null,
      "pexelsSearchQuery": "golden retriever playing outdoors",
      "layoutHint": "hook"
    },
    {
      "slideNumber": 2,
      "title": "The problem title",
      "body": "One to two short sentences about the problem.",
      "stat": null,
      "pexelsSearchQuery": "dog looking anxious home",
      "layoutHint": "problem"
    },
    {
      "slideNumber": 3,
      "title": "The key insight",
      "body": "Why this matters in one sentence.",
      "stat": { "number": "40%", "context": "of dog owners skip daily walks due to schedule" },
      "pexelsSearchQuery": "person walking dog park",
      "layoutHint": "insight"
    },
    {
      "slideNumber": 4,
      "title": "The actionable tip",
      "body": "Exactly what to do, in one to two sentences.",
      "stat": null,
      "pexelsSearchQuery": "happy dog running trail",
      "layoutHint": "tip"
    },
    {
      "slideNumber": 5,
      "title": "Save this for later 🐾",
      "body": "${brandHandle}",
      "stat": null,
      "pexelsSearchQuery": "cute dog looking at camera",
      "layoutHint": "cta",
      "commentPrompt": "What's your dog's favorite way to exercise? Tell us below 👇"
    }
  ],
  "caption": "Your Instagram caption here. Start with a hook question or bold statement. 2-3 short paragraphs max. End with a CTA to save, share, or comment. Include 1-2 relevant emojis but don't overdo it.",
  "hashtags": ["dogs", "petcare", "dogtraining", "doghealth", "petparent"],
  "hookFormula": "curiosity_gap"
}

IMPORTANT:
- pexelsSearchQuery must be 2-5 words, specific to slide topic, always include dog/pet term
${preciseMode && editFeedback ? `- 🎯 CAPTION: If the client provided exact caption text in quotes, use THAT TEXT EXACTLY as the "caption" value. Do NOT generate your own caption. Copy it character-for-character.
- 🎯 HASHTAGS: If the client specified exact hashtags, use ONLY those hashtags. Ignore the "5 hashtags" rule below.` : `- caption should be 50-120 words. Start with question or bold statement
- Include exactly 5 hashtags: 2 broad, 2 medium, 1 niche`}
- hookFormula must be one of: curiosity_gap, contrarian, mistake_hook, personal_specific, question_hook, number_outcome
- The stat on slide 3 should have "number" as prominent display value and "context" as supporting text`;
  }

  /**
   * Extract quoted text from user feedback for precise mode override
   */
  static extractQuotedText(feedback: string, field: string): string | null {
    // Match patterns like: Replace the caption with EXACTLY this text: "some text here"
    // or: caption: "some text here"
    // Supports straight quotes ("), curly quotes (\u201c\u201d), and guillemets
    const patterns = [
      new RegExp(`(?:caption|legenda).*?(?:EXACTLY|EXATAMENTE|exactly)?[:\\s]*["""\u201c]([^"""\u201d]+)["""\u201d]`, 'i'),
      new RegExp(`(?:text|texto)[:\\s]*["""\u201c]([^"""\u201d]+)["""\u201d]`, 'i'),
    ];
    if (field === 'caption') {
      for (const pattern of patterns) {
        const match = feedback.match(pattern);
        if (match) return match[1];
      }
    }
    return null;
  }

  /**
   * Extract exact hashtags from user feedback for precise mode override
   */
  static extractHashtags(feedback: string): string[] | null {
    // Match patterns like: "hashtags to EXACTLY: #agility #treinopet #cachorro"
    const match = feedback.match(/hashtags?\s+(?:to\s+)?(?:EXACTLY|EXATAMENTE|exactly)[:\s]+([#\w\s]+?)(?:\.|$|\n)/i);
    if (match) {
      const hashtags = match[1].match(/#\w+/g);
      if (hashtags && hashtags.length > 0) {
        return hashtags.map(h => h.replace('#', ''));
      }
    }
    return null;
  }
}
