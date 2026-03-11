# Pet Content Generator

Automated Instagram content generator for pet industry businesses. Converts trending topic signals into Instagram-ready content.

## Architecture

```
pet-intel-collector (Signals DB)
         ↓
pet-content-generator
         ↓
Level 1: Carousels (5-slide posts) ✅ READY
Level 2: Reels (30-45s videos)     🚧 Coming next
Level 3: AI-Generated Video        📅 Future
```

## Features

### Level 1: Carousel Posts (Current)
- **AI Content Rewriting**: OpenAI GPT-4o-mini creates conversational, engaging content
- **4:5 Portrait Format**: 1080x1350px for 20% more screen space & ~28% higher engagement
- **Safe Zone**: Critical text/logos kept within 1012x1350px center (grid view safe)
- **Background Images**: Auto-fetches relevant Pexels photos with gradient overlays
- **Swipe Cue**: Animated "Swipe →" indicator on slide 1
- **Data-Driven**: Each carousel includes a prominent statistic slide
- **Conversational Tone**: Sounds like a real person, not a brand or textbook
- **Approval Queue**: Review and approve/reject before publishing
- **Traceability**: Every carousel links back to source signal

### Cost Estimate
- **GPT-4o-mini**: ~$0.01 per carousel (2K output tokens)
- **Target**: $15/month = ~1,500 carousels/month = ~50/day

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env` file:
```bash
# OpenAI API (for content generation)
OPENAI_API_KEY=your_openai_api_key_here

# Pexels API (for background images - optional but recommended)
PEXELS_API_KEY=your_pexels_api_key_here

# Path to intelligence collector database (optional)
INTEL_DATABASE_PATH=../pet-intel-collector/data/signals.db
```

**Get API Keys:**
- OpenAI: https://platform.openai.com/api-keys
- Pexels: https://www.pexels.com/api/ (free, no credit card required)

### 3. Configure Brand Identity
Edit `config/brand.json` (optional, defaults to SureStep Automation):
```json
{
  "name": "Your Brand",
  "handle": "@yourbrand",
  "colors": {
    "primary": "#667eea",
    "secondary": "#764ba2",
    "accent": "#4caf50"
  },
  "voice": {
    "tone": ["friendly", "educational", "trustworthy"],
    "forbidden_words": ["miracle", "guaranteed", "cure"],
    "forbidden_claims": ["FDA approved"]
  },
  "ctas": {
    "carousel": [
      "Save this for later! 📌",
      "Follow for more pet care tips"
    ]
  },
  "services": [
    "dog walking",
    "veterinary care",
    "pet grooming"
  ]
}
```

## Usage

### Generate Carousels

**Generate 3 carousels (default):**
```bash
npm run generate
```

**Generate 10 carousels from signals with score >= 70:**
```bash
npm run generate:batch
```

**Custom parameters:**
```bash
tsx src/cli/generate-carousels.ts [limit] [minScore]

# Examples:
tsx src/cli/generate-carousels.ts 5 85  # 5 carousels, score >= 85
tsx src/cli/generate-carousels.ts 1 90  # 1 carousel, score >= 90
```

Get your OpenAI API key at: https://platform.openai.com/api-keys

### Output Structure

```
output/carousels/
  signal-123/
    carousel-123-1.png    # Slide 1 (Hook)
    carousel-123-2.png    # Slide 2 (Content)
    carousel-123-3.png    # Slide 3 (Content)
    carousel-123-4.png    # Slide 4 (Content)
    carousel-123-5.png    # Slide 5 (CTA)
    metadata.json         # Full content + source info
```

### Approval Queue

Generated content is saved to `data/content.db` with status `pending`.

**View stats:**
```bash
sqlite3 data/content.db "SELECT status, COUNT(*) FROM generated_content GROUP BY status;"
```

**View pending queue:**
```bash
sqlite3 data/content.db "SELECT id, signal_id, content_type, generated_at FROM generated_content WHERE status='pending';"
```

**Approve content:**
```bash
sqlite3 data/content.db "UPDATE generated_content SET status='approved', approved_at=datetime('now') WHERE id=1;"
```

**Reject content:**
```bash
sqlite3 data/content.db "UPDATE generated_content SET status='rejected', rejected_at=datetime('now'), rejection_reason='Off-brand tone' WHERE id=2;"
```

## Project Structure

```
src/
├── cli/
│   └── generate-carousels.ts     # CLI tool to generate carousels
├── config/
│   └── brand-config.ts            # Brand configuration loader
├── generators/
│   ├── content-writer.ts          # Claude AI content generation
│   └── carousel-generator.ts      # Main carousel pipeline
├── renderers/
│   └── image-renderer.ts          # Puppeteer HTML → PNG
├── storage/
│   ├── intel-connector.ts         # Read signals from intel DB
│   └── content-storage.ts         # Approval queue database
├── templates/
│   └── carousel-template.ts       # HTML/CSS slide templates
└── types/
    ├── signal.ts                  # Signal type definitions
    ├── content.ts                 # Content type definitions
    └── brand.ts                   # Brand config types

config/
  └── brand.json                   # Your brand configuration

data/
  └── content.db                   # Approval queue database

output/
  └── carousels/                   # Generated carousel images
```

## How It Works

1. **Fetch Signals**: Reads top-scoring signals from intelligence collector DB
2. **AI Content Generation**: OpenAI GPT-4o-mini rewrites signal into 5-slide carousel
3. **Template Rendering**: Generates HTML with brand colors/fonts
4. **Image Export**: Puppeteer converts HTML → 1080x1080 PNGs
5. **Approval Queue**: Saves to database for human review
6. **Publish**: (Manual for now) Upload approved carousels to Instagram

## Next: Level 2 (Reels)

Coming soon:
- Reel script generator (30-45 second structure)
- TTS voiceover (ElevenLabs or OpenAI)
- B-roll video assembly (Remotion)
- Animated captions
- Background music

## API Cost Tracking

- GPT-4o-mini: $0.150 / 1M input tokens, $0.600 / 1M output tokens
- Typical carousel: 1K input + 2K output = ~$0.0015
- Budget: $15/month = ~10,000 carousels/month

## Troubleshooting

**No signals found:**
- Run intelligence collector first: `cd ../pet-intel-collector && npm start`
- Lower the minimum score: `tsx src/cli/generate-carousels.ts 3 60`

**Puppeteer errors:**
- Install Chrome: `npx puppeteer browsers install chrome`
- On Linux: Install dependencies: `apt-get install -y chromium-browser`

**OpenAI API errors:**
- Check `.env` has valid `OPENAI_API_KEY`
- Verify API key at: https://platform.openai.com/api-keys

## License

MIT
