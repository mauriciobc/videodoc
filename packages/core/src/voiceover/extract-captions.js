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

  // ── Resolve numeric constants from the source ─────────────────────────────
  // Handles: const STEP = 90; const FPS = 30; const N = 3 * 90;
  const constants = {};
  const constDeclPattern = /(?:const|let|var)\s+([A-Z_][A-Z0-9_]*)\s*=\s*([^;,\n]+)/g;
  let constMatch;
  while ((constMatch = constDeclPattern.exec(compositionSource)) !== null) {
    const name = constMatch[1];
    const rawValue = constMatch[2].trim();
    // Simple numeric literal
    if (/^\d+$/.test(rawValue)) {
      constants[name] = parseInt(rawValue, 10);
    }
  }
  // Second pass: resolve expressions that reference other constants
  // (e.g. "3 * STEP", "FPS * 10", "STEP")
  const resolveExpr = (expr) => {
    expr = expr.trim();
    // Pure number
    if (/^\d+$/.test(expr)) return parseInt(expr, 10);
    // Try substituting known constants and evaluating simple arithmetic
    let resolved = expr.replace(/\b([A-Z_][A-Z0-9_]*)\b/g, (_, name) =>
      constants[name] !== undefined ? constants[name] : name,
    );
    // Only evaluate if the expression is safe (numbers, spaces, +-*/)
    if (/^[\d\s+\-*/().]+$/.test(resolved)) {
      try {
        // eslint-disable-next-line no-new-func
        return Function(`"use strict"; return (${resolved})`)();
      } catch { /* fall through */ }
    }
    return NaN;
  };

  // ── Match Sequence blocks permissively (any attribute order) ──────────────
  const sequencePattern = /<Sequence\b([\s\S]*?)>([\s\S]*?)<\/Sequence>/g;
  // Caption text: supports quoted strings with escapes (e.g. text="hello \"world\"")
  const captionTextPattern = /text=(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;

  let seqMatch;
  while ((seqMatch = sequencePattern.exec(compositionSource)) !== null) {
    const attrs = seqMatch[1];
    const block = seqMatch[2];

    // Accept numeric literals AND constant/expression references, e.g.:
    //   from={90}  from={STEP}  from={STEP * 2}
    const fromMatch = attrs.match(/\bfrom=\{([^}]+)\}/);
    const durationMatch = attrs.match(/\bdurationInFrames=\{([^}]+)\}/);
    if (!fromMatch || !durationMatch) continue;

    const from = resolveExpr(fromMatch[1]);
    const durationInFrames = resolveExpr(durationMatch[1]);
    if (isNaN(from) || isNaN(durationInFrames)) continue;

    let captionMatch;
    while ((captionMatch = captionTextPattern.exec(block)) !== null) {
      const rawText = captionMatch[2].replace(/\\(.)/g, '$1');
      steps.push({
        from,
        durationInFrames,
        durationSeconds: +(durationInFrames / fps).toFixed(2),
        startSeconds: +(from / fps).toFixed(2),
        text: rawText.trim(),
      });
    }
  }

  return { fps, steps };
}

// ── CLI entry point ──────────────────────────────────────────────────────────

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2);
  const compositionPath = args.find((a) => !a.startsWith('--'));
  const fpsArg = args.find((a) => a.startsWith('--fps='));
  let fps = fpsArg ? parseInt(fpsArg.split('=')[1], 10) : 30;
  if (!Number.isFinite(fps) || !Number.isInteger(fps) || fps <= 0) {
    if (fpsArg) {
      console.error(`Invalid --fps value: ${fpsArg.split('=')[1]}. Must be a positive integer.`);
      process.exit(1);
    }
    fps = 30;
  }

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
    const preview = s.text.length > 60 ? s.text.slice(0, 60) + '...' : s.text;
    console.log(`  ${i + 1}. [${s.startSeconds}s] "${preview}"`);
  });
}
