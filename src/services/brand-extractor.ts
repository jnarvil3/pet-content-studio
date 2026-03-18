/**
 * Brand Knowledge Extractor
 * Processes uploaded brand documents (PDFs, images) and extracts
 * structured brand knowledge for content generation.
 *
 * Tiers:
 * - Básico: Gemini Flash (~$0.004 per 50-page PDF)
 * - Padrão: Claude Haiku (~$0.04 per 50-page PDF) [default]
 * - Premium: Claude Sonnet (~$0.15 per 50-page PDF)
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { BrandProfile } from '../types/brand';

type ExtractionTier = 'basico' | 'padrao' | 'premium';

const TIER_MODELS: Record<ExtractionTier, { provider: 'anthropic'; model: string }> = {
  basico: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  padrao: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  premium: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }
};

const EXTRACTION_PROMPT = `You are a brand analyst. Analyze the uploaded brand document and extract structured brand knowledge.

Return ONLY valid JSON with this exact structure:
{
  "voice": {
    "tone_adjectives": ["3-5 adjectives describing the brand's tone of voice"],
    "writing_style": "Description of how the brand writes — sentence length, formality, use of pronouns, etc.",
    "example_phrases": ["3-5 phrases or taglines that capture this brand's voice"],
    "forbidden_words": ["words the brand should never use"],
    "forbidden_claims": ["claims the brand should never make"]
  },
  "visual": {
    "primary_color": "#hex if mentioned or visible",
    "secondary_color": "#hex if mentioned or visible",
    "font_style": "description of typography preferences",
    "logo_usage_rules": "rules about logo placement, sizing, backgrounds"
  },
  "content_rules": {
    "topics_to_emphasize": ["key themes the brand focuses on"],
    "topics_to_avoid": ["topics to stay away from"],
    "target_audience": "description of the ideal audience",
    "cta_style": "how the brand prefers to close content — hard sell, soft sell, educational, etc."
  },
  "brand_story": "2-3 paragraph summary of what this brand is, its mission, and its personality"
}

Be specific and detailed. If the document doesn't mention something, make reasonable inferences based on the overall brand personality. Write all values in Portuguese (PT-BR) since the brand targets Brazilian audiences.`;

export class BrandExtractor {
  private anthropic: Anthropic;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  /**
   * Extract brand knowledge from a PDF document
   */
  async extractFromPDF(pdfPath: string, tier: ExtractionTier = 'padrao'): Promise<BrandProfile> {
    const { model } = TIER_MODELS[tier];
    console.log(`[BrandExtractor] Processing PDF with ${model} (tier: ${tier})`);

    const pdfData = fs.readFileSync(pdfPath);
    const base64PDF = pdfData.toString('base64');
    const mediaType = 'application/pdf';

    try {
      const response = await this.anthropic.messages.create({
        model,
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: mediaType, data: base64PDF }
            },
            { type: 'text', text: EXTRACTION_PROMPT }
          ]
        }]
      });

      const textContent = response.content.find(b => b.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from AI');
      }

      // Parse JSON from response (handle markdown code blocks)
      let jsonText = textContent.text;
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonText = jsonMatch[1];

      const profile: BrandProfile = {
        ...JSON.parse(jsonText.trim()),
        extracted_at: new Date().toISOString(),
        extraction_model: model
      };

      console.log(`[BrandExtractor] Extracted brand profile: ${profile.voice.tone_adjectives.join(', ')}`);
      console.log(`[BrandExtractor] Cost: ~$${(response.usage.input_tokens * 0.001 / 1000 + response.usage.output_tokens * 0.005 / 1000).toFixed(4)}`);

      return profile;
    } catch (error: any) {
      console.error('[BrandExtractor] Extraction failed:', error.message);
      throw error;
    }
  }

  /**
   * Extract brand knowledge from an image (logo, screenshot, etc.)
   */
  async extractFromImage(imagePath: string, tier: ExtractionTier = 'padrao'): Promise<Partial<BrandProfile>> {
    const { model } = TIER_MODELS[tier];
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    const mediaType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    try {
      const response = await this.anthropic.messages.create({
        model,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType as any, data: base64Image }
            },
            {
              type: 'text',
              text: `Analyze this brand image/logo. Extract:
1. Primary and secondary colors (as hex codes)
2. Font style observations
3. Visual mood/personality
4. Any text or taglines visible

Return JSON: { "visual": { "primary_color": "#hex", "secondary_color": "#hex", "font_style": "description", "logo_usage_rules": "observations" }, "voice": { "tone_adjectives": ["inferred from visual style"] } }`
            }
          ]
        }]
      });

      const textContent = response.content.find(b => b.type === 'text');
      if (!textContent || textContent.type !== 'text') return {};

      let jsonText = textContent.text;
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonText = jsonMatch[1];

      return JSON.parse(jsonText.trim());
    } catch (error: any) {
      console.error('[BrandExtractor] Image extraction failed:', error.message);
      return {};
    }
  }

  /**
   * Extract dominant colors from a logo image (free, no API)
   */
  async extractColors(imagePath: string): Promise<{ primary: string; secondary: string; accent: string }> {
    try {
      const ColorThief = (await import('colorthief')).default;
      const dominant = await ColorThief.getColor(imagePath);
      const palette = await ColorThief.getPalette(imagePath, 3);

      const toHex = (rgb: number[]) => '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');

      return {
        primary: toHex(dominant),
        secondary: palette[1] ? toHex(palette[1]) : toHex(dominant),
        accent: palette[2] ? toHex(palette[2]) : '#4caf50'
      };
    } catch (error: any) {
      console.error('[BrandExtractor] Color extraction failed:', error.message);
      return { primary: '#667eea', secondary: '#764ba2', accent: '#4caf50' };
    }
  }

  /**
   * Save extracted brand profile
   */
  saveProfile(profile: BrandProfile): void {
    const profilePath = path.join(__dirname, '../../config/brand-profile.json');
    const dir = path.dirname(profilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
    console.log(`[BrandExtractor] Profile saved to ${profilePath}`);
  }

  /**
   * Load existing brand profile
   */
  static loadProfile(): BrandProfile | null {
    const profilePath = path.join(__dirname, '../../config/brand-profile.json');
    if (fs.existsSync(profilePath)) {
      return JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
    }
    return null;
  }
}
