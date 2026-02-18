/**
 * extract-captions.js
 *
 * Parses a Remotion composition file and extracts all <Caption> text values
 * along with their Sequence timing (from + durationInFrames).
 *
 * Output: a narration.json file alongside the composition, structured as:
 * {
 *   "fps": 30,
 *   "steps": [
 *     { "from": 90, "durationInFrames": 75, "text": "Abra o MealTime..." },
 *     ...
 *   ]
 * }
 *
 * This JSON is:
 *   1. The input to the TTS generator (generate-voiceover.js)
 *   2. Editable by hand if you want to tweak phrasing before generating audio
 *
 * Usage:
 *   node extract-captions.js <composition-file> [--fps=30]
 *
 * Example:
 *   node extract-captions.js compositions/OnboardingJourney.jsx --fps=30
 */

import fs from 'fs';
import path from 'path';

export function extractCaptions(compositionSource, fps = 30) {
  const steps = [];

  // Match all Sequence blocks and extract from + durationInFrames
  // Then find Caption text inside each block
  const sequencePattern =
    /<Sequence\s+from=\{(\d+)\}\s+durationInFrames=\{(\d+)\}>([\s\S]*?)<\/Sequence>/g;

  const captionPattern = /<Caption\s[^>]*text=["'{`]([^"'}`]+)["'{`]/;

  let match;
  while ((match = sequencePattern.exec(compositionSource)) !== null) {
    const from            = parseInt(match[1], 10);
    const durationInFrames = parseInt(match[2], 10);
    const block           = match[3];

    const captionMatch = captionPattern.exec(block);
    if (captionMatch) {
      steps.push({
        from,
        durationInFrames,
        durationSeconds: +(durationInFrames / fps).toFixed(2),
        startSeconds:    +(from / fps).toFixed(2),
        text: captionMatch[1].trim(),
      });
    }
  }

  return { fps, steps };
}

// ── CLI entry point ──────────────────────────────────────────────────────────

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args         = process.argv.slice(2);
  const compositionPath = args.find((a) => !a.startsWith('--'));
  const fpsArg       = args.find((a) => a.startsWith('--fps='));
  const fps          = fpsArg ? parseInt(fpsArg.split('=')[1], 10) : 30;

  if (!compositionPath) {
    console.error('Usage: node extract-captions.js <composition-file> [--fps=30]');
    process.exit(1);
  }

  const source = fs.readFileSync(compositionPath, 'utf-8');
  const result = extractCaptions(source, fps);

  const outputPath = path.join(
    path.dirname(compositionPath),
    path.basename(compositionPath, path.extname(compositionPath)) + '.narration.json'
  );

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');

  console.log(`✓ Extracted ${result.steps.length} caption(s) → ${outputPath}`);
  result.steps.forEach((s, i) => {
    console.log(`  ${i + 1}. [${s.startSeconds}s] "${s.text.slice(0, 60)}..."`);
  });
}
