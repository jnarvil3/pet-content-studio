# Level 2: Instagram Reel Generator

Automated 30-45 second Instagram Reels with voiceover, B-roll video, and captions.

## Architecture

```
Intelligence Signal (score ≥ 80)
    │
    ▼
① LLM generates 5-scene Reel script
    │
    ▼
② ElevenLabs TTS creates voiceover audio
    │
    ▼
③ Pexels API fetches B-roll video clips
    │
    ▼
④ FFmpeg composites final MP4
    │
    ▼
Approval Queue
```

## Setup

### 1. Install FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html

### 2. API Keys Already Configured ✅

- OpenAI (for script generation) ✅
- ElevenLabs (for TTS voiceover) ✅
- Pexels (for B-roll video) ✅

## Features

### Script Generation
- **5-scene structure**: Hook → Problem → Insight → Tip → CTA
- **Hook formulas**: Curiosity gap, contrarian, question, mistake, personal
- **Natural narration**: Sounds like a real person, not AI
- **Per-scene search terms**: Targeted Pexels queries for each scene

### Voiceover (ElevenLabs)
- **Voice**: Rachel (warm, friendly)
- **Quality**: eleven_turbo_v2_5 (fast, good quality)
- **Cost**: ~$0.11 per reel
- **Per-scene audio**: Easier timing/alignment

### B-Roll Video (Pexels)
- **Portrait orientation**: 1080x1920 (9:16)
- **Scene-specific searches**: "dog playing park", "anxious puppy", etc.
- **Fallback terms**: Cute dog, happy puppy, dog outdoors
- **Free**: No cost, just API key

### Video Composition (FFmpeg MVP)
- **Resolution**: 1080x1920 (standard Instagram Reel)
- **Audio**: Concatenated voiceover from all scenes
- **Video**: B-roll clips matched to audio duration
- **Output**: H.264 MP4
- **Thumbnail**: Auto-generated from frame at 1s

## Usage

### Generate Reel from Dashboard

1. Go to http://localhost:3001
2. Click **"Generate Reel"** button (coming soon to UI)
3. Select number of reels and min score
4. Wait 60-120 seconds per reel
5. Review in approval queue

### API Endpoint

```bash
POST http://localhost:3001/api/generate-reel
Content-Type: application/json

{
  "limit": 1,
  "minScore": 80
}
```

Response:
```json
{
  "success": true,
  "message": "Starting generation of 1 reel(s)...",
  "count": 1
}
```

### CLI (Coming Soon)

```bash
npm run generate:reel
```

## Output Structure

```
output/reels/signal-123/
├── script.json               # LLM-generated script
├── audio/
│   ├── scene-1.mp3           # TTS per scene
│   ├── scene-2.mp3
│   ├── scene-3.mp3
│   ├── scene-4.mp3
│   └── scene-5.mp3
├── video/
│   ├── scene-1-broll.mp4     # Pexels clips
│   ├── scene-2-broll.mp4
│   ├── scene-3-broll.mp4
│   ├── scene-4-broll.mp4
│   └── scene-5-broll.mp4
├── reel-final.mp4            # Final composed Reel
├── thumbnail.jpg             # Auto-generated
└── metadata.json             # Full metadata
```

## Script Structure

### Scene 1: Hook (0-3 seconds)
- **Purpose**: Stop the scroll
- **Narration**: 1 sentence, max 10 words
- **Examples**:
  - "Your dog isn't being bad. They're scared."
  - "Stop washing your dog's eyes like that."
  - "This $3 toy saved my sanity."

### Scene 2: Problem (3-12 seconds)
- **Purpose**: Make them relate
- **Narration**: 2-3 sentences, max 30 words
- **Example**: "Most owners miss these subtle stress signals... and it makes things worse."

### Scene 3: Insight (12-25 seconds)
- **Purpose**: Core value + stat
- **Narration**: 2-3 sentences with data point
- **Example**: "Research shows 73% of dogs show anxiety signs that go unnoticed. Here's what to watch for."

### Scene 4: Tip (25-35 seconds)
- **Purpose**: Actionable takeaway
- **Narration**: 2-3 sentences, specific advice
- **Example**: "Start by watching their ears, tail, and breathing. These three tell you everything."

### Scene 5: CTA (35-45 seconds)
- **Purpose**: Warm sign-off
- **Narration**: 1-2 sentences
- **Example**: "Follow for more pet tips. Your dog will thank you."

## Cost Estimate

| Component | Tool | Cost per Reel |
|-----------|------|---------------|
| Script generation | OpenAI GPT-4o-mini | ~$0.01 |
| TTS voiceover | ElevenLabs turbo v2.5 | ~$0.11 |
| B-roll video | Pexels | $0 (free) |
| Video rendering | FFmpeg | $0 (open source) |
| **Total** | | **~$0.12** |

At 3 reels/day: **~$11/month**

## Limitations (MVP)

### Current Version:
- ✅ Script generation with LLM
- ✅ TTS voiceover (ElevenLabs)
- ✅ B-roll video fetching (Pexels)
- ✅ Basic FFmpeg composition
- ⚠️  Simple video (loops first clip to match audio)
- ⚠️  No animated captions yet
- ⚠️  No scene transitions
- ⚠️  No brand watermark overlay

### Phase 2 (Optional Improvements):
- [ ] Word-by-word animated captions (like TikTok/Reels)
- [ ] Scene-specific video clips (not just looped)
- [ ] Gradient overlays on video
- [ ] Brand watermark/logo
- [ ] Scene transitions (crossfades)
- [ ] Background music
- [ ] Remotion for advanced composition
- [ ] Caption timing via whisper.cpp

## Technical Notes

### Why FFmpeg First (Not Remotion)?
- **Faster to implement**: Working MVP in hours, not days
- **Easier to debug**: Command-line tools, not React components
- **Good enough for testing**: Validate script/TTS/B-roll pipeline first
- **Can upgrade later**: Remotion layer can be added on top

### FFmpeg Command Pattern

**Concatenate audio:**
```bash
ffmpeg -f concat -safe 0 -i audio-list.txt -c copy combined-audio.mp3
```

**Scale & crop video to 9:16:**
```bash
ffmpeg -i input.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" output.mp4
```

**Combine video + audio:**
```bash
ffmpeg -i video.mp4 -i audio.mp3 -c:v copy -c:a aac -shortest final.mp4
```

## Troubleshooting

**"ffmpeg not found":**
```bash
brew install ffmpeg  # macOS
sudo apt-get install ffmpeg  # Linux
```

**"ElevenLabs API key not configured":**
- Already configured in your `.env` file ✅

**"No B-roll videos found":**
- Check Pexels API key
- Try different search terms
- Fallback terms will be used automatically

**Generation takes too long:**
- Pexels API has rate limits (50 requests/hour free tier)
- TTS generation takes ~2-3 seconds per scene
- FFmpeg processing takes ~10-20 seconds
- Total: 60-120 seconds per reel (expected)

## Next Steps

1. **Install FFmpeg** (required)
2. **Test generation** with 1 reel
3. **Review output** in `output/reels/`
4. **Add UI button** for reel generation
5. **Phase 2**: Add captions, overlays, Remotion

## Reference

Architecture modeled after: [gyoridavid/short-video-maker](https://github.com/gyoridavid/short-video-maker)
