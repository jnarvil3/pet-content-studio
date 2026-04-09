# Changelog

## 2026-04-09 — Reference Carousel: Pipeline Simplification, Claude Caption Toggle, Tests

### Pipeline Simplification (5 steps → 3)

The original reference carousel pipeline had 5 steps: (1) Gemini vision analyzes screenshots → JSON description, (2) GPT-4o-mini generates slide text from JSON, (3) Gemini generates background images from text descriptions, (4) Puppeteer renders text on top of backgrounds, (5) save.

**Why this was wrong:** Each step introduced data leakage. Gemini saw the reference images, described them in text, and then a separate Gemini call tried to recreate visuals from that text — losing color palette, composition, mood, and typography weight in the description→JSON→back-to-Gemini round-trip. The text generation step was also unnecessary because Gemini's image generation can render text directly on slides.

**What replaced it:** 3 steps: (1) Gemini image gen receives the actual reference screenshots + prompt, generates complete finished slides with text baked in, (2) one cheap text call for Instagram caption + hashtags, (3) save. This eliminates the StyleAnalyzer, ContentWriter.generateFromReference, CarouselTemplate, ImageRenderer/Puppeteer, and PexelsService from the reference pipeline entirely. Faster (~30s vs ~2min), cheaper (no Pexels calls), and visually more faithful to the reference.

### Claude Sonnet 4 Option for Reference Captions

**Why:** The reference carousel was the only content type that always used GPT-4o-mini for text generation. Every other type (carousels, reels, LinkedIn) already respected the fast/premium AI toggle on the Create page. Users who selected "Premium" were silently getting budget-tier captions on reference carousels.

