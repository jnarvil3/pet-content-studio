/**
 * Pollinations.ai Image Generation Service
 * Free, no API key required. Generates images from text prompts only.
 * Does NOT support reference image input — text descriptions only.
 * Uses FLUX models under the hood.
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

export class PollinationsImageService {

  /**
   * Generate an image from a text prompt.
   * @param prompt - Text description of the image to generate
   * @param outputPath - Where to save the PNG
   * @param width - Image width (default 1080)
   * @param height - Image height (default 1350 for Instagram portrait)
   */
  async generateImage(prompt: string, outputPath: string, width = 1080, height = 1350): Promise<string> {
    // Keep prompts short — Pollinations can fail on very long encoded URLs
    const shortPrompt = prompt.length > 200 ? prompt.substring(0, 200) : prompt;
    const encoded = encodeURIComponent(shortPrompt);
    const seed = Math.floor(Math.random() * 100000);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=sana&seed=${seed}`;

    console.log(`[Pollinations] Generating image: "${shortPrompt.substring(0, 60)}..."`);

    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 90000 });
    const buffer = Buffer.from(response.data);

    // Verify we got an image, not a JSON error
    if (buffer.length < 1000 || buffer.toString('utf-8', 0, 10).includes('{')) {
      throw new Error('Pollinations returned an error instead of an image');
    }

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(outputPath, buffer);
    console.log(`[Pollinations] ✅ Image saved to ${outputPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
    return outputPath;
  }
}
