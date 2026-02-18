/**
 * generate-voiceover.js
 *
 * Reads a .narration.json file (produced by extract-captions.js),
 * calls Google Cloud Text-to-Speech for each step, then stitches
 * all audio segments into a single continuous MP3 track with
 * natural pauses between steps.
 *
 * The output MP3 is timed to start at the first Caption's startSeconds,
 * so Remotion can load it with a matching delayInFrames offset.
 *
 * Requirements:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var pointing to your service account JSON
 *   - OR GOOGLE_TTS_API_KEY env var for API key auth
 *   - npm packages: @google-cloud/text-to-speech, fluent-ffmpeg, ffmpeg-static
 *
 * Usage:
 *   node generate-voiceover.js <narration.json> [--output=./audio/voiceover.mp3]
 *
 * Example:
 *   node generate-voiceover.js compositions/OnboardingJourney.narration.json
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import TextToSpeech from '@google-cloud/text-to-speech';
import 'dotenv/config';

// ── CONFIG ───────────────────────────────────────────────────────────────────

const VOICE_CONFIG = {
  // Best available Brazilian Portuguese Neural2 voice (as of 2025)
  // Options: pt-BR-Neural2-A (female), pt-BR-Neural2-B (male), pt-BR-Neural2-C (female)
  languageCode: 'pt-BR',
  name: 'pt-BR-Neural2-C',
  ssmlGender: 'FEMALE',
};

const AUDIO_CONFIG = {
  audioEncoding: 'MP3',
  speakingRate: 1.0,   // 0.25–4.0. 1.0 = natural speed
  pitch: 0.0,          // -20.0–20.0 semitones. 0 = default
  volumeGainDb: 0.0,   // -96.0–16.0 dB
};

/**
 * Pause duration (milliseconds) inserted between steps.
 * This gives the viewer time to read the caption before the
 * next narration line starts.
 */
const PAUSE_BETWEEN_STEPS_MS = 800;

// ── MAIN ─────────────────────────────────────────────────────────────────────