**What changed:** The endpoint now reads `aiModel` from the request body and branches: Claude Sonnet 4 uses `@anthropic-ai/sdk` with markdown-fence stripping (Claude doesn't support `response_format: json_object`); GPT-4o-mini uses the existing OpenAI path. The UI confirmation dialog now shows the selected AI quality and cost. Default remains GPT-4o-mini for backward compatibility.

### Tests Added

**Why now:** The feature was shipped without tests to meet the deadline. Now that it's stable and being enhanced, tests lock down the contract before further changes.

15 tests in `src/tests/reference-carousel.test.ts` covering:
- AI model selection (valid values, defaults, model ID mapping)
- Mode validation (clone/inspired, rejection of invalid modes)
- Caption JSON parsing (OpenAI clean JSON, Claude markdown-fenced JSON, empty fields)
- Gemini service availability detection (env var toggle)
- `generateFromReference` method existence on GeminiImageService
- Anthropic SDK importability
- Content storage shape (carousel structure, source_url format, clone vs inspired distinction)

### Files Changed

- `src/server.ts` — Read `aiModel` from FormData, conditional Claude/OpenAI caption generation
- `public/studio.js` — Append `selectedAIModel` to reference FormData, show AI quality in confirmation dialog
- `src/services/gemini-image.ts` — Added `generateFromReference()` method (multimodal image input)
- `src/tests/reference-carousel.test.ts` — **New file.** 15 tests
- `package.json` — Added `test:reference` script

---

## 2026-04-09 — Carrossel por Referência (Reference Carousel)

Hugo's next requested feature: upload 1-5 screenshots of a carousel seen online and generate a new carousel based on it.

### New Feature: Reference Carousel Generation

Users can now upload screenshots of competitor or inspiration carousels and generate new branded carousels in two modes:

- **Clone** — Replicates the exact structure, slide count, content flow, and hook formula. Swaps in the user's brand topic and voice while keeping the structural DNA identical.
- **Inspirado** — Uses the reference as creative direction. AI has freedom to adapt, add/remove slides, change the flow. User provides instructions for how to deviate.

**How it works:**
1. Create page → click "Carrossel por Referencia" (pink button)
2. Upload 1-5 screenshots via drag-and-drop or file picker
3. Select Clone or Inspirado mode
4. Add instructions (required for Inspirado, optional for Clone)
5. Generate — Gemini 2.5 Flash analyzes the screenshots, then the existing carousel pipeline generates and renders slides

**Cost:** ~$0.01-0.03 per generation (Gemini vision analysis + GPT-4o-mini content generation)

### Files Created

- `src/services/style-analyzer.ts` — Gemini 2.5 Flash vision service. Sends uploaded images as multimodal input, extracts slide types, content flow, tone, hook formula, CTA pattern, and visual style as structured JSON (`CarouselAnalysis`)

### Files Changed

- `src/types/content.ts` — Added `CarouselAnalysis` and `CarouselAnalysisSlide` interfaces
- `src/generators/content-writer.ts` — Added `generateFromReference()` method with separate prompt templates for Clone (replicate structure) and Inspirado (creative freedom) modes
- `src/server.ts` — Added `POST /api/generate-from-reference` endpoint with multer multi-file upload (max 5 images, 5MB each), async pipeline with progress polling, auto-cleanup of uploaded files
- `public/studio.html` — Added reference button in content type row, drag-and-drop upload area with thumbnail previews, Clone/Inspirado mode toggle, instructions textarea
- `public/studio.js` — File upload handling, drag-and-drop, mode toggle state, `generateFromReference()` with FormData submission, `pollReferenceProgress()` for real-time status updates
- `FEATURE-PLAN-reference-carousel.md` — Status updated to Implemented

### Requirements

- `GOOGLE_AI_API_KEY` in `.env` (already present) — required for Gemini vision analysis of reference screenshots

---

## 2026-04-08 — Slide Text Editor, Multi-Region Filters, Engagement Sorting, Instagram Hooks, Gemini Images

Client feedback session with Hugo (April 8th). Revert point: `55b61ac`. Follow-up fixes applied same day.

### Follow-Up Fixes (same day)

- **Pesquisa results now sortable by engagement or views** — Added sort toggle (📊 Engajamento / 👁️ Views) to custom search results. Both metrics shown in bold on each video row. Sort persists until user changes it. **Why:** Hugo wanted the search to be sortable the same way as Videos em Alta.

- **Instagram hooks now visible by default** — Removed the hidden toggle; hooks auto-load when the Ganchos Virais tab opens. **Why:** Hugo couldn't see the hooks — they were hidden behind a "Mostrar" button.

- **Instagram hooks now use real-world data** — Replaced the static curated list with hooks sourced from SocialBee (this week's trending), SocialPilot (proven formulas), and Taggbox (comprehensive library). Each hook shows its source, category, and why it works. Added 6 live source links (SocialBee, SocialPilot, Taggbox, NewEngen, Torro, Captain Hook AI) so the user can visit for the freshest data. **Why:** Hugo wanted real-world hooks from sites that regularly track what's working, not a generic template list.

### Bug Fixes

- **Slide editor now supports text editing** — Previously, the slide edit modal only changed the background photo (Pexels search). When Hugo asked to make "20%" text bigger, it replaced the entire background image. The modal now has 4 tabs: 📝 Texto (edit title, body, stat number/context), 📷 Foto (Pexels stock), 🎨 IA (Gemini image generation), 📤 Upload (custom image). Each tab re-renders only the affected slide. **Why:** Hugo reported that editing "20%" tried to change the photo instead of the text formatting.

### New Features

- **Multi-region selectors across all Discover tabs** — Sinais de Conteúdo, Videos em Alta, and Ganchos Virais now have region selectors matching the 12 countries from custom search (Brazil, US, Mexico, Argentina, Portugal, Spain, Germany, France, UK). Signals filter by URL domain patterns; videos and hooks filter by title language detection heuristics. **Why:** Hugo wanted to divide content by Brazil and other selectable regions instead of just All/Brasil/Global.

- **Dual sorting for Videos em Alta** — New sort toggle: "📊 Maior Engajamento" (engagement rate) and "👁️ Mais Vistos" (view count). Both metrics now display on every video card. **Why:** Hugo noted we only showed most-viewed but also wanted highest engagement relative to views shown separately.

- **Curated Instagram hook formulas** — New expandable section in Ganchos Virais tab with 26 proven hook templates across 8 categories (Curiosidade, POV, Hack, Transformação, Contrária, Estatística, Lista, Pergunta). Each includes fill-in-the-blank templates with pet-themed examples. Links to external creator tools (Captain Hook AI, CreatorsJet, Submagic, Torro). Served via `/api/instagram-hooks`. **Why:** Hugo asked for viral Instagram hook integration — websites or tools that regularly post common hooks.

- **Gemini/Imagen AI image generation for slides** — New 🎨 IA tab in slide editor. Users describe the image they want and Google Imagen generates it (~$0.02-0.04/image). Includes preset prompts (veterinário, gato elegante, infográfico, ilustração). Requires `GOOGLE_AI_API_KEY` in .env. **Why:** Hugo wanted AI-generated images (Gemini) for custom carousels instead of only stock photos.

- **Custom image upload for slides** — New 📤 Upload tab in slide editor. Users can upload PNG/JPG/WebP (max 10MB) as custom slide backgrounds. Preview before submission. **Why:** Complements the Gemini integration — allows uploaded media for carousels.

- **Local newspaper RSS feeds (opt-in)** — Added G1 Natureza, Folha Cotidiano, and UOL Notícias RSS feeds to the intel collector. Disabled by default; enable with `INCLUDE_LOCAL_NEWS=true` in .env. Pet-relevant articles are filtered downstream by AI scoring. **Why:** Hugo asked whether local newspapers are sent to RSS. Answer: they weren't — now they can be, opt-in.

### Files Changed

- `public/studio.html` — Slide edit modal: 4 tabs (text/photo/AI/upload), region selectors on all 3 Discover sub-tabs, sort toggle on Videos, Instagram hooks section
- `public/studio.js` — `editSlideImage()` populates text fields, `setSlideEditMode()` 4 modes, `submitSlideTextEdit()`, `submitSlideAIGenerate()`, `submitSlideUpload()`, `previewSlideUpload()`, `setVideoRegion()`, `setHookRegion()`, `setVideoSort()`, `loadInstagramHooks()`, `toggleInstagramHooks()`, dual-metric video cards
- `src/server.ts` — `POST /api/content/:id/edit-slide-text/:slideNum` (text editing), `POST /api/content/:id/generate-slide-image/:slideNum` (Gemini), `POST /api/content/:id/upload-slide-image/:slideNum` (upload), `GET /api/instagram-hooks` (curated hooks), region filtering via `REGION_LANGUAGE_MARKERS` + `matchesRegionLanguage()` + `filterByRegion()`, `REGION_URL_PATTERNS` for signal URL-based filtering, region params on `/api/trending/videos` and `/api/trending/hooks`
- `src/services/gemini-image.ts` — **New file.** GeminiImageService using `@google/genai` SDK + Imagen model
- `src/tests/api-endpoints.test.ts` — 6 new tests: slide text editing via updateCarousel (title, body, stat, preservation)
- `src/tests/filtering.test.ts` — 18 new tests: region language matching (9), video sorting modes (3), Instagram hook structure (3), Gemini service availability (3)
- `pet-intel-collector/src/collectors/rss-news.ts` — Added `RSS_FEEDS_BR_NEWS` (G1, Folha, UOL), opt-in via `INCLUDE_LOCAL_NEWS=true`
- `.env.example` — Added `GOOGLE_AI_API_KEY`
- `package.json` — Added `@google/genai`, downgraded `vitest` to v2 (Node 20 compat)

### Test Results

- **79 tests passing** across api-endpoints (26) and filtering (53) test files
- **126 total passing** across all 9 test files (23 failures are pre-existing server-required tests)
- New tests cover: slide text editing, region language matching, video sorting, Instagram hooks structure, Gemini service availability

---

## 2026-04-07 — Separate Tone of Voice, Custom Search, Reel Fixes

### New Features

- **Separate tone of voice for LinkedIn and Instagram** — Two independent tone fields in brand settings. LinkedIn posts use professional tone, Instagram carousels/captions/reels use a friendlier tone. Each flows into the respective content generator via `buildBrandContext(brand, channel)`.
- **Custom viral search** — New search panel in the Videos tab. Choose any country (12 options) and any topic (not limited to pets). Shows cost estimate per search (YouTube API units). Results display with thumbnails, view counts, engagement rates, and a "Usar" button to create content from any result.

### Bug Fixes

- **Reels failing silently** — FFmpeg `drawtext` filter not available on Homebrew installs. Watermark function returned empty string instead of null, causing FFmpeg to crash with "Filter not found". Now returns null and falls through to no-watermark composition.
- **Reel video not playing in UI** — Generator saved absolute filesystem paths (`/Users/.../reel-final.mp4`) to the database instead of relative paths. Frontend couldn't convert to a valid URL. Now stores relative paths and the frontend handles all path formats.
- **Auto-detect fonts across macOS and Linux/Docker** — Replaced hardcoded OS-specific font paths with runtime detection. Checks Linux paths first (Liberation, FreeFonts, Noto) then macOS. Works on Railway's Docker and local macOS without env vars.

### Files Changed

- `src/types/brand.ts` — Added `tone_linkedin` and `tone_instagram` to voice interface and defaults
- `src/config/brand-context.ts` — New `ContentChannel` type, `getToneForChannel()` helper, channel-aware context building
- `src/generators/linkedin-writer.ts` — Passes `'linkedin'` channel to brand context
- `src/generators/content-writer.ts` — Passes `'instagram'` channel to brand context
- `src/generators/reel-script-writer.ts` — Passes `'instagram'` channel to brand context
- `src/generators/reel-generator.ts` — Font auto-detection, drawtext null fix, relative video path fix
- `src/services/youtube-collector.ts` — Public `searchVideos()` method with configurable region and maxResults
- `src/server.ts` — New `POST /api/trending/custom-search` endpoint
- `public/studio.html` — Two tone fields, custom search panel with country/topic/cost
- `public/studio.js` — Load/save both tones, custom search UI, video path fix

---

## 2026-03-30 — QA Fixes + Precise Edit Mode

### Bug Fixes (QA 16/16)

- **Version badges on all cards** — v1 shows gray badge, v2+ shows purple. Previously v1 cards had no version indicator.
- **Rejection reason required** — Empty rejections now blocked with error toast. Fixed `showConfirm()` returning boolean `true` instead of empty string for empty input, which bypassed validation.
- **Discover sections stuck loading** — Changed `Promise.all` to `Promise.allSettled` so one failed section doesn't block others. Added DOM error fallback to signals loader.
- **Reel video black screens** — Added `poster` attribute to `<video>` elements using auto-generated `thumbnail.jpg` from the reel pipeline.
- **Empty rejection toast timing** — Added 150ms delay so toast renders after modal close animation completes.
- **Legacy "Sem motivo informado"** — Cleared placeholder rejection reasons from DB. Added JS guard to hide the reason box for legacy values.

### New Feature: Precise Edit Mode

Added a "🎯 Edição Precisa" toggle in the Solicitar Alteracoes modal that upgrades the AI model and enforces literal instruction-following during content regeneration.

**How it works:**
- **UI:** Checkbox toggle with "~10x custo" cost indicator
- **Model upgrades:** Carousels/LinkedIn switch from `gpt-4o-mini` to `gpt-4o`; Reels use `claude-sonnet-4`
- **Prompt directives:** When enabled, AI is instructed to follow user text verbatim, use only specified hashtags, and avoid adding extra content
- **Post-generation overrides:** `extractQuotedText()` and `extractHashtags()` regex-extract exact user-specified caption/hashtags from feedback and replace AI output, guaranteeing verbatim results

### Files Changed
- `public/studio.html` — Precise mode toggle UI, cache-busting
- `public/studio.js` — Version badges, rejection flow, toast fix, reel posters, discover fallbacks, precise mode flag
- `src/server.ts` — Regenerate endpoint accepts `preciseMode`, routes to upgraded models
- `src/generators/content-writer.ts` — Model selection, prompt directives, `extractQuotedText()`, `extractHashtags()`
- `src/generators/linkedin-writer.ts` — Model selection, prompt directives
- `src/generators/carousel-generator.ts` — `preciseMode` passthrough
- `src/generators/reel-script-writer.ts` — Prompt directives for precise mode

### Development Process
All fixes were developed using an autonomous Claude Code + Cowork feedback loop:
- Claude Code polled `feedback.md` every 2 minutes, read issues, applied fixes
- Cowork visually inspected the app in Chrome, wrote findings back
- 10 feedback cycles completed, QA score reached 16/16
