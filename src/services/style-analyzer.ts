/**
 * Style Analyzer Service
 * Uses Gemini 2.5 Flash vision to analyze uploaded carousel screenshots
 * and extract structured content/style information.
 */

import * as fs from 'fs';
import { CarouselAnalysis } from '../types/content';

export class StyleAnalyzer {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.GOOGLE_AI_API_KEY;
  }

  isEnabled(): boolean {
    return !!this.apiKey;
  }

  /**
   * Analyze 1-5 carousel screenshot images and return structured analysis.
   * @param imagePaths - Array of file paths to uploaded screenshots
   * @returns CarouselAnalysis with structure, tone, and style info
   */
  async analyze(imagePaths: string[]): Promise<CarouselAnalysis> {
    if (!this.apiKey) {
      throw new Error('GOOGLE_AI_API_KEY not configured — required for reference carousel analysis');
    }

    if (imagePaths.length === 0 || imagePaths.length > 5) {
      throw new Error('Please upload between 1 and 5 images');
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    console.log(`[StyleAnalyzer] Analyzing ${imagePaths.length} carousel screenshot(s)...`);

    // Build multimodal content parts: images + analysis prompt
    const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];

    for (const imagePath of imagePaths) {
      const buffer = fs.readFileSync(imagePath);
      const base64 = buffer.toString('base64');
      const ext = imagePath.toLowerCase().split('.').pop();
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

      parts.push({
        inlineData: { mimeType, data: base64 }
      });
    }

    parts.push({ text: ANALYSIS_PROMPT });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini returned no analysis — try with clearer screenshots');
    }

    const analysis = JSON.parse(text) as CarouselAnalysis;

    console.log(`[StyleAnalyzer] ✅ Analysis complete: ${analysis.slideCount} slides detected, flow: ${analysis.contentFlow}`);
    return analysis;
  }
}

const ANALYSIS_PROMPT = `You are analyzing Instagram carousel screenshots. These are 1-5 slide images from a single carousel post.

Examine each image carefully and extract the following structured information.

Return ONLY valid JSON matching this exact schema:

{
  "slideCount": <number of slides you see>,
  "slides": [
    {
      "slideType": "<one of: hook, problem, insight, tip, cta, content, stat, testimonial>",
      "contentSummary": "<what this slide communicates in 1-2 sentences>",
      "textStyle": "<describe the text layout: e.g. 'bold headline only', 'headline + short body', 'large stat + context', 'brand handle + question'>",
      "keyPhrases": ["<exact key phrases or text you can read from the slide>"]
    }
  ],
  "contentFlow": "<describe the overall flow, e.g. 'Hook → Problem → Stat → Tip → CTA'>",
  "tone": "<describe the tone: e.g. 'casual and conversational', 'professional and data-driven', 'emotional and personal'>",
  "hookFormula": "<classify the hook: curiosity_gap, contrarian, mistake_hook, personal_specific, question_hook, number_outcome, or other>",
  "hookText": "<the actual hook text from the first slide, transcribed exactly>",
  "ctaPattern": "<describe the CTA approach on the last slide, e.g. 'Follow + comment question', 'Save this post', 'Link in bio'>",
  "visualStyle": {
    "theme": "<dark, light, colorful, or minimal>",
    "density": "<text-heavy, balanced, or photo-heavy>",
    "style": "<free-form notes on visual approach: colors, font weight, image use, overlay style, etc.>"
  }
}

IMPORTANT:
- If you can only see some slides (e.g., 3 out of 5), analyze what you see and set slideCount to the number you can see.
- Read ALL visible text from each slide — transcribe it in keyPhrases.
- The text may be in any language (often Portuguese). Transcribe it as-is.
- Be specific about the content flow — this is the most important output for replication.
- For hookFormula, match to the closest category even if it's not exact.`;
