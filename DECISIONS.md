# Pet Content Generator - Technical Decisions & Architecture

**Last Updated:** March 13, 2026
**Project:** Automated viral-enhanced Instagram reel generation for pet industry

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Decisions](#architecture-decisions)
3. [AI Model Selection](#ai-model-selection)
4. [Viral Pattern Integration](#viral-pattern-integration)
5. [Video Generation Pipeline](#video-generation-pipeline)
6. [UI/UX Decisions](#uiux-decisions)
7. [Testing Strategy](#testing-strategy)
8. [Known Issues & Fixes](#known-issues--fixes)
9. [Future Improvements](#future-improvements)

---

## System Overview

**Purpose:** Generate viral-quality Instagram Reels automatically by combining:
- Intelligence signals (trending pet topics from RSS)
- Viral video patterns (proven hooks from YouTube analysis)
- AI script generation (Claude Sonnet 4 or GPT-4o-mini)
- Text-to-speech (ElevenLabs)
- Stock B-roll (Pexels)
- FFmpeg video composition with text overlays and transitions

**Key Files:**
- `src/generators/reel-generator.ts` - Main reel generation orchestrator
- `src/generators/reel-script-writer.ts` - AI script generation (Claude/OpenAI)
- `src/storage/viral-signals-connector.ts` - Viral video data integration
- `public/studio.html` + `public/studio.js` - Unified UI

---

## Architecture Decisions

### 1. Dual AI Model Support

**Decision:** Support both Claude Sonnet 4 and GPT-4o-mini with UI toggle

**Rationale:**
- **Claude Sonnet 4:** Premium quality for viral content ($0.20/script, 20x more expensive)
- **GPT-4o-mini:** Fast iterations and cost-effective ($0.01/script)
- Users choose based on need (quality vs. speed/cost)

**Implementation:**
```typescript
// src/generators/reel-script-writer.ts
constructor(aiModel?: 'claude-sonnet-4' | 'gpt-4o-mini') {
  if (aiModel === 'claude-sonnet-4') {
    this.anthropicClient = new Anthropic({...});
  } else {
    this.openaiClient = new OpenAI({...});
  }
}
```

**UI Control:** Toggle buttons in Create page (Premium/Fast)

**Environment Variables:**
```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
AI_MODEL_PREFERENCE=claude-sonnet-4  # Default (optional)
```

---

### 2. Viral Pattern Integration

**Decision:** Use SPECIFIC viral video titles/angles, not generic hook categories

**Problem:** Generic categories like "emotional" are too vague
**Solution:** Pass actual viral video title + content angle to AI

**Example:**
```javascript
{
  viralTitle: "Dog Says First Word! 🐕",
  viralContentAngle: "Heartwarming moment caught on camera",
  hookFormula: "emotional"  // Just for reference
}
```

**AI Prompt Enhancement:**
```
REQUIRED: Emulate this PROVEN VIRAL PATTERN:
* Example viral title: "Dog Says First Word! 🐕"
* Content approach: "Heartwarming moment caught on camera"

Study the pattern above and create a hook that uses the SAME
structure/format but adapted to YOUR topic.
```

**Data Flow:**
1. User clicks "Create from this" on trending video
2. Frontend captures viral title + angle
3. Backend passes to ReelScriptWriter
4. AI generates script matching viral pattern

---

### 3. FFmpeg Text Overlay Enhancement

**Decision:** Add animated text overlays with graceful degradation

**Features Added:**
- **Hook overlay:** Big animated text (first 3 seconds, center screen)
- **Subtitle captions:** Bottom text matching narration (all scenes)
- **Smooth transitions:** Crossfade between scenes (xfade filter)
- **Brand watermark:** Logo/text overlay

**Graceful Degradation:**
```typescript
private async checkFFmpegCapabilities() {
  this.hasDrawtext = /* check if drawtext available */;
  this.hasXfade = /* check if xfade available */;
}

// Only apply if available
if (this.hasDrawtext && narration) {
  videoFilter += `,drawtext=...`;
}
```

**FFmpeg Requirements:**
- **Full version:** `brew install ffmpeg-full` (includes freetype for text)
- **Basic version:** `brew install ffmpeg` (no text overlays, still works)

**Text Escaping Fix:**
```typescript
private escapeFFmpegText(text: string): string {
  return text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, '')  // Remove apostrophes (they break filters)
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%');
}
```

---

### 4. Video Duration Matching

**Decision:** Match video length to actual TTS audio duration, not estimated times

**Problem:** Original code used hardcoded scene offsets, causing:
- Video ending before audio finished
- Audio/video sync issues

**Solution:** Calculate exact durations dynamically
```typescript
// Get actual audio duration
const { stdout } = await execAsync('ffprobe ... "${audioPath}"');
const sceneDuration = parseFloat(stdout.trim());

// Trim/loop video to match
await execAsync(`ffmpeg -y -i "${videoPath}" -t ${sceneDuration} ...`);
```

**Transition Timing Fix:**
```typescript
// OLD: Hardcoded offsets
offset = 2.5; // WRONG

// NEW: Cumulative duration calculation
for (let i = 1; i < videoPaths.length; i++) {
  const duration = await getVideoDuration(videoPaths[i]);
  const offset = cumulativeDuration - transitionDuration;
  // Use actual offset in xfade filter
}
```

---

## AI Model Selection

### Claude Sonnet 4

**Model:** `claude-sonnet-4-20250514`
**Cost:** $3/1M input tokens, $15/1M output tokens
**Avg Script Cost:** ~$0.20 (1000 tokens in, 500 tokens out)
**Speed:** 3-5 seconds per script

**Strengths:**
- Excellent creative writing
- Better at viral hooks and storytelling
- Natural conversational tone
- Follows complex instructions well

**When to use:** Final production reels, important campaigns

### GPT-4o-mini

**Model:** `gpt-4o-mini`
**Cost:** $0.15/1M input tokens, $0.60/1M output tokens
**Avg Script Cost:** ~$0.01
**Speed:** 1-2 seconds per script

**Strengths:**
- 20x cheaper than Claude
- Fast iterations
- Good for testing/prototyping
- Reliable JSON output

**When to use:** High-volume testing, quick iterations, budget constraints

---

## Viral Pattern Integration

### Data Sources

1. **Intelligence Signals** (WHAT to create)
   - Source: RSS feeds from pet industry sites
   - Database: `pet-intel-collector/data/signals.db`
   - Selection: Signals with relevance_score >= 70

2. **Viral Videos** (HOW to create it)
   - Source: YouTube pet videos analyzed for patterns
   - Database: `viral-social-media-analyzer/data/viral-signals.db`
   - Analysis: Hook formulas, engagement rates, content angles

### Integration Flow

```
Trending Videos Tab
  ↓ User clicks "Create from this"
  ↓
Create Page (with viral pattern selected)
  ↓ User selects topic signal
  ↓ User chooses AI quality
  ↓ User clicks "Generate Reel"
  ↓
API /api/generate-reel
  {
    signalId: 13,
    aiModel: "claude-sonnet-4",
    viralTitle: "Dog Says First Word!",
    viralContentAngle: "Heartwarming moment",
    viralHook: "emotional"
  }
  ↓
ReelScriptWriter receives viral pattern
  ↓ Builds prompt with specific viral example
  ↓ AI generates script matching pattern
  ↓
Reel Generation Pipeline
  ↓ Script → TTS → B-roll → FFmpeg → Final video
  ↓
Review Queue (pending approval)
```

### Hook Formula Categories

| Formula | Engagement | Example Title |
|---------|-----------|---------------|
| emotional | 5.8% | "Dog Reunited With Owner After 3 Years" |
| curiosity | 5.5% | "What This Dog Did Next Will Shock You" |
| urgency | 5.2% | "Stop Feeding Your Dog This Immediately" |
| authority | 4.9% | "Vet Reveals #1 Mistake Dog Owners Make" |
| contrarian | 5.1% | "Everything You Know About Dog Training is Wrong" |

---

## Video Generation Pipeline

### 5-Step Process

**Step 1: Script Generation (10-15s)**
- AI model: Claude Sonnet 4 or GPT-4o-mini
- Input: Signal topic + viral pattern (optional)
- Output: JSON with 5 scenes, narration, search terms
- Target: 30-45 second script

**Step 2: Text-to-Speech (8-12s)**
- Service: ElevenLabs
- Voice: Natural conversational
- Output: 5 audio files (scene-1.mp3, scene-2.mp3, etc.)

**Step 3: B-roll Video Fetch (15-25s)**
- Service: Pexels
- Format: Portrait 1080x1920 (9:16)
- Output: 5 video files per scene

**Step 4: Video Composition (20-40s)**
- Tool: FFmpeg
- Process:
  1. Match each video clip to audio duration
  2. Apply text overlays (hook + subtitles)
  3. Crossfade between scenes (0.5s transitions)
  4. Add brand watermark
  5. Combine video + audio

**Step 5: Thumbnail Generation (1-2s)**
- Extract frame from final video
- Save as JPEG

**Total Time:** ~60-90 seconds per reel

### FFmpeg Command Structure

```bash
# Scene processing (with text overlay)
ffmpeg -y -stream_loop -1 -i "video.mp4" -t ${duration} \
  -vf "scale=1080:1920,crop=1080:1920,\
       drawtext=text='Hook text':fontcolor=white:fontsize=64:...,\
       drawtext=text='Caption':fontcolor=white:fontsize=48:..." \
  -c:v libx264 -preset fast -crf 23 -r 25 -an "scene-processed.mp4"

# Scene concatenation (with xfade)
ffmpeg -y -i scene1.mp4 -i scene2.mp4 -i scene3.mp4 \
  -filter_complex "[0:v][1:v]xfade=duration=0.5:offset=2.5[v1];\
                   [v1][2:v]xfade=duration=0.5:offset=7.5" \
  -c:v libx264 -preset fast -crf 23 "concatenated.mp4"

# Final merge (video + audio + watermark)
ffmpeg -y -i "video.mp4" -i "audio.mp3" \
  -vf "movie=logo.png,scale=120:-1[wm];[in][wm]overlay=W-w-20:H-h-20" \
  -c:v libx264 -c:a aac -shortest "final.mp4"
```

---

## UI/UX Decisions

### Studio.html - Unified Interface

**Decision:** Single-page app with tab navigation (vs separate pages)

**Tabs:**
- **📊 Signals:** View available intelligence signals
- **🔥 Trending Videos:** Browse viral videos, select patterns
- **✏️ Create:** Generate content with viral enhancement
- **✅ Review:** Approve/reject generated content

### Create Page Features

1. **Signal Selector**
   - Dropdown with top 20 signals (score >= 70)
   - Shows relevance score
   - Displays signal details when selected

2. **AI Quality Toggle**
   ```
   [⚡ Fast (~$0.01)]  [✨ Premium (~$0.20)]
   ```
   - Visual feedback (active button highlighted)
   - Description updates based on selection
   - Default: Premium (Claude Sonnet 4)

3. **Viral Pattern Display** (if selected)
   ```
   💡 Viral Pattern Selected
   Example: "Dog Says First Word! 🐕"
   Angle: Heartwarming moment caught on camera
   ```

4. **Progress Tracking**
   - Real-time progress bar (0-100%)
   - Current step display ("Generating voiceover...")
   - Time remaining estimate
   - Auto-refresh review queue on completion

### Review Queue Improvements

**Fixed Issues:**
- JSON parsing error (carousel_images already array)
- Video thumbnails loading via YouTube API
- Filters working (All, Pending, Approved, Rejected)
- Signal details showing with each item

**Video Display:**
```html
<video controls style="width: 100%; max-height: 400px;">
  <source src="/output/reels/signal-13/reel-final.mp4">
</video>
```

---

## Testing Strategy

### Test Files

1. **ffmpeg-capabilities.test.ts**
   - Verify FFmpeg installation
   - Check drawtext filter (text overlays)
   - Check xfade filter (transitions)
   - Validate libx264 encoder

2. **content-generation.test.ts**
   - Test signal selection API
   - Test generate endpoints (carousel/reel)
   - Test content review workflow
   - Verify content appears in review queue

3. **ai-model-selection.test.ts** (NEW)
   - Verify aiModel parameter accepted
   - Test both claude-sonnet-4 and gpt-4o-mini
   - Validate cost estimates

4. **viral-pattern-integration.test.ts** (NEW)
   - Test viral pattern parameters
   - Verify /api/viral/insights endpoint
   - Validate hook formula patterns

### Running Tests

```bash
# All tests
npm test
npm run test:all

# Specific test suites
npm run test:ffmpeg    # FFmpeg capabilities
npm run test:api       # Content generation API
npm run test:ai        # AI model selection
npm run test:viral     # Viral pattern integration

# Watch mode (auto-rerun on changes)
npm run test:watch
```

### Test Server Requirements

- Server must be running on port 3003
- Databases must be accessible
- API keys must be configured (for full integration tests)

---

## Known Issues & Fixes

### 1. FFmpeg Text Overlay Failure

**Issue:** "No such filter: 'drawtext'" error
**Cause:** Basic FFmpeg lacks freetype support
**Fix:** Install ffmpeg-full
```bash
brew uninstall ffmpeg
brew install ffmpeg-full
```

**Verification:**
```bash
ffmpeg -filters 2>&1 | grep drawtext
# Should output: "T. drawtext V->V Draw text..."
```

### 2. Apostrophe Breaking FFmpeg Filters

**Issue:** Text like "It's" breaks filter syntax
**Error:** `No such filter: 'furniture'`
**Fix:** Remove apostrophes in escaping function
```typescript
.replace(/'/g, '')  // Remove single quotes
```

### 3. Video Ending Before Audio

**Issue:** Hardcoded transition offsets caused video cutoff
**Fix:** Calculate cumulative durations dynamically
```typescript
const durations = await Promise.all(videoPaths.map(getDuration));
let offset = durations[0] - transitionDuration;
// Use actual calculated offset
```

### 4. Signal Selection Not Working

**Issue:** API ignored signalId parameter
**Fix:** Added signalId parameter support to both endpoints
```typescript
const signalId = req.body.signalId ? parseInt(req.body.signalId) : null;
if (signalId) {
  const signal = connector.getSignal(signalId);
  signals = [signal];
}
```

### 5. Caption/Narration Mismatch

**Issue:** On-screen text showed captionText, audio spoke narration
**Fix:** Use narration for both (acts as subtitles)
```typescript
// OLD
const captionText = script.scenes[i].captionText;

// NEW
const captionText = script.scenes[i].narration;
```

### 6. Claude API Credit Balance Error

**Issue:** "Credit balance too low" when using Claude
**Solution:** Either:
1. Add credits at https://console.anthropic.com/settings/plans
2. Use Fast mode (GPT-4o-mini) in UI

---

## Future Improvements

### High Priority

1. **Error Handling in UI**
   - Show specific error messages (not just "Generation failed")
   - Display API credit warnings before generation
   - Retry logic for failed generations

2. **Background Task Management**
   - Show all running generations
   - Cancel in-progress generations
   - Queue system for multiple reels

3. **Reel Preview Before Approval**
   - Inline video player in review queue
   - Edit caption/hashtags before approval
   - Re-generate with different settings

### Medium Priority

4. **Cost Tracking**
   - Track API costs per generation
   - Daily/monthly budget alerts
   - Cost comparison between models

5. **Batch Generation**
   - Generate multiple reels at once
   - Schedule generations
   - Export approved reels in batch

6. **Advanced Viral Pattern Matching**
   - ML model to suggest best viral pattern for each signal
   - A/B testing different hooks
   - Performance tracking (which patterns perform best)

### Low Priority

7. **Custom Brand Watermarks**
   - Upload custom logo
   - Adjust watermark position
   - Animated watermarks

8. **Music Integration**
   - Background music from royalty-free libraries
   - Trending audio tracks
   - Volume mixing with voiceover

9. **Social Media Publishing**
   - Direct publish to Instagram
   - Schedule posts
   - Auto-post on approval

---

## Environment Setup

### Required API Keys

```bash
# AI Models
ANTHROPIC_API_KEY=sk-ant-...       # For Claude Sonnet 4 (premium)
OPENAI_API_KEY=sk-proj-...         # For GPT-4o-mini (fast)

# Content Services
ELEVENLABS_API_KEY=sk_...          # Text-to-speech
PEXELS_API_KEY=...                 # Stock B-roll videos

# Database Connections
INTEL_DATABASE_PATH=../pet-intel-collector/data/signals.db
VIRAL_DATABASE_PATH=../viral-social-media-analyzer/data/viral-signals.db

# Server
PORT=3003
NODE_ENV=development

# Defaults
AI_MODEL_PREFERENCE=claude-sonnet-4  # or gpt-4o-mini
```

### Dependencies

```bash
npm install @anthropic-ai/sdk openai better-sqlite3 \
            fluent-ffmpeg axios puppeteer dotenv express \
            cors vitest tsx typescript
```

### System Requirements

- **FFmpeg:** ffmpeg-full (with freetype, xfade)
- **Node.js:** v20+ recommended
- **Databases:** SQLite (no external DB needed)

---

## Quick Start

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Setup environment
cp .env.example .env
# Edit .env with your API keys

# 3. Install FFmpeg
brew install ffmpeg-full

# 4. Run tests
npm run test:ffmpeg  # Verify FFmpeg
npm run test:api     # Test API (server must be running)

# 5. Start server
npm start

# 6. Open UI
open http://localhost:3003/studio.html
```

---

## Project Structure

```
pet-content-generator/
├── src/
│   ├── generators/
│   │   ├── reel-generator.ts          # Main orchestrator
│   │   ├── reel-script-writer.ts      # AI script generation
│   │   ├── content-writer.ts          # Carousel generation
│   │   └── image-generator.ts         # Carousel images
│   ├── services/
│   │   ├── elevenlabs-tts.ts          # Text-to-speech
│   │   └── pexels-video-service.ts    # B-roll videos
│   ├── storage/
│   │   ├── content-storage.ts         # Generated content DB
│   │   ├── intel-connector.ts         # Intelligence signals
│   │   └── viral-signals-connector.ts # Viral video data
│   ├── tests/
│   │   ├── ffmpeg-capabilities.test.ts
│   │   ├── content-generation.test.ts
│   │   ├── ai-model-selection.test.ts
│   │   └── viral-pattern-integration.test.ts
│   ├── types/
│   ├── config/
│   └── server.ts                      # Express API
├── public/
│   ├── studio.html                    # Unified UI
│   └── studio.js                      # UI logic
├── output/
│   ├── reels/                         # Generated reels
│   └── carousels/                     # Generated carousels
├── data/
│   └── content.db                     # SQLite database
├── .env                               # Environment config
├── package.json
├── tsconfig.json
├── DECISIONS.md                       # This file
└── README.md
```

---

## Contact & Support

**Issues:** Track in GitHub issues
**Questions:** Refer to this DECISIONS.md file first
**Updates:** Document all major changes here

---

**End of Decision Log**
