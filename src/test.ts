/**
 * Test Script - Verify Setup
 * Tests database connection and shows available signals
 */

import dotenv from 'dotenv';
dotenv.config();

import { IntelConnector } from './storage/intel-connector';
import { ContentStorage } from './storage/content-storage';
import { getBrandConfig } from './config/brand-config';
import { CarouselTemplate } from './templates/carousel-template';

async function test() {
  console.log('='.repeat(60));
  console.log('🧪 Testing Pet Content Generator Setup');
  console.log('='.repeat(60));
  console.log();

  try {
    // Test 1: Brand Configuration
    console.log('[1/4] Testing brand configuration...');
    const brand = getBrandConfig();
    console.log(`✅ Brand: ${brand.name} (${brand.handle})`);
    console.log(`   Colors: ${brand.colors.primary} / ${brand.colors.secondary}`);
    console.log(`   Voice: ${brand.voice.tone.join(', ')}`);
    console.log();

    // Test 2: Database Connection
    console.log('[2/4] Testing intelligence database connection...');
    const intelConnector = new IntelConnector();
    const signals = intelConnector.getTopSignals(70, 10);
    console.log(`✅ Found ${signals.length} signals (score >= 70)`);

    if (signals.length > 0) {
      console.log('\nTop 3 signals:');
      signals.slice(0, 3).forEach((signal, i) => {
        console.log(`   ${i + 1}. [${signal.relevance_score}] ${signal.title}`);
        console.log(`      Source: ${signal.source}`);
      });
    } else {
      console.log('⚠️  No signals found. Run pet-intel-collector first!');
    }
    console.log();

    // Test 3: Content Storage
    console.log('[3/4] Testing content storage...');
    const contentStorage = new ContentStorage();
    const stats = contentStorage.getStats();
    console.log(`✅ Content database connected`);
    console.log(`   Total content: ${stats.total}`);
    console.log(`   Pending: ${stats.pending}`);
    console.log(`   Approved: ${stats.approved}`);
    console.log();

    // Test 4: Template Generation
    console.log('[4/4] Testing template generation...');
    const template = new CarouselTemplate(brand);
    const testSlide = {
      slide_number: 1,
      heading: 'Test Hook Slide',
      body: 'This is a test carousel slide'
    };
    const html = template.generateSlideHTML(testSlide, 5);
    console.log(`✅ Template generation works`);
    console.log(`   Generated ${html.length} characters of HTML`);
    console.log();

    // Test 5: API Key Check
    console.log('[5/5] Checking API keys...');
    const hasOpenAIKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here';

    if (hasOpenAIKey) {
      console.log('✅ OPENAI_API_KEY configured');
    } else {
      console.log('⚠️  OPENAI_API_KEY not configured');
      console.log('   Add your OpenAI API key to .env to generate content');
    }
    console.log();

    console.log('='.repeat(60));
    if (signals.length > 0 && hasOpenAIKey) {
      console.log('✅ All systems ready! You can now generate carousels:');
      console.log('   npm run generate');
    } else {
      console.log('⚠️  Setup incomplete:');
      if (signals.length === 0) {
        console.log('   1. Run pet-intel-collector to collect signals');
      }
      if (!hasOpenAIKey) {
        console.log('   2. Add OPENAI_API_KEY to .env file');
      }
    }
    console.log('='.repeat(60));
    console.log();

    // Cleanup
    intelConnector.close();
    contentStorage.close();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error();
    console.error('Troubleshooting:');
    console.error('  - Make sure pet-intel-collector has been run');
    console.error('  - Check INTEL_DATABASE_PATH in .env points to signals.db');
    console.error('  - Verify database file exists');
    process.exit(1);
  }
}

test();
