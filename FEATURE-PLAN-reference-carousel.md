# Feature Plan: Carrossel por Referência

**Status:** Implemented
**Requested by:** Hugo (April 8, 2026)
**Priority:** Next feature

## What

User uploads 1-5 screenshots of a carousel they saw online (competitor, inspiration) and generates a new carousel based on it for their brand/topic.

## Two Modes

### 🔄 Clone
- Same structure, same slide count, same content flow
- Hook → Problem → Stat → Tip → CTA pattern replicated
- Brand/topic/voice swapped in, but the content approach is a close replica
- "Make this exact carousel but for my brand about my topic"

### ✨ Inspirado (Inspired)
- Uses the reference as direction/vibe
- AI has freedom to adapt, add/remove slides, change the flow
- User can specify additions: "like this but add a stat slide" or "same vibe but more informal"
- "Use this as inspiration and create something similar with these changes: ___"

## User Flow

1. Go to Create page
2. Click "🎨 Carrossel por Referência"
3. Upload 1-5 images (screenshots of the reference carousel)
4. See thumbnail previews of uploads
5. Select mode: 🔄 Clone or ✨ Inspirado
6. Type instructions (required for Inspirado, optional for Clone):
   - Clone: "Sobre nutrição canina para a Namuh"
   - Inspirado: "Mesmo estilo mas mais informal, adicionar dados sobre alimentação natural"
7. Click "🚀 Gerar Conteúdo"
8. AI analyzes reference → generates content → renders slides
9. Result appears in Review page with reference thumbnails shown for comparison

## Technical Approach

### Vision Analysis (new: `src/services/style-analyzer.ts`)
- Send uploaded images to Gemini 2.5 Flash (text model, multimodal input)
- Prompt instructs Gemini to extract:
  - Number of slides and their types (hook, content, stat, CTA)
  - Content flow/structure
  - Tone and messaging approach
  - Key phrases, hook formula, CTA pattern
  - Visual style notes (dark/light, minimal/bold, photo-heavy/text-heavy)
- Returns structured JSON: `CarouselAnalysis`

### Content Generation (reuse existing)
- `CarouselAnalysis` + user instructions + brand context → ContentWriter prompt
- Clone mode: prompt says "replicate this exact structure with new topic"
- Inspirado mode: prompt says "use this as inspiration, adapt freely, apply these changes: ___"
- Output: same `CarouselContent` (slides[], caption, hashtags) as existing pipeline

### Rendering (reuse existing)
- CarouselTemplate + ImageRenderer (Puppeteer) — no changes needed
- Pexels fetches background images as usual
- Brand colors/fonts applied as usual

### API Endpoint
- `POST /api/generate-from-reference`
- Multer multi-file upload (max 5 images, 5MB each)
- Body: `mode` ('clone' | 'inspired'), `instructions` (string), `title` (optional)
- Async generation (same pattern as /api/generate)

### UI (Create page)
- New button: "🎨 Carrossel por Referência" alongside existing Carrossel/Reel/LinkedIn
- Upload area with drag-and-drop, thumbnail preview
- Mode toggle: 🔄 Clone / ✨ Inspirado
- Instructions textarea (larger for Inspirado mode)
- Existing AI quality toggle (fast/premium) applies
- Existing generate button triggers it

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/services/style-analyzer.ts` | **CREATE** — Gemini vision analysis |
| `src/types/content.ts` | **MODIFY** — Add `CarouselAnalysis` type |
| `src/generators/content-writer.ts` | **MODIFY** — Add reference-aware prompt building |
| `src/server.ts` | **MODIFY** — Add `/api/generate-from-reference` endpoint |
| `public/studio.html` | **MODIFY** — Add reference button + upload UI |
| `public/studio.js` | **MODIFY** — Add upload handlers, mode toggle, FormData submission |

## Cost

- Gemini vision analysis: ~$0.002-0.008 per carousel (1-5 images)
- Content generation: ~$0.01 (GPT-4o-mini) or ~$0.20 (Claude Sonnet 4)
- Pexels + Puppeteer rendering: free
- **Total: ~$0.01-0.03 per Clone, ~$0.01-0.22 per Inspirado (depending on AI quality)**

## Not in Scope (v1)

- Pixel-perfect visual cloning (CSS extraction, font detection)
- Video/reel reference analysis
- Multi-carousel batch from one reference
- Saving reference templates for reuse (could be v2)
