# Voiceover Pipeline — videodoc

Automated Brazilian Portuguese narration for documentation videos using
Google Cloud Text-to-Speech Neural2 voices.

---

## How it works

```
Composition (.jsx)
  └─ extract-captions.js   → reads all <Caption text="..."> + timing
       └─ .narration.json  → editable narration script
            └─ generate-voiceover.js  → calls Google TTS per step
                 └─ stitches segments  → single .mp3 track
                      └─ Remotion <Audio>  → final video with voiceover
```

The narration text is **auto-extracted from your existing Caption components** —
no separate script to maintain. Edit the `.narration.json` to tweak phrasing
before generating audio without touching the composition.

---

## Setup

### 1. Install dependencies

```bash
npm install @google-cloud/text-to-speech ffmpeg-static dotenv
```

FFmpeg is bundled via `ffmpeg-static`. If you prefer a system install:
```bash
brew install ffmpeg   # macOS
sudo apt install ffmpeg  # Ubuntu
```

### 2. Set up Google Cloud credentials

**Option A — Service account (recommended for CI/CD):**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable the **Cloud Text-to-Speech API**
3. Create a Service Account → download the JSON key
4. Add to `.env`:
```
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

**Option B — API key (simpler for local use):**

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create an API Key, restrict it to Cloud TTS API
3. Add to `.env`:
```
GOOGLE_TTS_API_KEY=AIza...
```

### 3. Copy credentials template
```bash
cp .env.example .env
# Fill in your values
```

---

## Usage

### Full pipeline (extract + generate)

```bash
node packages/core/src/voiceover/voiceover-pipeline.js \
  compositions/OnboardingJourney.jsx
```

Output:
```
assets/audio/OnboardingJourney-voiceover.mp3
compositions/OnboardingJourney.narration.json
```

### Dry run — extract captions only, no TTS call

```bash
node packages/core/src/voiceover/voiceover-pipeline.js \
  compositions/OnboardingJourney.jsx --dry-run
```

Use this to review and edit the narration text before spending API quota.

### Options

```
--fps=30                  Frame rate (default: 30)
--output=./assets/audio/  Output directory
--voice=pt-BR-Neural2-B   Override voice (A=female, B=male, C=female, D=male)
--rate=0.95               Speaking rate (0.25–4.0, default: 1.0)
--dry-run                 Extract only, skip TTS
--skip-extract            Use existing .narration.json, skip extraction
```

### Regenerate audio after editing narration

```bash
# 1. Edit the narration text
nano compositions/OnboardingJourney.narration.json

# 2. Regenerate audio from the edited file
node packages/core/src/voiceover/voiceover-pipeline.js \
  compositions/OnboardingJourney.jsx --skip-extract
```

---

## Wiring into Remotion

After generating the MP3, move it to `public/audio/`:

```bash
mv assets/audio/OnboardingJourney-voiceover.mp3 public/audio/
```

The `useVoiceover()` hook auto-loads it by convention:

```jsx
import { useVoiceover } from '@videodoc/core/voiceover';

export const OnboardingJourney = () => {
  const { VoiceoverAudio } = useVoiceover();

  return (
    <AbsoluteFill>
      <VoiceoverAudio />   {/* plays at frame 0, covers the full video */}
      {/* ... your Sequences ... */}
    </AbsoluteFill>
  );
};
```

Pass `muted={true}` while building the composition to skip audio during preview:
```jsx
const { VoiceoverAudio } = useVoiceover({ muted: true });
```

---

## Available Brazilian Portuguese voices

| Voice | Gender | Character |
|---|---|---|
| `pt-BR-Neural2-A` | Female | Warm, clear |
| `pt-BR-Neural2-B` | Male | Neutral, professional |
| `pt-BR-Neural2-C` | Female | Bright, friendly ← **default** |
| `pt-BR-Neural2-D` | Male | Deep, authoritative |

Test all four before committing:
```bash
for voice in A B C D; do
  node packages/core/src/voiceover/voiceover-pipeline.js \
    compositions/OnboardingJourney.jsx \
    --voice=pt-BR-Neural2-$voice \
    --output=./assets/audio/samples/
done
```

---

## Full pipeline (screenshots + voiceover + render)

```bash
# 1. Capture screenshots
npm run docs:screenshots

# 2. Generate voiceover
node packages/core/src/voiceover/voiceover-pipeline.js \
  compositions/OnboardingJourney.jsx

# 3. Move audio to public/
mv assets/audio/OnboardingJourney-voiceover.mp3 public/audio/

# 4. Render final video
npm run docs:render
```

Or add a combined script to package.json:
```json
"docs:full": "npm run docs:screenshots && npm run docs:voiceover && npm run docs:render"
```

---

## Cost reference (Google Cloud TTS)

Neural2 voices: **$16 per 1 million characters**.

A typical 30-second tutorial video with 8–10 captions ≈ 500–800 characters ≈ **< $0.02 per video**.

---

## Troubleshooting

**"Could not load the default credentials"**
→ Check that `GOOGLE_APPLICATION_CREDENTIALS` points to a valid JSON file and the service account has the `Cloud Text-to-Speech API User` role.

**Audio is out of sync with the video**
→ The lead silence is calculated from the first Caption's `startSeconds`. If your Intro has no Caption, the audio correctly waits until step 1 appears. Adjust `PAUSE_BETWEEN_STEPS_MS` in `generate-voiceover.js` if steps feel rushed or too slow.

**TTS audio is too fast/slow**
→ Try `--rate=0.9` (slightly slower) or `--rate=1.05` (slightly faster).

**ffmpeg not found**
→ Run `npm install ffmpeg-static` or install system ffmpeg.
