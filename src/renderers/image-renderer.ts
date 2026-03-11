/**
 * Puppeteer Image Renderer
 * Converts HTML slides to 1080x1080 PNG images
 */

import puppeteer, { Browser } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

export class ImageRenderer {
  private browser: Browser | null = null;

  /**
   * Initialize Puppeteer browser
   */
  async initialize(): Promise<void> {
    if (!this.browser) {
      console.log('[ImageRenderer] Launching headless browser...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log('[ImageRenderer] ✅ Browser ready');
    }
  }

  /**
   * Render HTML to PNG image
   * @param html - HTML content to render
   * @param outputPath - Path to save PNG file
   */
  async renderToPNG(html: string, outputPath: string): Promise<void> {
    if (!this.browser) {
      await this.initialize();
    }

    const page = await this.browser!.newPage();

    try {
      // Set viewport to Instagram 4:5 portrait size
      await page.setViewport({
        width: 1080,
        height: 1350,
        deviceScaleFactor: 2 // Retina quality
      });

      // Load HTML content
      await page.setContent(html, {
        waitUntil: 'networkidle0'
      });

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Take screenshot
      await page.screenshot({
        path: outputPath,
        type: 'png',
        omitBackground: false
      });

      console.log(`[ImageRenderer] ✅ Rendered: ${path.basename(outputPath)}`);
    } catch (error: any) {
      console.error('[ImageRenderer] Error rendering image:', error.message);
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Render multiple slides to PNG images
   * @param htmlSlides - Array of HTML content
   * @param outputDir - Directory to save PNG files
   * @param prefix - Filename prefix (e.g., 'carousel-123')
   * @returns Array of output file paths
   */
  async renderSlides(
    htmlSlides: string[],
    outputDir: string,
    prefix: string = 'slide'
  ): Promise<string[]> {
    const outputPaths: string[] = [];

    for (let i = 0; i < htmlSlides.length; i++) {
      const filename = `${prefix}-${i + 1}.png`;
      const outputPath = path.join(outputDir, filename);

      await this.renderToPNG(htmlSlides[i], outputPath);
      outputPaths.push(outputPath);
    }

    console.log(`[ImageRenderer] ✅ Rendered ${outputPaths.length} slides`);
    return outputPaths;
  }

  /**
   * Close browser and clean up
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('[ImageRenderer] Browser closed');
    }
  }
}
