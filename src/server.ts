/**
 * Web Dashboard Server
 * Provides UI for reviewing and approving generated content
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
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

    const cookieValue = authCookie?.split('=')[1]?.trim();
    if ((cookieValue === AUTH_PASSWORD) || (authHeader && Buffer.from(authHeader.split(' ')[1] || '', 'base64').toString().endsWith(`:${AUTH_PASSWORD}`))) {
      return next();
    }

    // Show login page for browser requests
    if (req.accepts('html') && !req.path.startsWith('/api/')) {
      return res.send(`<!DOCTYPE html><html lang="pt-BR"><head><title>Login - Pet Content Studio</title>
        <style>body{display:flex;justify-content:center;align-items:center;min-height:100vh;background:linear-gradient(135deg,#667eea,#764ba2);font-family:sans-serif;margin:0}
        .box{background:white;padding:2rem;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,.2);text-align:center;max-width:350px;width:90%}
        input{width:100%;padding:.75rem;border:2px solid #e0e0e0;border-radius:8px;font-size:1rem;margin:.75rem 0;box-sizing:border-box}
        button{width:100%;padding:.75rem;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer}</style></head>
        <body><div class="box"><h2>🐾 Pet Content Studio</h2><div id="err" style="display:none;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;padding:0.5rem;border-radius:8px;margin-bottom:0.5rem;font-size:0.9rem;">Senha incorreta</div><form onsubmit="document.cookie='auth='+document.getElementById('p').value+';path=/;max-age=2592000';fetch('/api/stats').then(r=>{if(r.ok)location.reload();else{document.getElementById('err').style.display='block';document.getElementById('p').value=''}}).catch(()=>location.reload());return false">
        <input id="p" type="password" placeholder="Senha" autofocus><button type="submit">Entrar</button></form></div></body></html>`);
    }

    res.status(401).json({ error: 'Authentication required' });
  });
  console.log('[Auth] Password protection enabled');
}

app.get('/', (_req, res) => res.redirect('/studio.html'));
app.get('/index.html', (_req, res) => res.redirect('/studio.html'));
app.get('/demo.html', (_req, res) => res.redirect('/studio.html'));
app.use(express.static('public'));

// Serve generated images (from Railway volume at /app/data/output/)
const OUTPUT_DIR = path.join(process.cwd(), 'data', 'output');
app.use('/output', express.static(OUTPUT_DIR));

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
    const region = req.query.region as string || 'all'; // 'br', 'global', 'all'

    let signals = intelConnector.getTopSignals(minScore, limit * 3); // fetch extra to filter

    // Filter out promotional/ad content
    const promoPatterns = /garanta sua vaga|inscreva-se|último[s]? dia[s]?|lote|desconto|cupom|promoção|oferta especial|compre agora|buy now|sign up|limited time|free trial|use code|% off/i;
    signals = signals.filter(s => !promoPatterns.test(s.title || '') && !promoPatterns.test((s.description || '').substring(0, 100)));

    // Region filtering for signals (URL-based heuristics)
    const REGION_URL_PATTERNS: Record<string, RegExp> = {
      'br': /\.com\.br|\.br\//,
      'US': /\.com(?!\.)|\.us\//,
      'MX': /\.com\.mx|\.mx\//,
      'AR': /\.com\.ar|\.ar\//,
      'PT': /\.pt\//,
      'ES': /\.es\//,
      'DE': /\.de\//,
      'FR': /\.fr\//,
      'GB': /\.co\.uk|\.uk\//,
    };

    if (region === 'br' || region === 'BR') {
      signals = signals.filter(s => /\.com\.br|\.br\//.test(s.url || ''));
    } else if (region === 'global') {
      signals = signals.filter(s => !/\.com\.br|\.br\//.test(s.url || ''));
    } else if (REGION_URL_PATTERNS[region]) {
      signals = signals.filter(s => REGION_URL_PATTERNS[region].test(s.url || ''));
    }

    signals = signals.slice(0, limit);

    res.json({
      count: signals.length,
      signals: signals.map(signal => ({
        id: signal.id,
        title: signal.title,
        description: signal.description,
        source: signal.source,
        sourceType: 'RSS',
        url: signal.url,
        region: /\.com\.br|\.br\//.test(signal.url || '') ? 'br' : 'global',
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

    // Normalize image paths: convert absolute filesystem paths to /output/... URLs
    const outputBase = path.resolve('data', 'output');
    const normalizePaths = (paths: string[] | undefined): string[] | undefined => {
      if (!paths) return paths;
      return paths.map(p => {
        if (p.includes(outputBase)) {
          return '/output' + p.split(outputBase)[1];
        }
        if (p.startsWith('./data/output')) return p.replace('./data/output', '/output');
        if (p.startsWith('data/output/')) return '/' + p.replace('data/output/', 'output/');
        // Legacy fallback for paths stored before migration
        if (p.startsWith('./output')) return p.replace('./output', '/output');
        if (p.startsWith('output/')) return '/' + p;
        return p;
      });
    };

    // Enrich with signal info
    const enriched = content.map(item => {
      const signal = intelConnector.getSignal(item.signal_id);
      return {
        ...item,
        carousel_images: normalizePaths(item.carousel_images as any),
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

    // Normalize image paths
    const outputBase = path.resolve('data', 'output');
    const normalizeImagePaths = (paths: string[] | undefined): string[] | undefined => {
      if (!paths) return paths;
      return paths.map(p => {
        if (p.includes(outputBase)) return '/output' + p.split(outputBase)[1];
        if (p.startsWith('./data/output')) return p.replace('./data/output', '/output');
        if (p.startsWith('data/output/')) return '/' + p.replace('data/output/', 'output/');
        // Legacy fallback for paths stored before migration
        if (p.startsWith('./output')) return p.replace('./output', '/output');
        if (p.startsWith('output/')) return '/' + p;
        return p;
      });
    };

    // Enrich with signal info
    const signal = intelConnector.getSignal(content.signal_id);
    const enriched = {
      ...content,
      carousel_images: normalizeImagePaths(content.carousel_images as any),
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
    const preciseMode = req.body?.preciseMode === true;
    const bodyFeedback = req.body?.feedback_text;
    const genKey = `regen-${id}`;
    if (activeGenerations.has(genKey)) {
      return res.status(409).json({ error: 'Regeneração já em andamento para este conteúdo' });
    }
    const original = contentStorage.get(id);

    if (!original) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Use feedback from request body (primary) or fall back to stored pending feedback
    let feedbackText = '';
    const feedback = contentStorage.getFeedback(id);
    const pendingFeedback = feedback.filter((f: any) => f.status === 'pending');
    if (bodyFeedback) {
      feedbackText = bodyFeedback;
    } else {
      feedbackText = pendingFeedback.map((f: any, i: number) => `Alteração #${i + 1}: ${f.feedback_text}`).join('\n');
    }

    if (!feedbackText) {
      return res.status(400).json({ error: 'No pending feedback to address' });
    }

    const signal = intelConnector.getSignal(original.signal_id);
    if (!signal) {
      return res.status(404).json({ error: 'Original signal not found' });
    }

    // Start regeneration in background
    activeGenerations.add(genKey);
    if (preciseMode) console.log(`[Server] 🎯 Precise mode enabled for regeneration of content #${id}`);
    res.json({ success: true, message: 'Regeneration started', signalId: signal.id, contentType: original.content_type, preciseMode });

    // Track progress for this regeneration
    const progressKey = `regen-${id}`;
    progressMap.set(progressKey, { step: 1, totalSteps: 5, message: preciseMode ? '🎯 Iniciando regeneração precisa...' : 'Iniciando regeneração...' });

    (async () => {
      try {
        const { getBrandConfig } = await import('./config/brand-config');
        const brand = getBrandConfig();

        if (original.content_type === 'carousel') {
          const { CarouselGenerator } = await import('./generators/carousel-generator');

          progressMap.set(progressKey, { step: 1, totalSteps: 5, message: 'Preparando gerador de carrossel...' });
          const generator = new CarouselGenerator(brand, path.join(process.cwd(), 'data', 'output', 'carousels'));
          await generator.initialize();

          try {
            progressMap.set(progressKey, { step: 2, totalSteps: 5, message: 'Gerando texto com IA (incorporando feedback)...' });
            const newVersion = (original.version || 1) + 1;
            const result = await generator.generate(signal, true, feedbackText, original.carousel_content, newVersion, preciseMode);
            progressMap.set(progressKey, { step: 4, totalSteps: 5, message: 'Salvando nova versão...' });
            result.content.version = newVersion;
            result.content.parent_id = original.id;
            const newId = contentStorage.save(result.content);
            progressMap.set(progressKey, { step: 5, totalSteps: 5, message: 'Carrossel v' + result.content.version + ' pronto!' });
            console.log(`[Server] Regenerated carousel as v${result.content.version}, id #${newId}`);
          } finally {
            await generator.close();
          }
        } else if (original.content_type === 'reel') {
          const { ReelGenerator } = await import('./generators/reel-generator');
          const generator = new ReelGenerator(brand, path.join(process.cwd(), 'data', 'output', 'reels'), preciseMode ? 'claude-sonnet-4' : undefined);

          const onProgress = (step: number, totalSteps: number, message: string) => {
            const msgMap: Record<string, string> = {
              'Writing script...': 'Escrevendo roteiro com IA (incorporando feedback)...',
              'Generating audio...': 'Gerando áudio com narração...',
              'Fetching video clips...': 'Buscando clipes de vídeo...',
              'Compositing video...': 'Montando vídeo final...',
              'Finalizing...': 'Finalizando...',
            };
            progressMap.set(progressKey, { step, totalSteps, message: msgMap[message] || message });
          };

          const result = await generator.generate(signal, onProgress, undefined, feedbackText, original.reel_script);
          result.content.version = (original.version || 1) + 1;
          result.content.parent_id = original.id;
          const newId = contentStorage.save(result.content);
          progressMap.set(progressKey, { step: 5, totalSteps: 5, message: 'Reel v' + result.content.version + ' pronto!' });
          console.log(`[Server] Regenerated reel as v${result.content.version}, id #${newId}`);
        } else if (original.content_type === 'linkedin') {
          const { LinkedInWriter } = await import('./generators/linkedin-writer');
          progressMap.set(progressKey, { step: 2, totalSteps: 3, message: 'Gerando post LinkedIn com IA...' });
          const writer = new LinkedInWriter();
          const linkedinContent = await writer.generatePost(signal, brand, feedbackText, original.linkedin_content, preciseMode);
          const content = {
            signal_id: signal.id,
            content_type: 'linkedin' as const,
            status: 'pending' as const,
            linkedin_content: linkedinContent,
            version: (original.version || 1) + 1,
            parent_id: original.id,
            source_url: signal.url,
            generated_at: new Date().toISOString()
          };
          contentStorage.save(content);
          progressMap.set(progressKey, { step: 3, totalSteps: 3, message: 'Post LinkedIn pronto!' });
        }

        // Mark feedback as addressed ONLY after successful regeneration
        console.log(`[Server] Marking ${pendingFeedback.length} feedback items as addressed for content type: ${original.content_type}`);
        for (const fb of pendingFeedback) {
          if (fb.id) {
            contentStorage.addressFeedback(fb.id);
            console.log(`[Server] ✅ Marked feedback #${fb.id} as addressed`);
          }
        }

        // Keep progress visible for 10s then clear
        setTimeout(() => progressMap.delete(progressKey), 10000);
      } catch (error: any) {
        console.error('[Server] Regeneration failed:', error.message);
        // DON'T mark feedback as addressed — it stays pending for retry
        progressMap.set(progressKey, { step: 0, totalSteps: 1, message: `Erro: ${error.message}` });
        setTimeout(() => progressMap.delete(progressKey), 15000);
      } finally {
        activeGenerations.delete(genKey);
      }
    })();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Edit a single slide's image (without regenerating all slides)
app.post('/api/content/:id/edit-slide/:slideNum', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const slideNum = parseInt(req.params.slideNum);
    const { searchQuery } = req.body; // e.g. "dog agility course"

    if (!searchQuery) {
      return res.status(400).json({ error: 'searchQuery is required' });
    }
    if (slideNum < 1 || slideNum > 5) {
      return res.status(400).json({ error: 'slideNum must be 1-5' });
    }

    const content = contentStorage.get(id);
    if (!content || content.content_type !== 'carousel') {
      return res.status(404).json({ error: 'Carousel not found' });
    }

    const carouselContent = content.carousel_content;
    const slideIndex = slideNum - 1;
    const slide = carouselContent.slides[slideIndex];
    if (!slide) {
      return res.status(400).json({ error: `Slide ${slideNum} not found` });
    }

    // Update the search query on this slide
    const oldQuery = slide.pexelsSearchQuery;
    slide.pexelsSearchQuery = searchQuery;

    // Fetch new photo from Pexels
    const { PexelsService } = await import('./services/pexels-service');
    const pexels = new PexelsService();

    let newBackgroundUrl: string | undefined;
    if (pexels.isEnabled()) {
      const photos = await pexels.searchPhotos(searchQuery, 3);
      if (photos.length > 0) {
        newBackgroundUrl = pexels.getBestPhotoUrl(photos[0]);
      }
    }

    // Re-render just this one slide
    const { getBrandConfig } = await import('./config/brand-config');
    const brand = getBrandConfig();
    const { CarouselTemplate } = await import('./templates/carousel-template');
    const { ImageRenderer } = await import('./renderers/image-renderer');

    const template = new CarouselTemplate(brand);
    const html = template.generateSlideHTML(slide, carouselContent.slides.length, newBackgroundUrl);

    const renderer = new ImageRenderer();
    await renderer.initialize();

    try {
      const versionSuffix = content.version && content.version > 1 ? `-v${content.version}` : '';
      const carouselDir = path.join(process.cwd(), 'data', 'output', 'carousels', `signal-${content.signal_id}`);
      const filename = `carousel-${content.signal_id}${versionSuffix}-${slideNum}.png`;
      const outputPath = path.join(carouselDir, filename);

      await renderer.renderToPNG(html, outputPath);

      // Update image path in the stored array
      const imagePaths = content.carousel_images || [];
      imagePaths[slideIndex] = outputPath;

      // Save updated content in-place (no new version)
      contentStorage.updateCarousel(id, carouselContent, imagePaths);

      console.log(`[Server] ✅ Edited slide ${slideNum} of content #${id}: "${oldQuery}" → "${searchQuery}"`);
      res.json({
        success: true,
        message: `Slide ${slideNum} atualizado`,
        slide: slideNum,
        oldQuery,
        newQuery: searchQuery,
        imagePath: outputPath
      });
    } finally {
      await renderer.close();
    }
  } catch (error: any) {
    console.error('[Server] Edit slide error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Edit a single slide's text (title, body, stat) and re-render
app.post('/api/content/:id/edit-slide-text/:slideNum', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const slideNum = parseInt(req.params.slideNum);
    const { title, body, stat } = req.body;

    if (slideNum < 1 || slideNum > 5) {
      return res.status(400).json({ error: 'slideNum must be 1-5' });
    }
    if (!title && !body) {
      return res.status(400).json({ error: 'title or body is required' });
    }

    const content = contentStorage.get(id);
    if (!content || content.content_type !== 'carousel') {
      return res.status(404).json({ error: 'Carousel not found' });
    }

    const carouselContent = content.carousel_content;
    const slideIndex = slideNum - 1;
    const slide = carouselContent.slides[slideIndex];
    if (!slide) {
      return res.status(400).json({ error: `Slide ${slideNum} not found` });
    }

    // Track old values for logging
    const oldTitle = slide.title;
    const oldBody = slide.body;

    // Update text fields
    if (title !== undefined) slide.title = title;
    if (body !== undefined) slide.body = body;
    if (stat && stat.number) {
      slide.stat = { number: stat.number, context: stat.context || '' };
    }

    // Re-render this slide with updated text (keep existing background)
    const { getBrandConfig } = await import('./config/brand-config');
    const brand = getBrandConfig();
    const { CarouselTemplate } = await import('./templates/carousel-template');
    const { ImageRenderer } = await import('./renderers/image-renderer');

    const template = new CarouselTemplate(brand);
    // Pass undefined for backgroundUrl so re-render uses the template's default styling
    // (the original Pexels image URL is not stored; re-rendering uses the gradient or last fetched image)
    const html = template.generateSlideHTML(slide, carouselContent.slides.length);

    const renderer = new ImageRenderer();
    await renderer.initialize();

    try {
      const versionSuffix = content.version && content.version > 1 ? `-v${content.version}` : '';
      const carouselDir = path.join(process.cwd(), 'data', 'output', 'carousels', `signal-${content.signal_id}`);
      const filename = `carousel-${content.signal_id}${versionSuffix}-${slideNum}.png`;
      const outputPath = path.join(carouselDir, filename);

      await renderer.renderToPNG(html, outputPath);

      // Update image path in the stored array
      const imagePaths = content.carousel_images || [];
      imagePaths[slideIndex] = outputPath;

      // Save updated content
      contentStorage.updateCarousel(id, carouselContent, imagePaths);

      console.log(`[Server] ✅ Edited text on slide ${slideNum} of content #${id}: "${oldTitle}" → "${title}"`);
      res.json({
        success: true,
        message: `Texto do slide ${slideNum} atualizado`,
        slide: slideNum,
        imagePath: outputPath
      });
    } finally {
      await renderer.close();
    }
  } catch (error: any) {
    console.error('[Server] Edit slide text error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Generate AI image for a slide using Gemini/Imagen
app.post('/api/content/:id/generate-slide-image/:slideNum', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const slideNum = parseInt(req.params.slideNum);
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }
    if (slideNum < 1 || slideNum > 5) {
      return res.status(400).json({ error: 'slideNum must be 1-5' });
    }

    const content = contentStorage.get(id);
    if (!content || content.content_type !== 'carousel') {
      return res.status(404).json({ error: 'Carousel not found' });
    }

    const { GeminiImageService } = await import('./services/gemini-image');
    const gemini = new GeminiImageService();

    if (!gemini.isEnabled()) {
      return res.status(400).json({ error: 'GOOGLE_AI_API_KEY não configurada. Adicione ao arquivo .env.' });
    }

    const slideIndex = slideNum - 1;
    const versionSuffix = content.version && content.version > 1 ? `-v${content.version}` : '';
    const carouselDir = path.join(process.cwd(), 'data', 'output', 'carousels', `signal-${content.signal_id}`);
    const filename = `carousel-${content.signal_id}${versionSuffix}-${slideNum}-ai.png`;
    const outputPath = path.join(carouselDir, filename);

    // Generate AI image
    await gemini.generateImage(prompt, outputPath);

    // Now re-render the slide HTML with the AI-generated image as background
    const carouselContent = content.carousel_content;
    const slide = carouselContent.slides[slideIndex];

    const { getBrandConfig } = await import('./config/brand-config');
    const brand = getBrandConfig();
    const { CarouselTemplate } = await import('./templates/carousel-template');
    const { ImageRenderer } = await import('./renderers/image-renderer');

    // Use the generated image as background (convert file path to data URL for Puppeteer)
    const fs = await import('fs');
    const imageBuffer = fs.readFileSync(outputPath);
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    const template = new CarouselTemplate(brand);
    const html = template.generateSlideHTML(slide, carouselContent.slides.length, dataUrl);

    const renderer = new ImageRenderer();
    await renderer.initialize();

    try {
      const finalFilename = `carousel-${content.signal_id}${versionSuffix}-${slideNum}.png`;
      const finalPath = path.join(carouselDir, finalFilename);

      await renderer.renderToPNG(html, finalPath);

      // Update image path
      const imagePaths = content.carousel_images || [];
      imagePaths[slideIndex] = finalPath;
      contentStorage.updateCarousel(id, carouselContent, imagePaths);

      console.log(`[Server] ✅ AI-generated image for slide ${slideNum} of content #${id}`);
      res.json({
        success: true,
        message: `Imagem gerada com IA para slide ${slideNum}`,
        slide: slideNum,
        imagePath: finalPath
      });
    } finally {
      await renderer.close();
    }
  } catch (error: any) {
    console.error('[Server] Generate slide image error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Upload custom image for a slide
const slideUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const id = parseInt(req.params.id);
      const content = contentStorage.get(id);
      const dir = path.join(process.cwd(), 'data', 'output', 'carousels', `signal-${content?.signal_id || 'unknown'}`);
      const fs = require('fs');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, _file, cb) => {
      const id = parseInt(req.params.id);
      const slideNum = parseInt(req.params.slideNum);
      cb(null, `carousel-upload-${id}-${slideNum}.png`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

app.post('/api/content/:id/upload-slide-image/:slideNum', slideUpload.single('image'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const slideNum = parseInt(req.params.slideNum);

    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    if (slideNum < 1 || slideNum > 5) {
      return res.status(400).json({ error: 'slideNum must be 1-5' });
    }

    const content = contentStorage.get(id);
    if (!content || content.content_type !== 'carousel') {
      return res.status(404).json({ error: 'Carousel not found' });
    }

    const slideIndex = slideNum - 1;
    const carouselContent = content.carousel_content;
    const slide = carouselContent.slides[slideIndex];

    // Re-render slide with uploaded image as background
    const { getBrandConfig } = await import('./config/brand-config');
    const brand = getBrandConfig();
    const { CarouselTemplate } = await import('./templates/carousel-template');
    const { ImageRenderer } = await import('./renderers/image-renderer');

    const fs = await import('fs');
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const template = new CarouselTemplate(brand);
    const html = template.generateSlideHTML(slide, carouselContent.slides.length, dataUrl);

    const renderer = new ImageRenderer();
    await renderer.initialize();

    try {
      const versionSuffix = content.version && content.version > 1 ? `-v${content.version}` : '';
      const carouselDir = path.join(process.cwd(), 'data', 'output', 'carousels', `signal-${content.signal_id}`);
      const finalFilename = `carousel-${content.signal_id}${versionSuffix}-${slideNum}.png`;
      const finalPath = path.join(carouselDir, finalFilename);

      await renderer.renderToPNG(html, finalPath);

      const imagePaths = content.carousel_images || [];
      imagePaths[slideIndex] = finalPath;
      contentStorage.updateCarousel(id, carouselContent, imagePaths);

      console.log(`[Server] ✅ Uploaded custom image for slide ${slideNum} of content #${id}`);
      res.json({
        success: true,
        message: `Imagem personalizada aplicada ao slide ${slideNum}`,
        slide: slideNum,
        imagePath: finalPath
      });
    } finally {
      await renderer.close();
    }
  } catch (error: any) {
    console.error('[Server] Upload slide image error:', error.message);
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

// API Key management — custom keys override env defaults
app.get('/api/keys', (req, res) => {
  const geminiKey = process.env.GOOGLE_AI_API_KEY || '';
  res.json({
    gemini: geminiKey ? `${geminiKey.substring(0, 8)}...${'*'.repeat(20)}` : ''
  });
});

app.put('/api/keys', (req, res) => {
  const { gemini } = req.body;
  if (gemini && typeof gemini === 'string' && gemini.trim().length > 10) {
    process.env.GOOGLE_AI_API_KEY = gemini.trim();
    console.log(`[Server] ✅ Custom Gemini API key set (${gemini.substring(0, 8)}...)`);
    res.json({ success: true, message: 'Chave Gemini atualizada' });
  } else {
    res.status(400).json({ error: 'Chave inválida' });
  }
});

app.post('/api/keys/test-gemini', async (req, res) => {
  try {
    const key = req.body.key || process.env.GOOGLE_AI_API_KEY;
    if (!key) {
      return res.json({ success: false, error: 'Nenhuma chave Gemini configurada' });
    }
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: key });
    // Light test: text-only call to verify the key works
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Reply with only the word OK',
    });
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (text) {
      res.json({ success: true, message: 'Chave Gemini válida' });
    } else {
      res.json({ success: false, error: 'Chave aceita mas sem resposta' });
    }
  } catch (err: any) {
    const msg = err.message || '';
    if (msg.includes('quota') || err.status === 429) {
      res.json({ success: false, error: 'Chave válida mas sem créditos — ative o faturamento em https://ai.google.dev' });
    } else if (msg.includes('API_KEY_INVALID') || err.status === 400) {
      res.json({ success: false, error: 'Chave inválida' });
    } else {
      res.json({ success: false, error: `Erro: ${msg.substring(0, 100)}` });
    }
  }
});

// Pre-check: can Gemini generate images right now?
app.get('/api/keys/gemini-status', async (req, res) => {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) {
    return res.json({ available: false, reason: 'no_key', message: 'Nenhuma chave Gemini configurada' });
  }
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: key });
    await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Reply OK',
    });
    res.json({ available: true });
  } catch (err: any) {
    if (err.status === 429 || err.message?.includes('quota')) {
      res.json({ available: false, reason: 'quota', message: 'Créditos Gemini esgotados — ative o faturamento' });
    } else {
      res.json({ available: false, reason: 'error', message: err.message?.substring(0, 100) || 'Erro desconhecido' });
    }
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

// Brand file upload
const brandUpload = multer({
  dest: 'assets/brand/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.svg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

app.post('/api/brand/upload', brandUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const ext = path.extname(file.originalname).toLowerCase();
    const tier = (req.body.tier as string) || 'padrao';

    const genKey = `upload-${file.originalname}`;
    if (activeGenerations.has(genKey)) {
      return res.status(409).json({ error: 'Este arquivo já está sendo processado' });
    }
    activeGenerations.add(genKey);

    console.log(`[Brand Upload] ${file.originalname} (${(file.size / 1024).toFixed(0)}KB, tier: ${tier})`);

    // Rename to preserve extension
    const newPath = file.path + ext;
    const fs = await import('fs');
    fs.renameSync(file.path, newPath);

    res.json({
      success: true,
      file: { path: newPath, name: file.originalname, size: file.size, type: ext },
      message: 'Arquivo enviado. Processando...'
    });

    // Process in background
    (async () => {
      try {
        const { BrandExtractor } = await import('./services/brand-extractor');
        const { clearBrandCache } = await import('./config/brand-config');
        const extractor = new BrandExtractor();

        if (ext === '.pdf') {
          console.log(`[Brand Upload] Extracting brand knowledge from PDF...`);
          const profile = await extractor.extractFromPDF(newPath, tier as any);
          extractor.saveProfile(profile);

          // Also update brand config colors if extracted
          if (profile.visual?.primary_color) {
            const { getBrandConfig, saveBrandConfig } = await import('./config/brand-config');
            const brand = getBrandConfig();
            brand.colors.primary = profile.visual.primary_color;
            if (profile.visual.secondary_color) brand.colors.secondary = profile.visual.secondary_color;
            brand.profile = profile;
            saveBrandConfig(brand);
          }

          clearBrandCache();
          console.log(`[Brand Upload] Brand profile extracted and saved`);

        } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
          console.log(`[Brand Upload] Extracting colors from image...`);
          const colors = await extractor.extractColors(newPath);

          const { getBrandConfig, saveBrandConfig } = await import('./config/brand-config');
          const brand = getBrandConfig();
          brand.colors.primary = colors.primary;
          brand.colors.secondary = colors.secondary;
          if (colors.accent) brand.colors.accent = colors.accent;
          brand.logo = { path: newPath, position: 'bottom-right' };
          saveBrandConfig(brand);
          clearBrandCache();

          console.log(`[Brand Upload] Colors extracted: ${colors.primary}, ${colors.secondary}`);
        }
      } catch (error: any) {
        console.error('[Brand Upload] Processing failed:', error.message);
      }
    })();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get brand profile (extracted knowledge)
app.get('/api/brand/profile', (req, res) => {
  try {
    const { BrandExtractor } = require('./services/brand-extractor');
    const profile = BrandExtractor.loadProfile();
    res.json(profile || { extracted: false });
  } catch (error: any) {
    res.json({ extracted: false });
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
    const customTopic = req.body.customTopic; // { title: string, description: string }
    const viralHook = req.body.viralHook; // Selected viral hook formula
    const viralVideoId = req.body.viralVideoId; // Source viral video ID
    const viralTitle = req.body.viralTitle; // Actual viral video title
    const viralContentAngle = req.body.viralContentAngle; // Content angle
    const aiModel = req.body.aiModel as 'claude-sonnet-4' | 'gpt-4o-mini'; // AI model selection
    const withAudio = req.body.withAudio !== false; // Default true, user can opt out
    const withCaptions = req.body.withCaptions !== false; // Default true, user can opt out

    // Import dependencies
    const { ReelGenerator } = await import('./generators/reel-generator');
    const { getBrandConfig } = await import('./config/brand-config');

    // Fetch signals - custom topic, specific signal, or top signals
    let signals;
    if (customTopic && customTopic.title) {
      signals = [{
        id: 0,
        source: 'custom',
        title: customTopic.title,
        description: customTopic.description || customTopic.title,
        url: '',
        metadata: {},
        collected_at: new Date().toISOString(),
        relevance_score: 100,
        relevance_reason: 'Custom topic',
        is_relevant: true,
        scored_at: new Date().toISOString()
      }];
    } else if (signalId) {
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
        error: `Nenhum sinal encontrado com pontuação >= ${minScore}`,
        suggestion: 'Tente reduzir a pontuação mínima ou execute o coletor de inteligência primeiro'
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
      const generator = new ReelGenerator(brand, path.join(process.cwd(), 'data', 'output', 'reels'), aiModel);

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
            // Pass viral pattern, audio and captions preference
            const options = {
              viralHook: viralHook || undefined,
              viralVideoId: viralVideoId || undefined,
              viralTitle: viralTitle || undefined,
              viralContentAngle: viralContentAngle || undefined,
              withAudio,
              withCaptions
            };
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
    const customTopic = req.body.customTopic; // { title: string, description: string }

    // Prevent duplicate generation
    if (signalId) {
      const genKey = `carousel-${signalId}`;
      if (activeGenerations.has(genKey)) {
        return res.status(409).json({ error: 'Geração já em andamento para este sinal' });
      }
      activeGenerations.add(genKey);
      setTimeout(() => activeGenerations.delete(genKey), 120000); // auto-clear after 2min
    }

    // Import dependencies
    const { CarouselGenerator } = await import('./generators/carousel-generator');
    const { getBrandConfig } = await import('./config/brand-config');

    // Fetch signals - custom topic, specific signal, or top signals
    let signals;
    if (customTopic && customTopic.title) {
      signals = [{
        id: 0,
        source: 'custom',
        title: customTopic.title,
        description: customTopic.description || customTopic.title,
        url: '',
        metadata: {},
        collected_at: new Date().toISOString(),
        relevance_score: 100,
        relevance_reason: 'Custom topic',
        is_relevant: true,
        scored_at: new Date().toISOString()
      }];
    } else if (signalId) {
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
        error: `Nenhum sinal encontrado com pontuação >= ${minScore}`,
        suggestion: 'Tente reduzir a pontuação mínima ou execute o coletor de inteligência primeiro'
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
      const generator = new CarouselGenerator(brand, path.join(process.cwd(), 'data', 'output', 'carousels'));
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

// Reference carousel upload config
const referenceUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(process.cwd(), 'data', 'uploads', 'references');
      const fs = require('fs');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// Generate carousel from reference images
app.post('/api/generate-from-reference', referenceUpload.array('images', 5), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Envie pelo menos 1 imagem de referência' });
    }

    const mode = req.body.mode as 'clone' | 'inspired';
    if (!mode || !['clone', 'inspired'].includes(mode)) {
      return res.status(400).json({ error: 'mode must be "clone" or "inspired"' });
    }

    const instructions = req.body.instructions || '';
    const title = req.body.title || '';
    const aiModel = (req.body.aiModel as 'claude-sonnet-4' | 'gpt-4o-mini') || 'gpt-4o-mini';
    const forceImageGen = req.body.imageGen as string || ''; // 'pollinations' to skip Gemini

    // Prevent duplicate generation
    const genKey = `reference-${Date.now()}`;
    if (activeGenerations.size > 3) {
      return res.status(409).json({ error: 'Muitas gerações em andamento, aguarde' });
    }
    activeGenerations.add(genKey);

    const progressKey = `ref-${Date.now()}`;
    progressMap.set(progressKey, { step: 1, totalSteps: 3, message: 'Gerando slides com IA...' });

    // Respond immediately
    res.json({ success: true, message: 'Gerando carrossel por referência...', progressKey });

    // Run pipeline in background
    (async () => {
      try {
        const uploadedImages = files.map(f => f.path);

        const { GeminiImageService } = await import('./services/gemini-image');
        const geminiImg = new GeminiImageService();
        if (!geminiImg.isEnabled()) {
          throw new Error('GOOGLE_AI_API_KEY não configurada — necessária para referência');
        }

        const { getBrandConfig } = await import('./config/brand-config');
        const brand = getBrandConfig();

        // Determine slide count from reference images
        const slideCount = Math.max(uploadedImages.length, 5);
        const modeLabel = mode === 'clone' ? 'Clone' : 'Inspirado';

        const modeDirective = mode === 'clone'
          ? `CLONE MODE: Generate a slide that closely replicates the structure, layout style, text placement, and visual approach of the reference. Same type of content, same visual weight. Swap in the new topic/brand but keep the design DNA identical.`
          : `INSPIRADO MODE: Use the reference as creative direction and visual inspiration. You have freedom to adapt the style. User instructions: "${instructions || 'Create something similar but adapted'}"`;

        const brandDirective = `Brand: "${brand.name}" (${brand.handle}). Colors: primary ${brand.colors.primary}, secondary ${brand.colors.secondary}. Apply the brand colors subtly.`;

        // Step 1: Generate complete slide images
        const carouselDir = path.join(process.cwd(), 'data', 'output', 'carousels', `reference-${Date.now()}`);
        const carouselImages: string[] = [];
        let usedFallback = false;

        // Try Gemini first (can use reference images directly), unless user chose Pollinations
        let geminiAvailable = forceImageGen !== 'pollinations' && geminiImg.isEnabled();
        if (forceImageGen === 'pollinations') {
          console.log('[Server] User chose Pollinations — skipping Gemini');
          usedFallback = true;
        }
        for (let i = 0; i < slideCount; i++) {
          progressMap.set(progressKey, { step: 1, totalSteps: 3, message: `Gerando slide ${i + 1}/${slideCount} (${modeLabel})...` });

          const refImages = i < uploadedImages.length ? [uploadedImages[i]] : uploadedImages;

          const slidePrompt = `Generate a complete Instagram carousel slide image (1080x1350 portrait).

${modeDirective}

${brandDirective}

Slide ${i + 1} of ${slideCount}:
${i === 0 ? `This is the HOOK slide — the scroll-stopper. ${title ? `Topic: "${title}".` : ''} ${instructions ? `Context: "${instructions}".` : ''} Bold, attention-grabbing text that makes someone stop scrolling.` : ''}
${i === slideCount - 1 ? `This is the CTA slide. Include the brand handle "${brand.handle}" prominently. Add a call-to-action like "Salve este post" or "Siga para mais dicas".` : ''}
${i > 0 && i < slideCount - 1 ? `This is a content slide (${i === 1 ? 'problem/setup' : i === 2 ? 'key insight with a data point' : 'actionable tip'}). ${title ? `Topic: "${title}".` : ''} ${instructions ? `Context: "${instructions}".` : ''}` : ''}

IMPORTANT:
- Write all text in Brazilian Portuguese (PT-BR)
- Include readable text ON the slide — this is the final image, not a background
- Match the visual style, typography weight, color mood, and composition of the reference image(s)
- The slide should look like a professional Instagram carousel slide ready to publish`;

          // Try Gemini (sends reference images directly for style matching)
          if (geminiAvailable) {
            try {
              const imgPath = await geminiImg.generateFromReference(slidePrompt, refImages, path.join(carouselDir, `ref-carousel-${i + 1}.png`));
              carouselImages.push(imgPath);
              continue;
            } catch (err: any) {
              console.log(`[Server] ⚠️ Gemini slide ${i + 1} failed: ${err.message}`);
              if (err.status === 429 || err.message?.includes('quota')) {
                geminiAvailable = false; // Stop trying Gemini for remaining slides
                console.log('[Server] Gemini quota exhausted — switching to Pollinations fallback');
              }
            }
          }

          // Fallback: Pollinations (text-only, no reference image input)
          try {
            if (!usedFallback) {
              usedFallback = true;
              progressMap.set(progressKey, { step: 1, totalSteps: 3, message: `⚠️ Gemini sem créditos — usando Pollinations (sem referência visual). Slide ${i + 1}/${slideCount}...` });
            } else {
              progressMap.set(progressKey, { step: 1, totalSteps: 3, message: `Pollinations: slide ${i + 1}/${slideCount}...` });
            }
            const { PollinationsImageService } = await import('./services/pollinations-image');
            const pollinations = new PollinationsImageService();
            const fallbackPrompt = `Professional Instagram carousel slide. ${i === 0 ? 'Bold hook slide' : i === slideCount - 1 ? 'CTA slide' : 'Content slide'}. Topic: ${title || instructions || 'pet care'}. Brand colors: ${brand.colors.primary}, ${brand.colors.secondary}. Clean modern design, text overlay ready, pet industry, portrait orientation.`;
            const imgPath = await pollinations.generateImage(fallbackPrompt, path.join(carouselDir, `ref-carousel-${i + 1}.png`));
            carouselImages.push(imgPath);
          } catch (fallbackErr: any) {
            console.log(`[Server] ⚠️ Pollinations slide ${i + 1} also failed: ${fallbackErr.message}`);
          }
        }

        if (carouselImages.length === 0) {
          throw new Error('Nenhum slide foi gerado — Gemini sem créditos e Pollinations falhou. Ative o faturamento do Gemini em https://ai.google.dev');
        }

        if (usedFallback) {
          console.log(`[Server] ⚠️ Used Pollinations fallback — images are text-prompt-only (no visual style matching from reference)`);
        }

        // Step 2: Generate caption + hashtags
        const captionModel = aiModel === 'claude-sonnet-4' ? 'Claude Sonnet 4' : 'GPT-4o-mini';
        progressMap.set(progressKey, { step: 2, totalSteps: 3, message: `Gerando legenda com ${captionModel}...` });

        const captionPrompt = `Generate an Instagram caption and hashtags for a ${slideCount}-slide carousel about: "${title || instructions || 'pet care'}". Brand: ${brand.name} (${brand.handle}). Write in Brazilian Portuguese. Return ONLY valid JSON (no markdown fences): { "caption": "...", "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"] }. Caption: 50-120 words, start with question or bold statement. 5 hashtags in Portuguese.`;

        let caption = '';
        let hashtags: string[] = [];
        try {
          if (aiModel === 'claude-sonnet-4') {
            const Anthropic = (await import('@anthropic-ai/sdk')).default;
            const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
            const captionResp = await anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 500,
              messages: [{ role: 'user', content: captionPrompt }]
            });
            const textContent = captionResp.content.find(block => block.type === 'text');
            if (!textContent || textContent.type !== 'text') throw new Error('No text in Claude response');
            const cleaned = textContent.text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
            const parsed = JSON.parse(cleaned);
            caption = parsed.caption || '';
            hashtags = parsed.hashtags || [];
          } else {
            const OpenAI = (await import('openai')).default;
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const captionResp = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              max_tokens: 500,
              response_format: { type: 'json_object' },
              messages: [{ role: 'user', content: captionPrompt }]
            });
            const parsed = JSON.parse(captionResp.choices[0].message.content || '{}');
            caption = parsed.caption || '';
            hashtags = parsed.hashtags || [];
          }
          console.log(`[Server] ✅ Caption generated with ${captionModel}`);
        } catch (err: any) {
          console.log(`[Server] ⚠️ Caption generation failed (${captionModel}): ${err.message}`);
          caption = `${title || instructions || ''} ${brand.handle}`;
          hashtags = ['pet', 'dicaspet', 'cachorro', 'petlovers', 'petcare'];
        }

        // Step 3: Save to content storage
        progressMap.set(progressKey, { step: 3, totalSteps: 3, message: 'Salvando...' });
        const content = {
          signal_id: 0,
          content_type: 'carousel' as const,
          status: 'pending' as const,
          carousel_content: {
            slides: carouselImages.map((_, i) => ({
              slideNumber: i + 1,
              title: i === 0 ? (title || 'Reference carousel') : `Slide ${i + 1}`,
              body: null,
              stat: null,
              pexelsSearchQuery: '',
              layoutHint: (i === 0 ? 'hook' : i === carouselImages.length - 1 ? 'cta' : 'content') as 'hook' | 'problem' | 'insight' | 'tip' | 'cta'
            })),
            caption,
            hashtags,
            hookFormula: 'curiosity_gap' as const
          },
          carousel_images: carouselImages,
          source_url: `reference:${mode}`,
          generated_at: new Date().toISOString()
        };
        contentStorage.save(content);

        progressMap.set(progressKey, { step: 3, totalSteps: 3, message: `Carrossel ${modeLabel} pronto! (${carouselImages.length} slides)` });
        console.log(`[Server] ✅ Reference carousel (${mode}) saved with ${carouselImages.length} slides`);

        // Clean up uploaded files
        for (const file of files) {
          try { require('fs').unlinkSync(file.path); } catch {}
        }

        setTimeout(() => progressMap.delete(progressKey), 10000);
      } catch (error: any) {
        console.error('[Server] Reference carousel generation failed:', error.message);
        progressMap.set(progressKey, { step: 0, totalSteps: 1, message: `Erro: ${error.message}` });
        setTimeout(() => progressMap.delete(progressKey), 15000);
      } finally {
        activeGenerations.delete(genKey);
      }
    })();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Active generation tracker (prevents duplicate requests)
const activeGenerations = new Set<string>();

// Generate LinkedIn post
app.post('/api/generate-linkedin', async (req, res) => {
  try {
    const signalId = req.body.signalId ? parseInt(req.body.signalId) : null;
    const customTopic = req.body.customTopic; // { title: string, description: string }

    // Resolve signal from customTopic, signalId, or error
    let signal;
    if (customTopic && customTopic.title) {
      signal = {
        id: 0,
        source: 'custom',
        title: customTopic.title,
        description: customTopic.description || customTopic.title,
        url: '',
        metadata: {},
        collected_at: new Date().toISOString(),
        relevance_score: 100,
        relevance_reason: 'Custom topic',
        is_relevant: true,
        scored_at: new Date().toISOString()
      };
    } else if (signalId) {
      signal = intelConnector.getSignal(signalId);
      if (!signal) {
        return res.status(404).json({ error: `Signal #${signalId} not found` });
      }
    } else {
      return res.status(400).json({ error: 'signalId or customTopic is required' });
    }

    // Prevent duplicate generation
    const genKey = `linkedin-${signal.id}`;
    if (activeGenerations.has(genKey)) {
      return res.status(409).json({ error: 'Geração já em andamento para este sinal' });
    }
    activeGenerations.add(genKey);

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
        activeGenerations.delete(genKey);
        console.log(`[Server] LinkedIn post saved for signal #${signal.id}`);
      } catch (error: any) {
        console.error('[Server] LinkedIn generation failed:', error.message);
        activeGenerations.delete(genKey);
      }
    })();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Pet classification helper
// Strict pet check — uses title only (not AI-generated themes which tag everything as pet)
function isPetRelated(text: string): boolean {
  const petKeywords = [
    'pet', 'dog', 'cat', 'puppy', 'kitten', 'pup', 'kitty', 'doggo', 'pupper', 'vet', 'breed',
    'cachorro', 'cachorra', 'gato', 'gata', 'filhote', 'cão', 'cadela', 'gatinho', 'gatinha',
    'veterinário', 'veterinaria', 'pets', 'felino', 'canino', 'miau', 'focinho', 'cãozinho',
    'doguinho', 'pata', 'ração', 'petshop', 'banho e tosa'
  ];
  const lower = (text || '').toLowerCase();
  return petKeywords.some(kw => lower.includes(kw));
}

// Region-based language detection for filtering viral videos/hooks
// Maps country codes to characteristic word patterns in video titles
const REGION_LANGUAGE_MARKERS: Record<string, RegExp> = {
  'BR': /\b(você|seu|como|para|não|que|por|mais|dos|das|uma|esta|esse|isso|muito|porque|quando|também|sobre|aqui|cachorro|gato|ração|banho|tosa|dono|veterinário)\b|[ãõçê]/i,
  'US': /\b(you|your|how|the|this|that|with|from|what|about|just|they|their|when|every|never|always|should|don't|can't|won't)\b/i,
  'GB': /\b(you|your|how|the|this|that|with|from|what|about|just|they|their|favourite|colour|behaviour|whilst)\b/i,
  'MX': /\b(tu|usted|perro|gato|mascota|como|para|qué|por|más|este|esta|muy|también|cuando|aquí|nunca)\b|[ñ¿¡]/i,
  'AR': /\b(vos|che|pibe|boludo|perro|gato|mascota|como|para|qué|más|este|cuando|nunca)\b|[ñ¿¡]/i,
  'PT': /\b(você|seu|como|para|não|que|por|mais|uma|esta|esse|isto|muito|cão|gato|veterinário)\b|[ãõçê]/i,
  'ES': /\b(tu|perro|gato|mascota|como|para|qué|por|más|este|esta|muy|también|cuando|nunca)\b|[ñ¿¡]/i,
  'DE': /\b(der|die|das|und|für|mit|ein|eine|nicht|auch|wie|dein|hund|katze|haustier|warum)\b|[äöüß]/i,
  'FR': /\b(le|la|les|un|une|des|pour|avec|pas|que|qui|est|sont|votre|chien|chat|animal)\b|[éèêëàâùûîïôç]/i,
};

function matchesRegionLanguage(text: string, region: string): boolean {
  const pattern = REGION_LANGUAGE_MARKERS[region];
  if (!pattern) return true; // unknown region = no filter
  return pattern.test(text);
}

function filterByRegion(items: any[], region: string): any[] {
  return items.filter(item => matchesRegionLanguage(item.title || '', region));
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
  const jobId = req.params.jobId;

  // Check if job exists before opening SSE stream
  const job = orchestrator.getJob(jobId);
  if (!job) {
    // Return a graceful JSON response instead of 503 or hanging SSE
    res.json({ jobId, status: 'not_found', message: 'Job not found. It may have already completed or expired.' });
    return;
  }

  // If job already completed, return its final state as JSON
  if (job.status === 'complete' || job.status === 'error') {
    res.json(job);
    return;
  }

  // Only open SSE stream for actively running jobs
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send current status immediately
  res.write(`data: ${JSON.stringify(job)}\n\n`);

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
    const region = (req.query.region as string) || 'all';

    // For 'today', fetch live data from viral connector with pet filtering
    if (period === 'today') {
      const topHooks = viralConnector.getTopViralHooks(7, 20);
      const themes = viralConnector.getTrendingThemes(7, 50);
      const stats = viralConnector.getViralStats(7);

      // Filter by pet if needed — check title (not AI themes which over-tag)
      let filteredThemes = themes;
      if (petOnly) {
        filteredThemes = themes.filter(t => isPetRelated(t.title || ''));
      }

      // Filter by region using title language heuristics
      if (region && region !== 'all') {
        filteredThemes = filterByRegion(filteredThemes, region);
      }

      return res.json({
        success: true,
        data: {
          period,
          petOnly,
          region,
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
    const region = (req.query.region as string) || 'all';

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

      // Filter hook examples by region
      if (region && region !== 'all') {
        filteredHooks = filteredHooks.map(hook => ({
          ...hook,
          examples: (hook.examples || []).filter(ex =>
            matchesRegionLanguage(ex.title || '', region)
          )
        })).filter(hook => hook.examples && hook.examples.length > 0);
      }

      return res.json({
        success: true,
        data: {
          period,
          petOnly,
          region,
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

// Custom search — user-defined country + topic
// Architecture: Smart native query generation → YouTube search → deterministic language filter
app.post('/api/trending/custom-search', async (req, res) => {
  try {
    const { country, topic } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required' });

    const regionCode = country || 'BR';

    const countryLang: Record<string, { lang: string; langName: string }> = {
      'BR': { lang: 'pt', langName: 'Brazilian Portuguese' },
      'PT': { lang: 'pt', langName: 'European Portuguese' },
      'US': { lang: 'en', langName: 'English' },
      'GB': { lang: 'en', langName: 'English' },
      'MX': { lang: 'es', langName: 'Mexican Spanish' },
      'AR': { lang: 'es', langName: 'Argentine Spanish' },
      'CO': { lang: 'es', langName: 'Colombian Spanish' },
      'CL': { lang: 'es', langName: 'Chilean Spanish' },
      'ES': { lang: 'es', langName: 'European Spanish' },
      'DE': { lang: 'de', langName: 'German' },
      'FR': { lang: 'fr', langName: 'French' },
      'IN': { lang: 'hi', langName: 'Hindi' },
    };

    const { lang, langName } = countryLang[regionCode] || { lang: 'en', langName: 'English' };

    // Step 1: Single AI call — generate culturally native search queries
    // This replaces the old translate + append suffixes approach
    let searchQueries: string[] = [];
    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const queryGen = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 150,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: `Generate exactly 3 YouTube search queries in ${langName} for finding viral videos about: "${topic}"

Rules:
- All queries must be ENTIRELY in ${langName} (no English words unless they are commonly used in that language)
- Include at least one query with the key term in quotes to force language matching
- Use phrasing a native ${langName} speaker would naturally search for
- Include viral/trending indicators natural to that language
- Each query on its own line, nothing else

Example for "elephants" in German:
"Elefanten" erstaunliche Fakten
Elefanten Pflege Tipps viral
Elefanten Dokumentation beliebt`
        }]
      });

      const rawQueries = queryGen.choices[0]?.message?.content?.trim() || '';
      searchQueries = rawQueries.split('\n').map(q => q.trim()).filter(q => q.length > 0).slice(0, 3);
      console.log(`[CustomSearch] AI-generated queries for "${topic}" (${langName}):`, searchQueries);
    } catch (err: any) {
      console.log(`[CustomSearch] Query generation failed, using fallback: ${err.message}`);
    }

    // Fallback: basic translated query if AI fails
    if (searchQueries.length === 0) {
      searchQueries = [`"${topic}" viral`, `${topic} trending`, `${topic} tips`];
    }

    // Step 2: YouTube search with native queries
    const { YouTubeCollector } = await import('./services/youtube-collector');
    const collector = new YouTubeCollector();

    const allVideos: any[] = [];
    let quotaExhausted = false;
    for (const query of searchQueries) {
      try {
        const videos = await collector.searchVideos(query, regionCode, 15, lang);
        allVideos.push(...videos);
      } catch (err: any) {
        console.log(`[CustomSearch] Query "${query}" failed: ${err.message}`);
        if (err.message?.includes('quota')) quotaExhausted = true;
      }
    }

    // Deduplicate by video ID
    const seen = new Set<string>();
    const deduped = allVideos.filter(v => {
      const vid = v.video_id || v.id;
      if (seen.has(vid)) return false;
      seen.add(vid);
      return true;
    });

    // Step 3: Language filter using AI on ALL results
    // YouTube's language tags are unreliable (creators set channel language, not video language)
    // so we always use Haiku to classify by actual title language. Cost: ~$0.001 per search.
    let filtered = deduped;

    if (deduped.length > 0 && lang !== 'en') {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const titles = deduped.map((v: any, i: number) => `${i}: ${v.title || ''}`).join('\n');

        const result = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          temperature: 0,
          messages: [{
            role: 'user',
            content: `I searched YouTube in ${langName} for "${topic}". Which video titles are PRIMARILY written in ${langName}?

Rules:
- A title qualifies ONLY if its main words (ignoring hashtags) are in ${langName}
- Hashtags (#funny, #viral, #shorts, #viralshort) do NOT count as ${langName} — ignore them
- Emojis do NOT make a title qualify — ignore them
- English titles with emojis and hashtags are still English, NOT ${langName}
- If the actual spoken/written words in the title are in English, exclude it

Respond with ONLY the index numbers (comma-separated). If none match, respond "none".

${titles}`
          }]
        });

        const aiResponse = (result.content[0] as any).text?.trim() || '';
        console.log(`[CustomSearch] AI language filter (${langName}): "${aiResponse}"`);

        if (aiResponse.toLowerCase() === 'none') {
          filtered = [];
        } else {
          const validIndices = new Set(
            aiResponse.split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n))
          );
          filtered = deduped.filter((_: any, i: number) => validIndices.has(i));
        }
      } catch (err: any) {
        console.log(`[CustomSearch] AI filter failed, returning all: ${err.message}`);
        filtered = deduped; // Fail open
      }
    }

    console.log(`[CustomSearch] Final: ${deduped.length} total → ${filtered.length} after filtering`);

    // Sort by views
    filtered.sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0));

    // Limit per channel to ensure diversity (max 3 per channel)
    const channelCount: Record<string, number> = {};
    filtered = filtered.filter((v: any) => {
      const ch = v.channel_name || 'unknown';
      channelCount[ch] = (channelCount[ch] || 0) + 1;
      return channelCount[ch] <= 3;
    });

    // Map to frontend format
    const mapped = filtered.slice(0, 15).map((v: any) => ({
      id: v.video_id || v.id,
      title: v.title,
      channel: v.channel_name,
      views: v.view_count,
      thumbnail: v.thumbnail_url,
      engagement_rate: v.engagement_rate ? v.engagement_rate / 100 : 0,
      hook_formula: v.hook_formula,
      content_angle: v.emotional_trigger || topic
    }));

    // Step 4: GPT-score top videos as real content signals
    let signals: any[] = [];
    const signalCandidates = mapped.slice(0, 8);
    if (signalCandidates.length > 0) {
      try {
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const videoList = signalCandidates.map((v: any, i: number) =>
          `${i}. "${v.title}" — ${v.channel} — ${(v.views || 0).toLocaleString()} views — ${((v.engagement_rate || 0) * 100).toFixed(1)}% engagement`
        ).join('\n');

        const signalResult = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 800,
          temperature: 0.3,
          messages: [{
            role: 'user',
            content: `You are a social media content strategist. Analyze these viral YouTube videos found for the topic "${topic}" in ${langName} and score each as a content creation signal.

For each video, assess:
- score (0-100): How strong is this as inspiration for original social media content? High = unique angle, trending topic, replicable format, high engagement. Low = one-off humor, no replicable pattern, too generic.
- opportunity: 1-2 sentences in ${langName} explaining what original content to create inspired by this signal.
- format: Best content format — "carousel", "reel", or "post"

Videos:
${videoList}

Respond ONLY with a JSON array. Example: [{"index":0,"score":85,"opportunity":"...","format":"carousel"}]`
          }]
        });

        const raw = signalResult.choices[0]?.message?.content?.trim() || '[]';
        // Extract JSON from potential markdown code block
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        const parsed = JSON.parse(jsonMatch?.[0] || '[]');

        signals = parsed.map((s: any) => {
          const video = signalCandidates[s.index];
          if (!video) return null;
          return {
            title: video.title,
            channel: video.channel,
            views: video.views,
            url: `https://www.youtube.com/watch?v=${video.id}`,
            thumbnail: video.thumbnail,
            score: Math.min(100, Math.max(0, s.score || 0)),
            opportunity: s.opportunity || '',
            format: s.format || 'carousel',
            hook_formula: video.hook_formula,
            video_id: video.id
          };
        }).filter(Boolean).sort((a: any, b: any) => b.score - a.score);

        console.log(`[CustomSearch] Scored ${signals.length} content signals`);
      } catch (err: any) {
        console.log(`[CustomSearch] Signal scoring failed: ${err.message}`);
        // Fall back to unsorted videos without GPT scores
      }
    }

    // Step 5: Search for matching articles from two sources:
    // A) Local signals.db (pre-collected pet industry feeds)
    // B) Google News RSS (live search — works for ANY topic)
    const topicWords = topic.split(/\s+/).filter((w: string) => w.length >= 3);
    const rssKeywords = [topic, ...topicWords];
    const seenUrls = new Set<string>();
    let rssSignals: any[] = [];

    // A) Local signals database
    for (const kw of rssKeywords) {
      const matches = intelConnector.searchByKeyword(kw, 5);
      for (const m of matches) {
        if (m.url && !seenUrls.has(m.url)) {
          seenUrls.add(m.url);
          rssSignals.push({
            title: m.title,
            description: (m.description || '').substring(0, 200),
            source: m.source,
            url: m.url,
            score: m.relevance_score || 0,
            collected_at: m.collected_at
          });
        }
      }
    }

    // B) Google News RSS — live search for any topic
    const googleLangMap: Record<string, string> = {
      'BR': 'pt-BR', 'PT': 'pt-PT', 'US': 'en-US', 'GB': 'en-GB',
      'MX': 'es-MX', 'AR': 'es-AR', 'CO': 'es-CO', 'CL': 'es-CL',
      'ES': 'es-ES', 'DE': 'de-DE', 'FR': 'fr-FR', 'IN': 'hi-IN',
    };
    const googleHl = googleLangMap[regionCode] || 'en-US';
    const googleGl = regionCode;

    try {
      const { parseRSSItems } = await import('./services/signal-collector');
      const newsQuery = encodeURIComponent(topic);
      const newsUrl = `https://news.google.com/rss/search?q=${newsQuery}&hl=${googleHl}&gl=${googleGl}&ceid=${googleGl}:${googleHl.split('-')[0]}`;
      const newsRes = await fetch(newsUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PetContentStudio/1.0)' }
      });
      if (newsRes.ok) {
        const xml = await newsRes.text();
        const items = parseRSSItems(xml);
        for (const item of items.slice(0, 8)) {
          if (item.link && !seenUrls.has(item.link)) {
            seenUrls.add(item.link);
            rssSignals.push({
              title: item.title,
              description: (item.description || '').substring(0, 200),
              source: 'Google News',
              url: item.link,
              score: 75,
              collected_at: item.pubDate || new Date().toISOString()
            });
          }
        }
      }
      console.log(`[CustomSearch] Google News RSS: fetched articles for "${topic}"`);
    } catch (err: any) {
      console.log(`[CustomSearch] Google News RSS failed: ${err.message}`);
    }

    rssSignals = rssSignals.sort((a, b) => b.score - a.score).slice(0, 8);
    console.log(`[CustomSearch] Found ${rssSignals.length} total RSS signals`);

    const aiCost = signals.length > 0 ? '~$0.003' : '~$0.001';
    const cost = `YouTube: ~${searchQueries.length * 100} unidades · IA: ${aiCost}`;

    res.json({
      success: true,
      videos: mapped,
      signals,
      rssSignals,
      cost,
      quotaExhausted,
      country: regionCode,
      topic,
      queries_used: searchQueries
    });
  } catch (error: any) {
    console.error('[CustomSearch] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Seed trending data with realistic demo content (for client demos / empty databases)
app.post('/api/trending/collect', async (req, res) => {
  try {
    const { YouTubeCollector } = await import('./services/youtube-collector');
    const collector = new YouTubeCollector();

    if (!collector.isEnabled()) {
      // Fall back to demo data if no YouTube API key
      const count = viralConnector.seedDemoData();
      return res.json({
        success: true,
        message: `YOUTUBE_API_KEY not set — seeded ${count} demo videos instead.`,
        count,
        source: 'demo'
      });
    }

    const result = await collector.collect(viralConnector);
    res.json({
      success: true,
      message: `Coletados ${result.collected} vídeos do YouTube (${result.viral} virais).`,
      count: result.collected,
      viral: result.viral,
      source: 'youtube'
    });
  } catch (error: any) {
    console.error('[Trending Collect] Error:', error.message);
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
        description: 'Plataforma de geração de conteúdo com IA para redes sociais focadas em pets. Combina análise de tendências virais com sinais de conteúdo inteligentes para criar carrosséis e reels de alto engajamento no Instagram.'
      },
      pages: [
        { name: 'Dashboard', icon: '📊', description: 'Visão geral das estatísticas do pipeline de conteúdo, atividade recente e ações rápidas.' },
        { name: 'Descobrir', icon: '🔍', description: 'Navegue pelos sinais de conteúdo (tópicos de RSS), vídeos em alta e ganchos virais. Use os filtros pet/todos e os menus de período para encontrar as melhores oportunidades de conteúdo.' },
        { name: 'Criar', icon: '✏️', description: 'Gere carrosséis (conjuntos de 5 slides) ou reels (vídeos de 30-45s com narração e filmagens de stock). Selecione um tópico, escolha a qualidade da IA e, opcionalmente, aplique um padrão viral.' },
        { name: 'Revisar', icon: '✅', description: 'Revise o conteúdo gerado. Aprove, rejeite ou marque como publicado. Filtre por status.' },
        { name: 'Ajuda', icon: '❓', description: 'Guia da plataforma, uso de APIs e informações de créditos.' }
      ],
      apis: [
        {
          name: 'OpenAI (GPT-4o)',
          usage: 'Geração de scripts de conteúdo (modo rápido), análise de texto de vídeos virais',
          costPer: '~$0,01 por geração (modo rápido)',
          monthlyBudget: '$15,00',
          keyConfigured: !!process.env.OPENAI_API_KEY
        },
        {
          name: 'Anthropic (Claude Sonnet 4)',
          usage: 'Geração premium de scripts de conteúdo para roteiros de maior qualidade e otimizados para viralização',
          costPer: '~$0,15-0,20 por geração (modo premium)',
          monthlyBudget: 'Compartilhado com orçamento OpenAI',
          keyConfigured: !!process.env.ANTHROPIC_API_KEY
        },
        {
          name: 'ElevenLabs',
          usage: 'Narração por voz para reels. Gera locução profissional para cada cena.',
          costPer: '~10.000 caracteres/mês (nível gratuito)',
          monthlyBudget: 'Nível gratuito (10k caracteres)',
          keyConfigured: !!process.env.ELEVENLABS_API_KEY
        },
        {
          name: 'Pexels',
          usage: 'Vídeos de stock para reels. Busca B-roll relacionado a pets para acompanhar a narração.',
          costPer: 'Gratuito (ilimitado)',
          monthlyBudget: 'Ilimitado',
          keyConfigured: !!process.env.PEXELS_API_KEY
        },
        {
          name: 'YouTube Data API',
          usage: 'Coleta de vídeos virais e descoberta de tendências. Busca conteúdo pet em alta para análise.',
          costPer: '10.000 unidades/dia (cota gratuita)',
          monthlyBudget: 'Gratuito (10k unidades/dia)',
          keyConfigured: !!process.env.YOUTUBE_API_KEY
        },
        {
          name: 'TikTok Scraper API',
          usage: 'Coleta de vídeos em alta do TikTok. Busca vídeos tendência com métricas de engajamento, thumbnails e metadados.',
          costPer: '5.000 requisições/mês (nível gratuito)',
          monthlyBudget: 'Gratuito (5k req/mês)',
          keyConfigured: !!process.env.TIKTOK_API_KEY
        }
      ],
      workflow: [
        { step: 1, title: 'Coletar Inteligência', description: 'Feeds RSS e tendências do YouTube são coletados e pontuados por relevância para conteúdo pet.' },
        { step: 2, title: 'Analisar Padrões Virais', description: 'Vídeos com melhor desempenho são analisados por ganchos, gatilhos emocionais e padrões de engajamento.' },
        { step: 3, title: 'Descobrir Sinais', description: 'Navegue pelos sinais de conteúdo classificados na aba Descobrir. Filtre por pet/todos e período.' },
        { step: 4, title: 'Gerar Conteúdo', description: 'Selecione um sinal, escolha a qualidade da IA (rápido/premium) e gere um carrossel ou reel.' },
        { step: 5, title: 'Revisar e Publicar', description: 'Revise o conteúdo gerado, aprove ou rejeite, e marque como publicado quando postado.' }
      ]
    }
  });
});

// Instagram hook formulas — real-world data from SocialBee, SocialPilot, and Taggbox
// These are hooks that are actually performing well on Instagram Reels right now.
// Sources are scraped weekly. The endpoint also links to live source pages for freshest data.
app.get('/api/instagram-hooks', (req, res) => {
  const SOURCE_URLS: Record<string, string> = {
    'SocialBee': 'https://socialbee.com/blog/instagram-trends/',
    'SocialPilot': 'https://www.socialpilot.co/blog/instagram-reels-trends',
    'Taggbox': 'https://taggbox.com/blog/best-instagram-hooks/',
  };

  // Section 1: THIS WEEK's trending hooks (from SocialBee weekly updates)
  const trendingThisWeek = [
    { hook: 'Quando as pessoas da sua idade começam a ter filhos', category: 'Humor Relatable', why: 'Humor geracional sobre envelhecer e ver colegas atingindo marcos — extremamente compartilhável', source: 'SocialBee', sourceUrl: SOURCE_URLS['SocialBee'] },
    { hook: '"Tá tudo bonito aqui dentro" — o cliente fala e você finge que era sobre VOCÊ', category: 'Humor Autoconsciente', why: 'Transforma momento comum em humor — universal para qualquer negócio de serviço', source: 'SocialBee', sourceUrl: SOURCE_URLS['SocialBee'] },
    { hook: '"Quero muito ir pra casa" — "São só 9:02"', category: 'Dia a Dia no Trabalho', why: 'Exaustão universal no trabalho; exagera a luta — gera muitos comentários', source: 'SocialBee', sourceUrl: SOURCE_URLS['SocialBee'] },
    { hook: '"Você não tá ficando louco?" — e aí revela que SIM, tá pirando', category: 'Expectativa Invertida', why: 'Cria tensão e depois subverte com punchline autoconsciente', source: 'SocialBee', sourceUrl: SOURCE_URLS['SocialBee'] },
    { hook: 'Nascido pra {preferência}… Forçado a {realidade adulta}', category: 'Meme de Contraste', why: 'Contrasta desejo vs. responsabilidade; ressoa com frustração corporativa', source: 'SocialBee', sourceUrl: SOURCE_URLS['SocialBee'] },
    { hook: '"Ninguém me viu {dificuldade}" — "porque eu não faço nada disso"', category: 'Anti-Hustle', why: 'Critica a cultura de produtividade com humor autodepreciativo — muito compartilhável', source: 'SocialBee', sourceUrl: SOURCE_URLS['SocialBee'] },
    { hook: '"Faça o que seu coração manda" → montagem de indulgência caótica', category: 'Motivação Invertida', why: 'Subverte conselho motivacional com contradição humorística', source: 'SocialBee', sourceUrl: SOURCE_URLS['SocialBee'] },
  ];

  // Section 2: Proven high-engagement formulas (from SocialPilot + Taggbox)
  const provenFormulas = [
    { hook: 'Para de rolar se você quer…', category: 'CTA Direto', why: 'Interrompe a rolagem com promessa de valor condicional — aumenta retenção de 3 segundos', source: 'Taggbox', sourceUrl: SOURCE_URLS['Taggbox'] },
    { hook: 'Esse erro tá te custando…', category: 'Consciência do Problema', why: 'Identifica dor oculta — espectadores assistem pra ver se são culpados', source: 'Taggbox', sourceUrl: SOURCE_URLS['Taggbox'] },
    { hook: 'O segredo que ninguém fala sobre…', category: 'Exclusividade', why: 'Posiciona conteúdo como conhecimento insider — gera salvamentos e compartilhamentos', source: 'Taggbox', sourceUrl: SOURCE_URLS['Taggbox'] },
    { hook: 'Eu queria que alguém tivesse me falado isso antes…', category: 'Arrependimento/FOMO', why: 'Cria FOMO ao implicar conhecimento perdido — alta taxa de salvamento', source: 'Taggbox', sourceUrl: SOURCE_URLS['Taggbox'] },
    { hook: 'Todo mundo tá errado sobre…', category: 'Controvérsia', why: 'Desafia conhecimento assumido, exige explicação — gera comentários', source: 'Taggbox', sourceUrl: SOURCE_URLS['Taggbox'] },
    { hook: 'Só 1% das pessoas sabem disso…', category: 'Escassez', why: 'Posicionamento de conhecimento raro aumenta valor percebido — alta taxa de compartilhamento', source: 'Taggbox', sourceUrl: SOURCE_URLS['Taggbox'] },
    { hook: 'POV: Você acabou de descobrir…', category: 'POV Imersivo', why: 'Mudança de perspectiva aumenta investimento do espectador no conteúdo', source: 'Taggbox', sourceUrl: SOURCE_URLS['Taggbox'] },
    { hook: 'A cara que eu faço quando alguém fala…', category: 'Reação/Opinião', why: 'Reações de revirar os olhos criam identificação compartilhável — funciona pra qualquer nicho', source: 'SocialPilot', sourceUrl: SOURCE_URLS['SocialPilot'] },
    { hook: 'Se você é {público-alvo}…', category: 'Endereço Direto', why: 'Fala direto com a dor do cliente ideal — foco em conversão', source: 'SocialPilot', sourceUrl: SOURCE_URLS['SocialPilot'] },
    { hook: 'Isso mudou tudo pra mim…', category: 'Transformação', why: 'Posicionamento baseado em solução — dispara curiosidade sobre o que mudou', source: 'SocialPilot', sourceUrl: SOURCE_URLS['SocialPilot'] },
    { hook: 'Espera até o final…', category: 'Antecipação', why: 'Aumenta taxa de visualização completa ao prometer recompensa — algoritmo ama retenção', source: 'SocialPilot', sourceUrl: SOURCE_URLS['SocialPilot'] },
    { hook: 'Você ainda faz {X} manualmente?', category: 'Ponto de Dor', why: 'Abre com identificação, posiciona solução imediatamente — alta conversão', source: 'SocialPilot', sourceUrl: SOURCE_URLS['SocialPilot'] },
    { hook: 'Onde eu comecei vs. onde estou agora', category: 'Jornada de Progresso', why: 'Demonstra transformação — aspiracional e relatable ao mesmo tempo', source: 'SocialPilot', sourceUrl: SOURCE_URLS['SocialPilot'] },
    { hook: 'Eu odiava {coisa} até…', category: 'Antes e Depois', why: 'Jornada de transformação que espectadores reconhecem em si mesmos', source: 'Taggbox', sourceUrl: SOURCE_URLS['Taggbox'] },
    { hook: 'Meu maior erro foi…', category: 'Vulnerabilidade', why: 'Cria conexão através de luta honesta — constrói confiança', source: 'Taggbox', sourceUrl: SOURCE_URLS['Taggbox'] },
    { hook: '3 erros que você tá cometendo com…', category: 'Lista Numerada', why: 'Números prometem valor estruturado e fácil de digerir — alta taxa de salvamento', source: 'Taggbox', sourceUrl: SOURCE_URLS['Taggbox'] },
    { hook: 'Como conseguir {resultado} rápido…', category: 'Vitória Rápida', why: 'Combo velocidade + resultado atrai quem busca eficiência', source: 'Taggbox', sourceUrl: SOURCE_URLS['Taggbox'] },
    { hook: 'Papo reto…', category: 'Autenticidade', why: 'Sinaliza conteúdo honesto e sem filtro — constrói confiança parasocial', source: 'Taggbox', sourceUrl: SOURCE_URLS['Taggbox'] },
    { hook: 'Aposto que você não consegue fazer isso…', category: 'Desafio', why: 'Aciona engajamento por ego — alta taxa de comentários', source: 'Taggbox', sourceUrl: SOURCE_URLS['Taggbox'] },
    { hook: 'Se você já sentiu…', category: 'Experiência Compartilhada', why: 'Identificação e validação instantânea do público — gera compartilhamentos emocionais', source: 'Taggbox', sourceUrl: SOURCE_URLS['Taggbox'] },
  ];

  // Live source pages the user can visit for the freshest hooks
  const liveSources = [
    { name: 'SocialBee — Instagram Trends (Updated Weekly)', url: 'https://socialbee.com/blog/instagram-trends/', description: 'Tendências Instagram desta semana com exemplos reais' },
    { name: 'SocialPilot — Reels Trends', url: 'https://www.socialpilot.co/blog/instagram-reels-trends', description: 'Fórmulas de gancho para Reels atualizadas semanalmente' },
    { name: 'Taggbox — 100+ Best Hooks', url: 'https://taggbox.com/blog/best-instagram-hooks/', description: '100+ ganchos comprovados para Instagram Reels' },
    { name: 'NewEngen — Weekly Trend Breakdown', url: 'https://newengen.com/insights/instagram-trends/', description: 'Análise semanal do que está funcionando no Instagram' },
    { name: 'Torro — Best Hooks 2026', url: 'https://torro.io/blog/100-best-hooks-for-instagram-reels-2026', description: '100+ melhores ganchos para Reels (2026)' },
    { name: 'Captain Hook AI', url: 'https://captain-hook.ai', description: 'Gerador de ganchos com IA treinada em 1.000+ padrões virais' },
  ];

  res.json({
    success: true,
    data: {
      trendingThisWeek,
      provenFormulas,
      liveSources,
      lastUpdated: '2026-04-08',
      totalHooks: trendingThisWeek.length + provenFormulas.length
    }
  });
});

// Budget endpoint (stub to prevent 404)
app.get('/api/budget', (req, res) => {
  res.json({
    used: 0,
    limit: 15,
    currency: 'USD',
    period: 'monthly',
    breakdown: []
  });
});

// Stub GET routes for legacy/phantom requests (prevent 404s)
app.get('/api/collect', (req, res) => {
  res.json({ status: 'idle', message: 'Use POST /api/collection/trigger to start collection' });
});

app.get('/api/collect/status', (req, res) => {
  res.json({ status: 'idle', message: 'Use GET /api/collection/status/:jobId for job status' });
});

app.get('/api/generate', (req, res) => {
  res.json({ status: 'idle', message: 'Use POST /api/generate to start carousel generation' });
});

// Debug endpoint: test all RSS feeds
app.get('/api/debug/feeds', async (req, res) => {
  try {
    const { SignalCollector } = await import('./services/signal-collector');
    const collector = new SignalCollector();
    const results = await collector.testFeeds();
    collector.close();
    const working = results.filter(r => r.items > 0).length;
    res.json({
      summary: `${working}/${results.length} feeds returning data`,
      feeds: results
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint: direct DB query to diagnose signal visibility
app.get('/api/debug/signals', (req, res) => {
  try {
    const Database = require('better-sqlite3');
    const dbPath = require('path').join(process.cwd(), 'data', 'signals.db');
    const fs = require('fs');
    const exists = fs.existsSync(dbPath);
    if (!exists) {
      return res.json({ error: 'signals.db does not exist', path: dbPath, cwd: process.cwd() });
    }
    const db = new Database(dbPath);
    const total = db.prepare('SELECT COUNT(*) as c FROM signals').get();
    const scored = db.prepare('SELECT COUNT(*) as c FROM signals WHERE scored_at IS NOT NULL').get();
    const relevant = db.prepare('SELECT COUNT(*) as c FROM signals WHERE is_relevant = 1').get();
    const sample = db.prepare('SELECT id, title, relevance_score, relevance_reason, is_relevant, scored_at FROM signals WHERE scored_at IS NOT NULL ORDER BY relevance_score DESC LIMIT 5').all();
    db.close();
    res.json({
      dbPath,
      cwd: process.cwd(),
      exists,
      total: total.c,
      scored: scored.c,
      relevant: relevant.c,
      intelConnectorHasDb: !!(intelConnector as any).db,
      intelConnectorPath: (intelConnector as any).dbPath,
      sample
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Reset bad scores so they can be re-scored after API key fix
app.post('/api/debug/reset-scores', (req, res) => {
  try {
    const Database = require('better-sqlite3');
    const dbPath = require('path').join(process.cwd(), 'data', 'signals.db');
    const db = new Database(dbPath);
    const result = db.prepare("UPDATE signals SET relevance_score = NULL, relevance_reason = NULL, is_relevant = 0, scored_at = NULL WHERE relevance_reason LIKE 'Error%'").run();
    db.close();
    res.json({ reset: result.changes, message: `Reset ${result.changes} failed scores. Run collection again to re-score.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create snapshot on demand (for saving current trends to history)
app.post('/api/trending/snapshot', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Snapshot videos (all and pet)
    const themes = viralConnector.getTrendingThemes(7, 50);
    const hooks = viralConnector.getTopViralHooks(7, 20, true);
    const stats = viralConnector.getViralStats(7);

    const petThemes = themes.filter(t => isPetRelated(t.title || ''));
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
  console.log('  POST /api/trending/collect       - Seed demo trending data');
  console.log('  POST /api/trending/snapshot      - Save current trends to history');
  console.log('  POST /api/collection/trigger     - Trigger new data collection');
  console.log('  GET  /api/collection/status/:id  - Collection progress (SSE)');
  console.log('  GET  /api/help/info              - Platform & API info');
  console.log();
  console.log('='.repeat(60));
});

// Prevent crashes from unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught exception:', error);
});

// Cleanup on exit
process.on('SIGINT', () => {
  contentStorage.close();
  intelConnector.close();
  viralConnector.close();
  snapshotManager.close();
  process.exit();
});
