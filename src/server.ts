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

// Simple password auth for production deployment
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;
if (AUTH_PASSWORD) {
  app.use((req, res, next) => {
    // Allow static assets without auth
    if (req.path.startsWith('/i18n/') || req.path === '/login') {
      return next();
    }

    // Check for auth cookie or basic auth
    const authHeader = req.headers.authorization;
    const authCookie = req.headers.cookie?.split(';').find(c => c.trim().startsWith('auth='));

    if (authCookie?.includes(AUTH_PASSWORD) || (authHeader && Buffer.from(authHeader.split(' ')[1] || '', 'base64').toString().endsWith(`:${AUTH_PASSWORD}`))) {
      return next();
    }

    // Show login page for browser requests
    if (req.accepts('html') && !req.path.startsWith('/api/')) {
      return res.send(`<!DOCTYPE html><html lang="pt-BR"><head><title>Login - Pet Content Studio</title>
        <style>body{display:flex;justify-content:center;align-items:center;min-height:100vh;background:linear-gradient(135deg,#667eea,#764ba2);font-family:sans-serif;margin:0}
        .box{background:white;padding:2rem;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,.2);text-align:center;max-width:350px;width:90%}
        input{width:100%;padding:.75rem;border:2px solid #e0e0e0;border-radius:8px;font-size:1rem;margin:.75rem 0;box-sizing:border-box}
        button{width:100%;padding:.75rem;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer}</style></head>
        <body><div class="box"><h2>🐾 Pet Content Studio</h2><form onsubmit="document.cookie='auth='+document.getElementById('p').value+';path=/;max-age=2592000';location.reload();return false">
        <input id="p" type="password" placeholder="Senha" autofocus><button type="submit">Entrar</button></form></div></body></html>`);
    }

    res.status(401).json({ error: 'Authentication required' });
  });
  console.log('[Auth] Password protection enabled');
}

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

    if (status && ['pending', 'approved', 'rejected', 'published', 'revision_requested'].includes(status)) {
      content = contentStorage.getByStatus(status as any);
    } else {
      // Get all content
      const pending = contentStorage.getByStatus('pending');
      const revision = contentStorage.getByStatus('revision_requested');
      const approved = contentStorage.getByStatus('approved');
      const rejected = contentStorage.getByStatus('rejected');
      const published = contentStorage.getByStatus('published');
      content = [...pending, ...revision, ...approved, ...rejected, ...published];
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

// Request revision with feedback
app.post('/api/content/:id/request-revision', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { feedback_text, specific_changes } = req.body;

    if (!feedback_text) {
      return res.status(400).json({ error: 'feedback_text is required' });
    }

    // Save feedback
    contentStorage.saveFeedback({
      content_id: id,
      feedback_type: 'edit_request',
      feedback_text,
      specific_changes: specific_changes || undefined,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    // Update content status
    contentStorage.requestRevision(id);

    res.json({ success: true, message: 'Revision requested' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Submit feedback (comment without status change)
app.post('/api/content/:id/feedback', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { feedback_text, feedback_type } = req.body;

    if (!feedback_text) {
      return res.status(400).json({ error: 'feedback_text is required' });
    }

    const feedbackId = contentStorage.saveFeedback({
      content_id: id,
      feedback_type: feedback_type || 'comment',
      feedback_text,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    res.json({ success: true, id: feedbackId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get feedback for content
app.get('/api/content/:id/feedback', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const feedback = contentStorage.getFeedback(id);
    res.json(feedback);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get version history
app.get('/api/content/:id/versions', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const versions = contentStorage.getVersions(id);
    res.json(versions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Regenerate content with feedback
app.post('/api/content/:id/regenerate', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const original = contentStorage.get(id);

    if (!original) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Get pending feedback for this content
    const feedback = contentStorage.getFeedback(id);
    const pendingFeedback = feedback.filter(f => f.status === 'pending');
    const feedbackText = pendingFeedback.map(f => f.feedback_text).join('\n');

    if (!feedbackText) {
      return res.status(400).json({ error: 'No pending feedback to address' });
    }

    const signal = intelConnector.getSignal(original.signal_id);
    if (!signal) {
      return res.status(404).json({ error: 'Original signal not found' });
    }

    // Start regeneration in background
    res.json({ success: true, message: 'Regeneration started' });

    (async () => {
      try {
        const { getBrandConfig } = await import('./config/brand-config');
        const brand = getBrandConfig();

        if (original.content_type === 'carousel') {
          const { CarouselGenerator } = await import('./generators/carousel-generator');
          const generator = new CarouselGenerator(brand, './output/carousels');
          await generator.initialize();

          try {
            const result = await generator.generate(signal, true, feedbackText);
            result.content.version = (original.version || 1) + 1;
            result.content.parent_id = original.id;
            const newId = contentStorage.save(result.content);
            console.log(`[Server] Regenerated carousel as v${result.content.version}, id #${newId}`);
          } finally {
            await generator.close();
          }
        } else if (original.content_type === 'reel') {
          const { ReelGenerator } = await import('./generators/reel-generator');
          const generator = new ReelGenerator(brand, './output/reels');

          const onProgress = (step: number, totalSteps: number, message: string) => {
            progressMap.set(signal.id.toString(), { step, totalSteps, message });
          };

          const result = await generator.generate(signal, onProgress, undefined, feedbackText);
          result.content.version = (original.version || 1) + 1;
          result.content.parent_id = original.id;
          const newId = contentStorage.save(result.content);
          progressMap.delete(signal.id.toString());
          console.log(`[Server] Regenerated reel as v${result.content.version}, id #${newId}`);
        }

        // Mark feedback as addressed
        for (const fb of pendingFeedback) {
          if (fb.id) contentStorage.addressFeedback(fb.id);
        }
      } catch (error: any) {
        console.error('[Server] Regeneration failed:', error.message);
      }
    })();
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

// Brand configuration
app.get('/api/brand', async (req, res) => {
  try {
    const { getBrandConfig } = await import('./config/brand-config');
    const brand = getBrandConfig();
    res.json(brand);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/brand', async (req, res) => {
  try {
    const { saveBrandConfig, clearBrandCache } = await import('./config/brand-config');
    saveBrandConfig(req.body);
    clearBrandCache();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/brand/reset', async (req, res) => {
  try {
    const { saveBrandConfig, clearBrandCache } = await import('./config/brand-config');
    const { defaultBrandConfig } = await import('./types/brand');
    saveBrandConfig(defaultBrandConfig);
    clearBrandCache();
    res.json({ success: true });
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

// Generate LinkedIn post
app.post('/api/generate-linkedin', async (req, res) => {
  try {
    const signalId = req.body.signalId ? parseInt(req.body.signalId) : null;

    if (!signalId) {
      return res.status(400).json({ error: 'signalId is required' });
    }

    const signal = intelConnector.getSignal(signalId);
    if (!signal) {
      return res.status(404).json({ error: `Signal #${signalId} not found` });
    }

    // Start generation
    res.json({ success: true, message: 'Generating LinkedIn post...' });

    (async () => {
      try {
        const { LinkedInWriter } = await import('./generators/linkedin-writer');
        const { getBrandConfig } = await import('./config/brand-config');

        const brand = getBrandConfig();
        const writer = new LinkedInWriter();
        const linkedinContent = await writer.generatePost(signal, brand);

        const content = {
          signal_id: signal.id,
          content_type: 'linkedin' as const,
          status: 'pending' as const,
          linkedin_content: linkedinContent,
          source_url: signal.url,
          generated_at: new Date().toISOString()
        };

        contentStorage.save(content);
        console.log(`[Server] LinkedIn post saved for signal #${signal.id}`);
      } catch (error: any) {
        console.error('[Server] LinkedIn generation failed:', error.message);
      }
    })();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Pet classification helper
function isPetRelated(themes: string): boolean {
  const petKeywords = [
    'pet', 'dog', 'cat', 'puppy', 'kitten', 'animal', 'pup', 'kitty', 'canine', 'feline', 'doggo', 'pupper', 'fur baby', 'vet', 'breed',
    'cachorro', 'cachorra', 'gato', 'gata', 'filhote', 'cão', 'cadela', 'gatinho', 'gatinha', 'animais', 'veterinário', 'veterinaria', 'pets', 'felino', 'canino', 'miau', 'pata', 'focinho', 'cãozinho', 'doguinho'
  ];
  const lower = (themes || '').toLowerCase();
  return petKeywords.some(kw => lower.includes(kw));
}

// Collection trigger
app.post('/api/collection/trigger', async (req, res) => {
  try {
    const jobId = await orchestrator.triggerCollection();
    res.json({ success: true, jobId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Collection status (SSE)
app.get('/api/collection/status/:jobId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const jobId = req.params.jobId;

  // Send current status immediately
  const job = orchestrator.getJob(jobId);
  if (job) {
    res.write(`data: ${JSON.stringify(job)}\n\n`);
  }

  // Listen for updates
  const onUpdate = (updatedJob: any) => {
    if (updatedJob.jobId === jobId) {
      res.write(`data: ${JSON.stringify(updatedJob)}\n\n`);
      if (updatedJob.status === 'complete' || updatedJob.status === 'error') {
        res.end();
      }
    }
  };

  orchestrator.on('job-update', onUpdate);

  req.on('close', () => {
    orchestrator.removeListener('job-update', onUpdate);
  });
});

// Historical trending videos
app.get('/api/trending/videos', async (req, res) => {
  try {
    const period = (req.query.period as string) || 'today';
    const petOnly = req.query.petOnly === 'true';

    // For 'today', fetch live data from viral connector with pet filtering
    if (period === 'today') {
      const topHooks = viralConnector.getTopViralHooks(7, 20);
      const themes = viralConnector.getTrendingThemes(7, 50);
      const stats = viralConnector.getViralStats(7);

      // Filter by pet if needed
      let filteredThemes = themes;
      if (petOnly) {
        filteredThemes = themes.filter(t => isPetRelated(t.content_themes));
      }

      return res.json({
        success: true,
        data: {
          period,
          petOnly,
          videos: filteredThemes.slice(0, 20),
          hooks: topHooks.slice(0, 10),
          stats: {
            totalAnalyzed: stats.total_analyzed,
            avgEngagement: stats.avg_engagement
          }
        }
      });
    }

    // For historical periods, use snapshot manager
    const data = await snapshotManager.getHistoricalData(
      period as any,
      'videos',
      petOnly
    );

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Historical trending hooks
app.get('/api/trending/hooks', async (req, res) => {
  try {
    const period = (req.query.period as string) || 'today';
    const petOnly = req.query.petOnly === 'true';

    // For 'today', fetch live data
    if (period === 'today') {
      const hooks = viralConnector.getTopViralHooks(7, 20, true);
      const stats = viralConnector.getViralStats(7);

      // For pet filtering on hooks, filter examples
      let filteredHooks = hooks;
      if (petOnly) {
        filteredHooks = hooks.map(hook => ({
          ...hook,
          examples: (hook.examples || []).filter(ex =>
            isPetRelated(ex.title) || isPetRelated(ex.content_angle || '')
          )
        })).filter(hook => hook.examples && hook.examples.length > 0);
      }

      return res.json({
        success: true,
        data: {
          period,
          petOnly,
          hooks: filteredHooks.slice(0, 20),
          stats: {
            totalAnalyzed: stats.total_analyzed,
            avgEngagement: stats.avg_engagement
          }
        }
      });
    }

    // For historical periods, use snapshot manager
    const data = await snapshotManager.getHistoricalData(
      period as any,
      'hooks',
      petOnly
    );

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Help / API info endpoint
app.get('/api/help/info', (req, res) => {
  res.json({
    success: true,
    data: {
      platform: {
        name: 'Pet Content Studio',
        version: '1.0',
        description: 'AI-powered content generation platform for pet-focused social media. Combines viral trend analysis with intelligent content signals to create high-engagement Instagram carousels and reels.'
      },
      pages: [
        { name: 'Dashboard', icon: '📊', description: 'Overview of content pipeline stats, recent activity, and quick actions.' },
        { name: 'Discover', icon: '🔍', description: 'Browse content signals (RSS-sourced topics), trending videos, and viral hooks. Use pet/all filters and time period dropdowns to find the best content opportunities.' },
        { name: 'Create', icon: '✏️', description: 'Generate carousels (5-slide image sets) or reels (30-45s videos with narration and stock footage). Select a signal topic, choose AI quality, and optionally apply a viral pattern.' },
        { name: 'Review', icon: '✅', description: 'Review generated content. Approve, reject, or mark as published. Filter by status.' },
        { name: 'Help', icon: '❓', description: 'Platform guide, API usage, and credit information.' }
      ],
      apis: [
        {
          name: 'OpenAI (GPT-4o)',
          usage: 'Content script generation (fast mode), viral video text analysis',
          costPer: '~$0.01 per generation (fast mode)',
          monthlyBudget: '$15.00',
          keyConfigured: !!process.env.OPENAI_API_KEY
        },
        {
          name: 'Anthropic (Claude Sonnet 4)',
          usage: 'Premium content script generation for higher-quality, viral-optimized scripts',
          costPer: '~$0.15-0.20 per generation (premium mode)',
          monthlyBudget: 'Shared with OpenAI budget',
          keyConfigured: !!process.env.ANTHROPIC_API_KEY
        },
        {
          name: 'ElevenLabs',
          usage: 'Text-to-speech narration for reels. Generates professional voiceover for each scene.',
          costPer: '~10,000 characters/month free tier',
          monthlyBudget: 'Free tier (10k chars)',
          keyConfigured: !!process.env.ELEVENLABS_API_KEY
        },
        {
          name: 'Pexels',
          usage: 'Stock video footage for reels. Searches pet-related B-roll to accompany narration.',
          costPer: 'Free (unlimited)',
          monthlyBudget: 'Unlimited',
          keyConfigured: !!process.env.PEXELS_API_KEY
        },
        {
          name: 'YouTube Data API',
          usage: 'Viral video collection and trend discovery. Searches for trending pet content to analyze.',
          costPer: '10,000 units/day free quota',
          monthlyBudget: 'Free (10k units/day)',
          keyConfigured: !!process.env.YOUTUBE_API_KEY
        },
        {
          name: 'TikTok Scraper API',
          usage: 'TikTok trending video collection. Fetches trending videos with engagement metrics, thumbnails, and metadata.',
          costPer: '5,000 requests/month free tier',
          monthlyBudget: 'Free (5k req/month)',
          keyConfigured: !!process.env.TIKTOK_API_KEY
        }
      ],
      workflow: [
        { step: 1, title: 'Collect Intelligence', description: 'RSS feeds and YouTube trends are collected and scored for pet content relevance.' },
        { step: 2, title: 'Analyze Viral Patterns', description: 'Top-performing videos are analyzed for hooks, emotional triggers, and engagement patterns.' },
        { step: 3, title: 'Discover Signals', description: 'Browse ranked content signals in the Discover tab. Filter by pet/all and time period.' },
        { step: 4, title: 'Generate Content', description: 'Select a signal, choose AI quality (fast/premium), and generate a carousel or reel.' },
        { step: 5, title: 'Review & Publish', description: 'Review generated content, approve or reject, and mark as published when posted.' }
      ]
    }
  });
});

// Create snapshot on demand (for saving current trends to history)
app.post('/api/trending/snapshot', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Snapshot videos (all and pet)
    const themes = viralConnector.getTrendingThemes(7, 50);
    const hooks = viralConnector.getTopViralHooks(7, 20, true);
    const stats = viralConnector.getViralStats(7);

    const petThemes = themes.filter(t => isPetRelated(t.content_themes));
    const petHooks = hooks.map(h => ({
      ...h,
      examples: (h.examples || []).filter(ex => isPetRelated(ex.title) || isPetRelated(ex.content_angle || ''))
    })).filter(h => h.examples && h.examples.length > 0);

    // Save all snapshots
    await snapshotManager.createDailySnapshot(today, 'videos', themes.slice(0, 20), false, stats.total_analyzed, stats.avg_engagement);
    await snapshotManager.createDailySnapshot(today, 'videos', petThemes.slice(0, 20), true, petThemes.length, stats.avg_engagement);
    await snapshotManager.createDailySnapshot(today, 'hooks', hooks.slice(0, 20), false, stats.total_analyzed, stats.avg_engagement);
    await snapshotManager.createDailySnapshot(today, 'hooks', petHooks.slice(0, 20), true, petHooks.length, stats.avg_engagement);

    res.json({ success: true, message: `Snapshot saved for ${today}` });
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
  console.log('  POST /api/generate               - Generate carousels');
  console.log('  POST /api/generate-reel          - Generate reels');
  console.log();
  console.log('🔥 Viral & Trending:');
  console.log('  GET  /api/viral/insights         - Get viral trends & insights');
  console.log('  GET  /api/trending/videos        - Trending videos (pet/all, time periods)');
  console.log('  GET  /api/trending/hooks         - Trending hooks (pet/all, time periods)');
  console.log('  POST /api/trending/snapshot      - Save current trends to history');
  console.log('  POST /api/collection/trigger     - Trigger new data collection');
  console.log('  GET  /api/collection/status/:id  - Collection progress (SSE)');
  console.log('  GET  /api/help/info              - Platform & API info');
  console.log();
  console.log('='.repeat(60));
});

// Cleanup on exit
process.on('SIGINT', () => {
  contentStorage.close();
  intelConnector.close();
  viralConnector.close();
  snapshotManager.close();
  process.exit();
});