export async function generateVoiceover(narrationPath, outputPath, options = {}) {
  const { voiceName = VOICE_CONFIG.name, speakingRate = AUDIO_CONFIG.speakingRate } = options;

  const voiceConfig = { ...VOICE_CONFIG, name: voiceName };
  const audioConfig = { ...AUDIO_CONFIG, speakingRate };

  const narration = JSON.parse(fs.readFileSync(narrationPath, 'utf-8'));
  const { steps } = narration;

  if (!steps || steps.length === 0) {
    throw new Error('No steps found in narration JSON. Run extract-captions.js first.');
  }

  const client = new TextToSpeech.TextToSpeechClient();
  const tmpDir = path.join(path.dirname(narrationPath), '.tts-tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const segmentPaths = [];

  console.log(`\n🎙  Generating voiceover for ${steps.length} step(s)...\n`);

  // ── Lead silence — pad from t=0 to the first caption ──────────────────────
  const leadSilenceS = steps[0]?.startSeconds ?? 0;
  if (leadSilenceS > 0) {
    const silencePath = path.join(tmpDir, '00-lead-silence.mp3');
    await generateSilence(silencePath, leadSilenceS);
    segmentPaths.push(silencePath);
    console.log(`  ✓ Lead silence: ${leadSilenceS}s`);
  }

  // ── Generate each step ─────────────────────────────────────────────────────
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepLabel = String(i + 1).padStart(2, '0');
    const text = typeof step.text === 'string' ? step.text.trim() : '';
    if (!text) {
      console.warn(`  [${stepLabel}/${steps.length}] Skipping step with empty/undefined text.`);
      continue;
    }

    const segPath = path.join(tmpDir, `${stepLabel}-step.mp3`);
    const pausePath = path.join(tmpDir, `${stepLabel}-pause.mp3`);

    console.log(`  [${stepLabel}/${steps.length}] "${text.length > 55 ? text.slice(0, 55) + '...' : text}"`);

    // Call Google TTS
    await synthesizeSpeech(client, text, segPath, voiceConfig, audioConfig);
    segmentPaths.push(segPath);

    // Add inter-step pause (except after the last step)
    if (i < steps.length - 1) {
      await generateSilence(pausePath, PAUSE_BETWEEN_STEPS_MS / 1000);
      segmentPaths.push(pausePath);
    }
  }

  // ── Stitch all segments into one MP3 ──────────────────────────────────────
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n🔗  Stitching ${segmentPaths.length} segments...`);
  await stitchAudio(segmentPaths, outputPath);

  // ── Write a sync manifest ─────────────────────────────────────────────────
  // This tells Remotion exactly where to start the audio track
  const parsed = path.parse(outputPath);
  const manifestPath = /\.(mp3|wav)$/i.test(outputPath)
    ? path.join(parsed.dir, parsed.name + '.sync.json')
    : path.join(parsed.dir, parsed.base + '.sync.json');
  const manifest = {
    audioFile:        path.basename(outputPath),
    delayInFrames:    0, // audio starts at frame 0 (lead silence handles offset)
    leadSilenceS:     leadSilenceS,
    generatedAt:      new Date().toISOString(),
    voice:            voiceConfig.name,
    steps: steps.map((s, i) => ({
      step:         i + 1,
      startSeconds: s.startSeconds,
      text:         s.text,
    })),
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  // ── Cleanup tmp files ─────────────────────────────────────────────────────
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(`\n✅  Voiceover ready:`);
  console.log(`    Audio:    ${outputPath}`);
  console.log(`    Manifest: ${manifestPath}`);
  console.log(`\n    Add to your Remotion composition:`);
  console.log(`    <Audio src="${path.basename(outputPath)}" />\n`);

  return { outputPath, manifestPath, manifest };
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

async function synthesizeSpeech(client, text, outputPath, voiceConfig, audioConfig) {
  const [response] = await client.synthesizeSpeech({
    input: { text },
    voice: voiceConfig,
    audioConfig: {
      audioEncoding:  audioConfig.audioEncoding,
      speakingRate:   audioConfig.speakingRate,
      pitch:          audioConfig.pitch,
      volumeGainDb:   audioConfig.volumeGainDb,
    },
  });

  fs.writeFileSync(outputPath, response.audioContent, 'binary');
}

/**
 * Generate a silent MP3 of the given duration using ffmpeg.
 * Requires ffmpeg to be available on PATH (install via ffmpeg-static or system).
 */
async function generateSilence(outputPath, durationSeconds) {
  const ffmpeg = await getFfmpegPath();
  execSync(
    `"${ffmpeg}" -f lavfi -i anullsrc=r=24000:cl=mono -t ${durationSeconds} -q:a 9 -acodec libmp3lame "${outputPath}" -y`,
    { stdio: 'pipe' }
  );
}

/**
 * Concatenate MP3 files using ffmpeg concat demuxer.
 */
async function stitchAudio(segmentPaths, outputPath) {
  const ffmpeg   = await getFfmpegPath();
  const listPath = outputPath + '.concat.txt';

  const listContent = segmentPaths
    .map((p) => `file '${path.resolve(p).replace(/'/g, "'\\''")}'`)
    .join('\n');
  fs.writeFileSync(listPath, listContent, 'utf-8');

  execSync(
    `"${ffmpeg}" -f concat -safe 0 -i "${listPath}" -c copy "${outputPath}" -y`,
    { stdio: 'pipe' }
  );

  fs.unlinkSync(listPath);
}

async function getFfmpegPath() {
  try {
    // Try ffmpeg-static first (npm package)
    const ffmpegStatic = await import('ffmpeg-static');
    return ffmpegStatic.default;
  } catch {
    // Fall back to system ffmpeg
    return 'ffmpeg';
  }
}

// ── CLI entry point ──────────────────────────────────────────────────────────

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2);
  const narrationPath = args.find((a) => !a.startsWith('--'));

  if (!narrationPath) {
    console.error('Usage: node generate-voiceover.js <narration.json> [--output=path/to/out.mp3]');
    process.exit(1);
  }

  const outputArg = args.find((a) => a.startsWith('--output='));
  const outputPath = outputArg
    ? outputArg.split('=')[1]
    : path.join(
        path.dirname(narrationPath),
        '../assets/audio',
        path.basename(narrationPath).replace('.narration.json', '-voiceover.mp3')
      );

  generateVoiceover(narrationPath, outputPath).catch((err) => {
    console.error('Voiceover generation failed:', err.message);
    process.exit(1);
  });
}
