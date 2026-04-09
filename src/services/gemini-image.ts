/**
 * Gemini Image Generation Service
 * Uses Google's Imagen model via @google/genai to generate custom images for carousel slides.
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
   * Generate an image from a text prompt using Imagen via Gemini API.
   * Returns the file path of the saved PNG image.
   */
  async generateImage(prompt: string, outputPath: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GOOGLE_AI_API_KEY not configured');
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    console.log(`[GeminiImage] Generating image for: "${prompt.substring(0, 60)}..."`);

    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt,
      config: {
        numberOfImages: 1,
      },
    });

    if (!response.generatedImages || response.generatedImages.length === 0) {
      throw new Error('No image generated');
    }

    const imgBytes = response.generatedImages[0].image?.imageBytes;
    if (!imgBytes) {
      throw new Error('Image bytes not found in response');
    }

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const buffer = Buffer.from(imgBytes, 'base64');
    fs.writeFileSync(outputPath, buffer);

    console.log(`[GeminiImage] ✅ Image saved to ${outputPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
    return outputPath;
  }
}
