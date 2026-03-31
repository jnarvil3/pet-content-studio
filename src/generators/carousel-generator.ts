/**
 * Carousel Generator Pipeline
 * Orchestrates the full carousel generation process:
 * Signal → Claude AI → HTML Templates → PNG Images
 */

import { Signal } from '../types/signal';
import { BrandConfig } from '../types/brand';
import { CarouselContent, GeneratedContent } from '../types/content';
import { ContentWriter, ViralInsights } from './content-writer';
import { CarouselTemplate } from '../templates/carousel-template';
import { ImageRenderer } from '../renderers/image-renderer';
import { PexelsService } from '../services/pexels-service';
import { ViralSignalsConnector } from '../storage/viral-signals-connector';
import * as path from 'path';
import * as fs from 'fs';

export interface CarouselGenerationResult {
  content: GeneratedContent;
  imagePaths: string[];
}

export class CarouselGenerator {
  private writer: ContentWriter;
  private template: CarouselTemplate;
  private renderer: ImageRenderer;
  private pexels: PexelsService;
  private brand: BrandConfig;
  private outputDir: string;

  constructor(brand: BrandConfig, outputDir: string = './output/carousels') {
    this.brand = brand;
    this.writer = new ContentWriter();
    this.template = new CarouselTemplate(brand);
    this.renderer = new ImageRenderer();
    this.pexels = new PexelsService();
    this.outputDir = outputDir;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  /**
   * Generate a complete carousel from a signal
   * @param signal - The topic signal to convert to carousel
   * @returns Generated content and image paths
   */
  async generate(signal: Signal, useViralData: boolean = true, editFeedback?: string, previousContent?: CarouselContent, version?: number, preciseMode: boolean = false): Promise<CarouselGenerationResult> {
    console.log(`\n[CarouselGenerator] Starting generation for signal #${signal.id}`);
    console.log(`[CarouselGenerator] Topic: "${signal.title}"`);

    try {
      // Step 1: Fetch viral insights (default behavior)
      let viralInsights: ViralInsights | undefined;
      if (useViralData) {
        console.log('[CarouselGenerator] Step 1/4: Fetching viral insights...');
        try {
          const viralConnector = new ViralSignalsConnector();
          const topHooks = viralConnector.getTopViralHooks(7, 5);
          const trendingThemes = viralConnector.getTrendingThemes(7, 10);
          const stats = viralConnector.getViralStats(7);
          viralConnector.close();

          // Extract themes as strings
          const themeStrings = trendingThemes
            .map(t => {
              try {
                const parsed = JSON.parse(t.content_themes);
                return Array.isArray(parsed) ? parsed.join(', ') : '';
              } catch {
                return '';
              }
            })
            .filter(t => t.length > 0)
            .slice(0, 5);

          viralInsights = {
            topHooks,
            trendingThemes: themeStrings,
            avgEngagement: stats.avg_engagement,
            recommendedHook: topHooks[0]?.hook_formula || undefined
          };

          console.log(`[CarouselGenerator] 🔥 Using viral data: ${stats.total_analyzed} videos, top hook = ${viralInsights.recommendedHook}`);
        } catch (error: any) {
          console.log(`[CarouselGenerator] ⚠️  Could not load viral data: ${error.message}`);
        }
      }

      // Step 2: Generate carousel content with Claude AI (with viral enhancement)
      console.log(`[CarouselGenerator] Step 2/4: Generating content with AI${viralInsights ? ' (viral-enhanced)' : ''}...`);
      const carouselContent = await this.writer.generateCarousel(signal, this.brand, viralInsights, editFeedback, previousContent, preciseMode);

      // Step 3: Fetch background photos using LLM-generated search queries
      console.log('[CarouselGenerator] Step 3/5: Fetching background images...');
      const photoPromises = carouselContent.slides.map(async (slide) => {
        if (slide.pexelsSearchQuery && this.pexels.isEnabled()) {
          const photos = await this.pexels.searchPhotos(slide.pexelsSearchQuery, 1);
          return photos.length > 0 ? this.pexels.getBestPhotoUrl(photos[0]) : undefined;
        }
        return undefined;
      });

      const backgroundUrls = await Promise.all(photoPromises);

      const successCount = backgroundUrls.filter(url => url).length;
      if (successCount > 0) {
        console.log(`[CarouselGenerator] ✅ Got ${successCount}/5 background photos from Pexels`);
      } else {
        console.log('[CarouselGenerator] ⚠️  No background photos (Pexels disabled or no results)');
      }

      // Step 4: Convert content to HTML slides
      console.log('[CarouselGenerator] Step 4/5: Rendering HTML templates...');
      const htmlSlides = carouselContent.slides.map((slide, index) => {
        return this.template.generateSlideHTML(slide, carouselContent.slides.length, backgroundUrls[index]);
      });

      // Step 4: Render HTML to PNG images
      console.log('[CarouselGenerator] Step 5/5: Converting to images...');
      const versionSuffix = version && version > 1 ? `-v${version}` : '';
      const carouselDir = path.join(this.outputDir, `signal-${signal.id}`);
      const imagePaths = await this.renderer.renderSlides(
        htmlSlides,
        carouselDir,
        `carousel-${signal.id}${versionSuffix}`
      );

      // Create metadata file
      const metadata = {
        signal_id: signal.id,
        signal_title: signal.title,
        signal_url: signal.url,
        relevance_score: signal.relevance_score,
        slides: carouselContent.slides,
        caption: carouselContent.caption,
        hashtags: carouselContent.hashtags,
        hook_explanation: carouselContent.hook_explanation,
        generated_at: new Date().toISOString()
      };

      const metadataPath = path.join(carouselDir, 'metadata.json');
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      // Create GeneratedContent object
      const generatedContent: GeneratedContent = {
        signal_id: signal.id,
        content_type: 'carousel',
        status: 'pending',
        carousel_content: carouselContent,
        carousel_images: imagePaths,
        source_url: signal.url,
        generated_at: new Date().toISOString()
      };

      console.log(`[CarouselGenerator] ✅ Complete! Saved to: ${carouselDir}`);
      console.log(`[CarouselGenerator] Images: ${imagePaths.length} slides`);
      console.log(`[CarouselGenerator] Caption: ${carouselContent.caption.substring(0, 50)}...`);
      console.log(`[CarouselGenerator] Hashtags: ${carouselContent.hashtags.join(' ')}\n`);

      return {
        content: generatedContent,
        imagePaths
      };
    } catch (error: any) {
      console.error(`[CarouselGenerator] ❌ Error generating carousel:`, error.message);
      throw error;
    }
  }

  /**
   * Generate multiple carousels from an array of signals
   */
  async generateBatch(signals: Signal[]): Promise<CarouselGenerationResult[]> {
    console.log(`[CarouselGenerator] Generating ${signals.length} carousels...\n`);

    const results: CarouselGenerationResult[] = [];

    for (const signal of signals) {
      try {
        const result = await this.generate(signal);
        results.push(result);

        // Small delay to avoid rate limiting
        await this.delay(1000);
      } catch (error: any) {
        console.error(`[CarouselGenerator] Failed for signal #${signal.id}:`, error.message);
        // Continue with next signal
      }
    }

    console.log(`[CarouselGenerator] ✅ Batch complete: ${results.length}/${signals.length} succeeded\n`);
    return results;
  }

  /**
   * Initialize renderer (opens browser)
   */
  async initialize(): Promise<void> {
    await this.renderer.initialize();
  }

  /**
   * Close renderer and clean up
   */
  async close(): Promise<void> {
    await this.renderer.close();
  }

  /**
   * Helper: Add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
