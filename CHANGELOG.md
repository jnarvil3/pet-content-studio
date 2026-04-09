# Changelog

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
