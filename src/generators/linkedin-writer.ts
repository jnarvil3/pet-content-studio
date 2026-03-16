/**
 * LinkedIn Post Writer
 * Generates LinkedIn-specific content from topic signals
 * Professional tone, longer-form, Brazilian Portuguese
 */

import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';
import { Signal } from '../types/signal';
import { LinkedInPost } from '../types/content';
import { BrandConfig } from '../types/brand';

export class LinkedInWriter {
  private client: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async generatePost(
    signal: Signal,
    brand: BrandConfig,
    editFeedback?: string
  ): Promise<LinkedInPost> {
    const prompt = this.buildPrompt(signal, brand, editFeedback);

    console.log(`[LinkedInWriter] Generating post for signal #${signal.id}: "${signal.title}"`);

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }]
      });

      const result = JSON.parse(response.choices[0].message.content || '');
      console.log(`[LinkedInWriter] Generated LinkedIn post (${result.body?.length || 0} chars)`);
      return result as LinkedInPost;
    } catch (error: any) {
      console.error('[LinkedInWriter] Error:', error.message);
      throw error;
    }
  }

  private buildPrompt(signal: Signal, brand: BrandConfig, editFeedback?: string): string {
    const services = brand.services.join(', ');

    let feedbackContext = '';
    if (editFeedback) {
      feedbackContext = `
---
REVISION REQUEST:
${editFeedback}
Generate a REVISED version addressing ALL feedback.
---
`;
    }

    return `You are a LinkedIn content strategist for ${brand.name} (${services}).
${feedbackContext}
Write a professional LinkedIn post about this topic for the Brazilian pet industry audience.

IMPORTANT — LANGUAGE: Write EVERYTHING in Brazilian Portuguese (PT-BR). Use "voce" (informal).

TOPIC:
Title: ${signal.title}
Description: ${signal.description || 'N/A'}
Source: ${signal.url || 'N/A'}

LINKEDIN POST GUIDELINES:
- headline: A bold, attention-grabbing opening line (1 sentence, max 15 words). This appears in large text.
- body: The main post text (1000-2000 characters). Structure:
  * Open with a relatable observation or surprising fact
  * Share 2-3 key insights with specific data/examples
  * Include a personal or industry perspective
  * End with a question or call to discussion
  * Use line breaks between paragraphs (\\n\\n)
  * Professional but warm tone — you're an expert sharing knowledge, not selling
- hashtags: 3-5 relevant hashtags in Portuguese (e.g., #petmarket, #mercadopet, #veterinaria)
- ctaText: A closing question or prompt to drive comments (1 sentence)
- imagePrompt: A Pexels search query IN ENGLISH for an accompanying image (2-4 words)

TONE RULES:
1. Professional but accessible — like a knowledgeable colleague, not a corporate press release
2. Include specific data points or statistics when possible
3. Show industry expertise — reference trends, market dynamics
4. Encourage discussion — end with a genuine question
5. NO emojis in the body text (LinkedIn professional standard)
6. Use bullet points or numbered lists for key takeaways

OUTPUT FORMAT (return ONLY valid JSON):
{
  "headline": "Titulo chamativo aqui",
  "body": "Texto principal do post aqui...\\n\\nSegundo paragrafo...\\n\\nPergunta final?",
  "hashtags": ["mercadopet", "veterinaria", "petlovers"],
  "ctaText": "Qual a sua experiencia com isso? Compartilhe nos comentarios.",
  "imagePrompt": "veterinarian examining dog"
}`;
  }
}
