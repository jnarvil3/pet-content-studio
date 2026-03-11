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

// Generate reels
app.post('/api/generate-reel', async (req, res) => {
  try {
    const limit = parseInt(req.body.limit) || 1;
    const minScore = parseInt(req.body.minScore) || 80;

    // Import dependencies
    const { ReelGenerator } = await import('./generators/reel-generator');
    const { getBrandConfig } = await import('./config/brand-config');

    // Fetch signals
    const signals = intelConnector.getTopSignals(minScore, limit);

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
      const generator = new ReelGenerator(brand, './output/reels');

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

          try {
            const result = await generator.generate(signal);
            contentStorage.save(result.content);
            console.log(`[Server] ✅ Saved reel ${i + 1}/${signals.length}`);

            // Delay between generations
            if (i < signals.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          } catch (error: any) {
            console.error(`[Server] ❌ Failed reel ${i + 1}:`, error.message);
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

    // Import dependencies
    const { CarouselGenerator } = await import('./generators/carousel-generator');
    const { getBrandConfig } = await import('./config/brand-config');

    // Fetch signals
    const signals = intelConnector.getTopSignals(minScore, limit);

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
  console.log('  GET  /api/stats              - Dashboard statistics');
  console.log('  GET  /api/content            - List all content');
  console.log('  GET  /api/content/:id        - Get specific content');
  console.log('  POST /api/content/:id/approve - Approve content');
  console.log('  POST /api/content/:id/reject  - Reject content');
  console.log('  POST /api/content/:id/publish - Mark as published');
  console.log();
  console.log('='.repeat(60));
});

// Cleanup on exit
process.on('SIGINT', () => {
  contentStorage.close();
  intelConnector.close();
  process.exit();
});
