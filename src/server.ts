/**
 * Web Dashboard Server
 * Provides UI for reviewing and approving generated content
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { ContentStorage } from './storage/content-storage';
import { IntelConnector } from './storage/intel-connector';
import { ViralSignalsConnector } from './storage/viral-signals-connector';
import { SnapshotManager } from './services/snapshot-manager';
import { CollectionOrchestrator } from './services/collection-orchestrator';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve generated images
app.use('/output', express.static('output'));

// Initialize storage
const contentStorage = new ContentStorage();
const intelConnector = new IntelConnector();
const viralConnector = new ViralSignalsConnector();
const snapshotManager = new SnapshotManager();
const orchestrator = new CollectionOrchestrator();

// Progress tracking
interface GenerationProgress {
  step: number;
  totalSteps: number;
  message: string;
  estimatedTimeRemaining?: number;
}

const progressMap = new Map<string, GenerationProgress>();

/**
 * API Routes
 */

// Get dashboard stats
app.get('/api/stats', (req, res) => {
  try {
    const stats = contentStorage.getStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get available signals
app.get('/api/signals', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const minScore = parseInt(req.query.minScore as string) || 70;

    const signals = intelConnector.getTopSignals(minScore, limit);

    res.json({
      count: signals.length,
      signals: signals.map(signal => ({
        id: signal.id,
        title: signal.title,
        description: signal.description,
        source: signal.source,
        sourceType: 'RSS', // All current signals are RSS-based from pet-intel-collector
        url: signal.url,
        relevance_score: signal.relevance_score,
        relevance_reason: signal.relevance_reason,
        collected_at: signal.collected_at,
        scored_at: signal.scored_at
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get generation progress
app.get('/api/progress/:signalId', (req, res) => {
  const signalId = req.params.signalId;
  const progress = progressMap.get(signalId);

  if (!progress) {
    return res.json({ inProgress: false });
  }

  res.json({
    inProgress: true,
    ...progress
  });
});

// Get all content with optional status filter
app.get('/api/content', (req, res) => {
  try {
    const status = req.query.status as string;
    let content;

    if (status && ['pending', 'approved', 'rejected', 'published'].includes(status)) {
      content = contentStorage.getByStatus(status as any);
    } else {
      // Get all content
      const pending = contentStorage.getByStatus('pending');
      const approved = contentStorage.getByStatus('approved');
      const rejected = contentStorage.getByStatus('rejected');
      const published = contentStorage.getByStatus('published');
      content = [...pending, ...approved, ...rejected, ...published];
    }

    // Enrich with signal info
    const enriched = content.map(item => {
      const signal = intelConnector.getSignal(item.signal_id);
      return {
        ...item,
        signal: signal ? {
          title: signal.title,
          source: signal.source,
          relevance_score: signal.relevance_score,
          url: signal.url
        } : null
      };
    });

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific content by ID
app.get('/api/content/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const content = contentStorage.get(id);

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Enrich with signal info
    const signal = intelConnector.getSignal(content.signal_id);
    const enriched = {
      ...content,
      signal: signal ? {
        title: signal.title,
        description: signal.description,
        source: signal.source,
        relevance_score: signal.relevance_score,
        relevance_reason: signal.relevance_reason,
        url: signal.url
      } : null
    };

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Approve content
app.post('/api/content/:id/approve', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    contentStorage.approve(id);
    res.json({ success: true, message: 'Content approved' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reject content
app.post('/api/content/:id/reject', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const reason = req.body.reason || 'No reason provided';
    contentStorage.reject(id, reason);
    res.json({ success: true, message: 'Content rejected' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark as published
app.post('/api/content/:id/publish', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    contentStorage.markPublished(id);
    res.json({ success: true, message: 'Content marked as published' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get viral insights
app.get('/api/viral/insights', (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;

    const topHooks = viralConnector.getTopViralHooks(days, 10);
    const trendingThemes = viralConnector.getTrendingThemes(days, 20);
    const viralPatterns = viralConnector.getViralPatterns(days, 10);
    const stats = viralConnector.getViralStats(days);
    const emotionalTriggers = viralConnector.getTopEmotionalTriggers(days, 5);

    res.json({
      success: true,
      data: {
        stats,
        topHooks,
        trendingThemes,
        viralPatterns,
        emotionalTriggers
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Demo: Generate carousel with viral comparison
app.post('/api/demo/viral-comparison', async (req, res) => {
  try {
    const signalId = parseInt(req.body.signalId);
    if (!signalId) {
      return res.status(400).json({ error: 'signalId is required' });
    }

    // Get the signal
    const signal = intelConnector.getSignal(signalId);
    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }

    // Import dependencies
    const { ContentWriter } = await import('./generators/content-writer');
    const { getBrandConfig } = await import('./config/brand-config');

    const brand = getBrandConfig();
    const writer = new ContentWriter();

    // Get viral insights
    const topHooks = viralConnector.getTopViralHooks(7, 5);
    const trendingThemes = viralConnector.getTrendingThemes(7, 10);
    const stats = viralConnector.getViralStats(7);

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

    const viralInsights = {
      topHooks,
      trendingThemes: themeStrings,
      avgEngagement: stats.avg_engagement,
      recommendedHook: topHooks[0]?.hook_formula || undefined
    };

    console.log('\n' + '='.repeat(60));
    console.log('🎬 DEMO: Viral-Enhanced vs Standard Carousel Generation');
    console.log('='.repeat(60));
    console.log(`Signal: ${signal.title}`);
    console.log(`Viral Data: ${stats.total_analyzed} videos analyzed over ${stats.date_range_days} days`);
    console.log(`Top Hook: ${viralInsights.recommendedHook} (${topHooks[0]?.avg_engagement_rate.toFixed(1)}% avg engagement)`);
    console.log('='.repeat(60) + '\n');

    // Generate STANDARD carousel
    console.log('[Demo] Generating STANDARD carousel (no viral data)...');
    const standardContent = await writer.generateCarousel(signal, brand);

    // Generate VIRAL-ENHANCED carousel
    console.log('[Demo] Generating VIRAL-ENHANCED carousel (with viral insights)...');
    const viralContent = await writer.generateCarousel(signal, brand, viralInsights);

    console.log('\n' + '='.repeat(60));
    console.log('✅ DEMO COMPLETE - Comparison Ready');
    console.log('='.repeat(60) + '\n');

    res.json({
      success: true,
      signal: {
        id: signal.id,
        title: signal.title,
        description: signal.description,
        relevance_score: signal.relevance_score
      },
      viralInsights: {
        analyzedVideos: stats.total_analyzed,
        avgEngagement: stats.avg_engagement,
        topHook: viralInsights.recommendedHook,
        topHookEngagement: topHooks[0]?.avg_engagement_rate || 0,
        trendingThemes: themeStrings
      },
      standard: {
        hook: standardContent.slides[0].title,
        hookFormula: standardContent.hookFormula,
        caption: standardContent.caption,
        slides: standardContent.slides.map(s => ({
          number: s.slideNumber,
          title: s.title,
          body: s.body
        }))
      },
      viralEnhanced: {
        hook: viralContent.slides[0].title,
        hookFormula: viralContent.hookFormula,
        caption: viralContent.caption,
        slides: viralContent.slides.map(s => ({
          number: s.slideNumber,
          title: s.title,
          body: s.body
        }))
      },
      comparison: {
        hookChanged: standardContent.hookFormula !== viralContent.hookFormula,
        usedRecommendedHook: viralContent.hookFormula === viralInsights.recommendedHook,
        expectedEngagementBoost: topHooks[0] ? `+${((topHooks[0].avg_engagement_rate / 3.5 - 1) * 100).toFixed(0)}%` : 'Unknown'
      }
    });

  } catch (error: any) {
    console.error('[Demo] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Generate reels
app.post('/api/generate-reel', async (req, res) => {
  try {
    const limit = parseInt(req.body.limit) || 1;
    const minScore = parseInt(req.body.minScore) || 80;
    const signalId = req.body.signalId ? parseInt(req.body.signalId) : null;
    const viralHook = req.body.viralHook; // Selected viral hook formula
    const viralVideoId = req.body.viralVideoId; // Source viral video ID
    const viralTitle = req.body.viralTitle; // Actual viral video title
    const viralContentAngle = req.body.viralContentAngle; // Content angle
    const aiModel = req.body.aiModel as 'claude-sonnet-4' | 'gpt-4o-mini'; // AI model selection

    // Import dependencies
    const { ReelGenerator } = await import('./generators/reel-generator');
    const { getBrandConfig } = await import('./config/brand-config');

    // Fetch signals - either specific signal or top signals
    let signals;
    if (signalId) {
      const signal = intelConnector.getSignal(signalId);
      if (!signal) {
        return res.status(404).json({
          error: `Signal #${signalId} not found`
        });
      }
      signals = [signal];
    } else {
      signals = intelConnector.getTopSignals(minScore, limit);
    }

    if (signals.length === 0) {
      return res.status(400).json({
        error: `No signals found with score >= ${minScore}`,
        suggestion: 'Try lowering the minimum score or run the intelligence collector first'
      });
    }

    // Start generation in background
    res.json({
      success: true,
      message: `Starting generation of ${signals.length} reel(s)...`,
      count: signals.length
    });

    // Generate reels asynchronously
    (async () => {
      const brand = getBrandConfig();
      const generator = new ReelGenerator(brand, './output/reels', aiModel);

      // Check FFmpeg
      const hasFFmpeg = await generator.checkFFmpeg();
      if (!hasFFmpeg) {
        console.error('[Server] ❌ FFmpeg not found! Install it first: brew install ffmpeg');
        return;
      }

      try {
        for (let i = 0; i < signals.length; i++) {
          const signal = signals[i];
          console.log(`\n[Server] Generating reel ${i + 1}/${signals.length} for signal #${signal.id}`);

          // Progress callback
          const onProgress = (step: number, totalSteps: number, message: string, estimatedTime?: number) => {
            progressMap.set(signal.id.toString(), {
              step,
              totalSteps,
              message,
              estimatedTimeRemaining: estimatedTime
            });
          };

          try {
            // Pass viral pattern if selected
            const options = viralHook ? {
              viralHook,
              viralVideoId,
              viralTitle,
              viralContentAngle
            } : undefined;
            const result = await generator.generate(signal, onProgress, options);
            contentStorage.save(result.content);
            console.log(`[Server] ✅ Saved reel ${i + 1}/${signals.length}`);

            // Clear progress
            progressMap.delete(signal.id.toString());

            // Delay between generations
            if (i < signals.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          } catch (error: any) {
            console.error(`[Server] ❌ Failed reel ${i + 1}:`, error.message);
            progressMap.delete(signal.id.toString());
          }
        }

        console.log(`\n[Server] ✅ Reel generation complete! Generated ${signals.length} reels\n`);
      } catch (error: any) {
        console.error('[Server] Error in reel generation:', error);
      }
    })();

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Generate carousels
app.post('/api/generate', async (req, res) => {
  try {
    const limit = parseInt(req.body.limit) || 3;
    const minScore = parseInt(req.body.minScore) || 80;
    const signalId = req.body.signalId ? parseInt(req.body.signalId) : null;

    // Import dependencies
    const { CarouselGenerator } = await import('./generators/carousel-generator');
    const { getBrandConfig } = await import('./config/brand-config');

    // Fetch signals - either specific signal or top signals
    let signals;
    if (signalId) {
      const signal = intelConnector.getSignal(signalId);
      if (!signal) {
        return res.status(404).json({
          error: `Signal #${signalId} not found`
        });
      }
      signals = [signal];
    } else {
      signals = intelConnector.getTopSignals(minScore, limit);
    }

    if (signals.length === 0) {
      return res.status(400).json({
        error: `No signals found with score >= ${minScore}`,
        suggestion: 'Try lowering the minimum score or run the intelligence collector first'
      });
    }

    // Start generation in background
    res.json({
      success: true,
      message: `Starting generation of ${signals.length} carousels...`,
      count: signals.length
    });

    // Generate carousels asynchronously
    (async () => {
      const brand = getBrandConfig();
      const generator = new CarouselGenerator(brand, './output/carousels');
      await generator.initialize();

      try {
        for (let i = 0; i < signals.length; i++) {
          const signal = signals[i];
          console.log(`\n[Server] Generating carousel ${i + 1}/${signals.length} for signal #${signal.id}`);

          try {
            const result = await generator.generate(signal);
            contentStorage.save(result.content);
            console.log(`[Server] ✅ Saved carousel ${i + 1}/${signals.length}`);

            // Small delay between generations
            if (i < signals.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (error: any) {
            console.error(`[Server] ❌ Failed carousel ${i + 1}:`, error.message);
          }
        }

        console.log(`\n[Server] ✅ Generation complete! Generated ${signals.length} carousels\n`);
      } finally {
        await generator.close();
      }
    })();

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Serve frontend
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🎨 Pet Content Generator Dashboard');
  console.log('='.repeat(60));
  console.log();
  console.log(`✅ Server running at: http://localhost:${PORT}`);
  console.log();
  console.log('Available endpoints:');
  console.log('  GET  /api/stats                  - Dashboard statistics');
  console.log('  GET  /api/signals                - Available signals');
  console.log('  GET  /api/content                - List all content');
  console.log('  GET  /api/content/:id            - Get specific content');
  console.log('  POST /api/content/:id/approve    - Approve content');
  console.log('  POST /api/content/:id/reject     - Reject content');
  console.log('  POST /api/content/:id/publish    - Mark as published');
  console.log('  POST /api/generate               - Generate carousels');
  console.log('  POST /api/generate-reel          - Generate reels');
  console.log();
  console.log('🔥 Viral Integration:');
  console.log('  GET  /api/viral/insights         - Get viral trends & insights');
  console.log('  POST /api/demo/viral-comparison  - Demo: Compare standard vs viral-enhanced');
  console.log();
  console.log('='.repeat(60));
});

// Cleanup on exit
process.on('SIGINT', () => {
  contentStorage.close();
  intelConnector.close();
  viralConnector.close();
  process.exit();
});
