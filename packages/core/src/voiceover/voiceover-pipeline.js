/**
 * voiceover-pipeline.js
 *
 * Orchestrates the complete voiceover pipeline:
 *   1. Extracts captions from a composition file  → .narration.json
 *   2. Generates speech via Google Cloud TTS       → .mp3 + .sync.json
 *
 * Usage:
 *   node voiceover-pipeline.js <composition-file> [options]
 *
 * Options:
 *   --fps=30                    Frame rate (default: 30)
 *   --output=./assets/audio/    Output directory for audio files
 *   --voice=pt-BR-Neural2-C     Google TTS voice name
 *   --rate=1.0                  Speaking rate (0.25–4.0)
 *   --skip-extract              Skip caption extraction, use existing .narration.json
 *   --dry-run                   Extract captions only, don't call TTS API
 *
 * Example:
 *   node voiceover-pipeline.js compositions/OnboardingJourney.jsx
 *   node voiceover-pipeline.js compositions/OnboardingJourney.jsx --voice=pt-BR-Neural2-B --rate=0.95
 */

import fs from 'fs';
import path from 'path';
import { extractCaptions } from './extract-captions.js';
import { generateVoiceover } from './generate-voiceover.js';
import 'dotenv/config';

// ── Parse CLI args ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const compositionPath = args.find((a) => !a.startsWith('--'));
let fps = parseInt(getArg('--fps', '30'), 10);
const outputDir = getArg('--output', './assets/audio');
const voiceName = getArg('--voice', 'pt-BR-Neural2-C');
let speakingRate = parseFloat(getArg('--rate', '1.0'));
let pitch = parseFloat(getArg('--pitch', '0.0'));
let volumeGainDb = parseFloat(getArg('--volume', '0.0'));

if (!Number.isFinite(fps) || !Number.isInteger(fps) || fps <= 0) {
  console.error(`Invalid --fps: must be a positive integer. Got: ${getArg('--fps', '30')}`);
  process.exit(1);
}
if (!Number.isFinite(speakingRate) || speakingRate < 0.25 || speakingRate > 4) {
  const raw = getArg('--rate', '1.0');
  console.error(`Invalid --rate: must be 0.25–4.0. Got: ${raw}`);
  process.exit(1);
}
if (!Number.isFinite(pitch) || pitch < -20 || pitch > 20) {
    const raw = getArg('--pitch', '0.0');
    console.error(`Invalid --pitch: must be -20.0–20.0. Got: ${raw}`);
    process.exit(1);
}
if (!Number.isFinite(volumeGainDb) || volumeGainDb < -96 || volumeGainDb > 16) {
    const raw = getArg('--volume', '0.0');
    console.error(`Invalid --volume: must be -96.0–16.0. Got: ${raw}`);
    process.exit(1);
}
const skipExtract     = args.includes('--skip-extract');
const dryRun          = args.includes('--dry-run');

if (!compositionPath) {
  console.error('Usage: node voiceover-pipeline.js <composition-file> [options]');
  process.exit(1);
}

// ── Validate auth ─────────────────────────────────────────────────────────────

if (!dryRun) {
  const hasCredentials =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_TTS_API_KEY;

  if (!hasCredentials) {
    console.error(`
❌  Google Cloud credentials not found.

Set one of:
  GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json  (recommended)
  GOOGLE_TTS_API_KEY=your-api-key

Add it to your .env file or export it in your shell.
See: https://cloud.google.com/text-to-speech/docs/quickstart
    `);
    process.exit(1);
  }
}

// ── Step 1: Extract captions ──────────────────────────────────────────────────

const narrationPath = /\.(jsx?|tsx?)$/.test(compositionPath)
  ? compositionPath.replace(/\.(jsx?|tsx?)$/, '.narration.json')
  : path.join(path.dirname(compositionPath), path.basename(compositionPath, path.extname(compositionPath)) + '.narration.json');

if (!skipExtract) {
  if (!fs.existsSync(compositionPath)) {
    console.error(`Composition file not found: ${compositionPath}`);
    process.exit(1);
  }
  console.log(`\n📖  Extracting captions from ${path.basename(compositionPath)}...`);
  const source = fs.readFileSync(compositionPath, 'utf-8');
  const result = extractCaptions(source, fps);

  if (result.steps.length === 0) {
    console.error('No <Caption> components found in this composition.');
    console.error('Make sure captions use the text prop with a string literal:');
    console.error('  <Caption text="Your narration text." theme={theme} />');
    process.exit(1);
  }

  fs.writeFileSync(narrationPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`✓ Extracted ${result.steps.length} caption(s) → ${narrationPath}\n`);

  // Show a preview table
  console.log(`  ${'Step'.padEnd(5)} ${'Start'.padEnd(7)} ${'Duration'.padEnd(9)} Text`);
  console.log(`  ${'─'.repeat(5)} ${'─'.repeat(7)} ${'─'.repeat(9)} ${'─'.repeat(50)}`);
  result.steps.forEach((s, i) => {
    console.log(
      `  ${String(i + 1).padEnd(5)} ${(s.startSeconds + 's').padEnd(7)} ${(s.durationSeconds + 's').padEnd(9)} ${s.text.slice(0, 55)}${s.text.length > 55 ? '…' : ''}`
    );
  });
  console.log('');
}

if (dryRun) {
  const msg = skipExtract
    ? 'ℹ️  Dry run — skipping TTS generation. No narration JSON was written (--skip-extract used).'
    : 'ℹ️  Dry run — skipping TTS generation. Narration JSON written above.';
  console.log(msg);
  process.exit(0);
}

// ── Step 2: Generate voiceover ────────────────────────────────────────────────

if (!fs.existsSync(narrationPath)) {
  console.error(`Narration file not found: ${narrationPath}`);
  console.error('Run without --skip-extract to generate it, or ensure the file exists.');
  process.exit(1);
}

const compositionName = path.basename(compositionPath, path.extname(compositionPath));
const outputPath = path.join(outputDir, `${compositionName}-voiceover.mp3`);

await generateVoiceover(narrationPath, outputPath, {
  voice: { name: voiceName },
  audioConfig: {
    speakingRate,
    pitch,
    volumeGainDb,
  },
});

// ── Step 3: Print Remotion usage snippet ─────────────────────────────────────

console.log(`
─────────────────────────────────────────────────────
Add voiceover to your Remotion composition:

  import { Audio } from 'remotion';

  // At the top level of your composition (outside any Sequence):
  <Audio src={staticFile('audio/${path.basename(outputPath)}')} />

Then move the MP3 to:
  public/audio/${path.basename(outputPath)}

Or use the useVoiceover() hook from @videodoc/core for
auto-loading based on composition name.
─────────────────────────────────────────────────────
`);

// ── Utils ─────────────────────────────────────────────────────────────────────

function getArg(prefix, defaultValue) {
  const match = args.find((a) => a.startsWith(prefix + '='));
  return match ? match.split('=').slice(1).join('=') : defaultValue;
}
