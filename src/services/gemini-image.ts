/**
 * Gemini Image Generation Service
 * Uses Gemini's native image generation (generateContent with image output)
 * via @google/genai. This replaces the Imagen API which sunsets June 24, 2026.
 * Requires GOOGLE_AI_API_KEY env var.
 */

import * as fs from 'fs';
import * as path from 'path';

export class GeminiImageService {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.GOOGLE_AI_API_KEY;
  }

  isEnabled(): boolean {
    return !!this.apiKey;
  }

  /**
   * Generate an image from a text prompt using Gemini's native image generation.
   * Returns the file path of the saved PNG image.
   */
  async generateImage(prompt: string, outputPath: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GOOGLE_AI_API_KEY not configured');
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    console.log(`[GeminiImage] Generating image for: "${prompt.substring(0, 60)}..."`);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt,
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    });

    // Extract image from response parts
    let imageData: string | undefined;
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        imageData = part.inlineData.data;
        break;
      }
    }

    if (!imageData) {
      throw new Error('No image generated — model returned text only');
    }

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const buffer = Buffer.from(imageData, 'base64');
    fs.writeFileSync(outputPath, buffer);

    console.log(`[GeminiImage] ✅ Image saved to ${outputPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
    return outputPath;
  }

  /**
   * Generate an image using reference images as visual input.
   * Sends the actual reference screenshots to Gemini so it can see the style
   * directly — no lossy text-description intermediary.
   */
  async generateFromReference(
    prompt: string,
    referenceImagePaths: string[],
    outputPath: string
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GOOGLE_AI_API_KEY not configured');
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    console.log(`[GeminiImage] Generating from ${referenceImagePaths.length} reference(s): "${prompt.substring(0, 60)}..."`);

    // Build multimodal parts: reference images + text prompt
    const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];

    for (const imgPath of referenceImagePaths) {
      const buffer = fs.readFileSync(imgPath);
      const ext = imgPath.toLowerCase().split('.').pop();
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      parts.push({ inlineData: { mimeType, data: buffer.toString('base64') } });
    }

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    });

    // Extract image from response
    let imageData: string | undefined;
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        imageData = part.inlineData.data;
        break;
      }
    }

    if (!imageData) {
      throw new Error('No image generated — model returned text only');
    }

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const buffer = Buffer.from(imageData, 'base64');
    fs.writeFileSync(outputPath, buffer);

    console.log(`[GeminiImage] ✅ Reference-based image saved to ${outputPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
    return outputPath;
  }
}
