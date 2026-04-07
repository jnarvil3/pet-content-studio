# Changelog

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
