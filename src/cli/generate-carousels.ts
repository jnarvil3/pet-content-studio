#!/usr/bin/env node
/**
 * CLI Tool: Generate Carousels
 * Fetches top signals from intelligence collector and generates carousels
 */

import dotenv from 'dotenv';
dotenv.config();

import { IntelConnector } from '../storage/intel-connector';
import { ContentStorage } from '../storage/content-storage';
import { CarouselGenerator } from '../generators/carousel-generator';
import { getBrandConfig } from '../config/brand-config';
import * as path from 'path';

async function main() {
  console.log('='.repeat(60));
  console.log('🎨 Pet Content Generator - Carousel Builder');
  console.log('='.repeat(60));
  console.log();

  // Parse command line args
  const args = process.argv.slice(2);
  const limit = args[0] ? parseInt(args[0]) : 3;
  const minScore = args[1] ? parseInt(args[1]) : 80;

  console.log(`📊 Fetching top ${limit} signals (score >= ${minScore})...\n`);

  // Connect to databases
  const intelConnector = new IntelConnector();
  const contentStorage = new ContentStorage();
  const brand = getBrandConfig();

  // Fetch top signals
  const signals = intelConnector.getTopSignals(minScore, limit);

  if (signals.length === 0) {
    console.log('❌ No relevant signals found with score >= ' + minScore);
    console.log('💡 Try lowering the minimum score or collect more signals first.\n');
    process.exit(1);
  }

  console.log(`✅ Found ${signals.length} signals:\n`);
  signals.forEach((signal, i) => {
    console.log(`${i + 1}. [Score: ${signal.relevance_score}] ${signal.title}`);
    console.log(`   Source: ${signal.source} | URL: ${signal.url}`);
    console.log();
  });

  // Initialize carousel generator
  const generator = new CarouselGenerator(brand, path.join(process.cwd(), 'data', 'output', 'carousels'));
  await generator.initialize();

  try {
    console.log('🎬 Starting carousel generation...\n');
    console.log('='.repeat(60));

    // Generate carousels for each signal
    for (let i = 0; i < signals.length; i++) {
      const signal = signals[i];

      console.log(`\n[${i + 1}/${signals.length}] Generating carousel for signal #${signal.id}`);
      console.log(`Topic: "${signal.title}"\n`);

      try {
        // Generate carousel
        const result = await generator.generate(signal);

        // Save to approval queue
        const contentId = contentStorage.save(result.content);

        console.log(`✅ Saved to approval queue as content #${contentId}`);
        console.log(`📁 Images saved to: ${result.imagePaths[0].split('/').slice(0, -1).join('/')}`);

        // Small delay between generations
        if (i < signals.length - 1) {
          console.log('\n⏳ Waiting 2 seconds before next generation...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        console.error(`❌ Failed to generate carousel: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Generation complete!\n');

    // Show stats
    const stats = contentStorage.getStats();
    console.log('📊 Content Queue Stats:');
    console.log(`   Total: ${stats.total}`);
    console.log(`   Pending approval: ${stats.pending}`);
    console.log(`   Approved: ${stats.approved}`);
    console.log(`   Rejected: ${stats.rejected}`);
    console.log(`   Published: ${stats.published}`);
    console.log();

    // Show pending queue
    const pending = contentStorage.getPendingQueue();
    if (pending.length > 0) {
      console.log('📋 Pending Approval Queue:');
      pending.forEach(item => {
        console.log(`   #${item.id} - Signal #${item.signal_id} - ${item.content_type} - ${item.generated_at}`);
      });
      console.log();
    }

    console.log('💡 Next steps:');
    console.log('   1. Review generated carousels in ./data/output/carousels/');
    console.log('   2. Approve/reject content using the approval API (coming soon)');
    console.log('   3. Publish approved content to Instagram');
    console.log();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    // Cleanup
    await generator.close();
    intelConnector.close();
    contentStorage.close();
  }
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
