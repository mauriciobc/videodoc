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

/**
 * Extracts balanced <Sequence>...</Sequence> blocks (handles nesting).
 * Returns [{ attrs, block }, ...] where attrs is the string between
 * <Sequence and >, and block is the inner content.
 */
function findSequenceBlocks(str) {
  const blocks = [];
  let pos = 0;
  while (pos < str.length) {
    const openStart = str.indexOf('<Sequence', pos);
    if (openStart === -1) break;
    const afterTag = openStart + '<Sequence'.length;
    let tagEnd = str.indexOf('>', afterTag);
    if (tagEnd === -1) break;
    // If > is inside quotes, advance to the next >
    let searchFrom = afterTag;
    while (true) {
      const nextGt = str.indexOf('>', searchFrom);
      if (nextGt === -1) break;
      const between = str.slice(openStart, nextGt);
      const quoteMatch = /["'`]/.exec(between);
      if (!quoteMatch) {
        tagEnd = nextGt;
        break;
      }
      const qPos = openStart + quoteMatch.index;
      const quoteChar = str[qPos];
      const closeQuote = str.indexOf(quoteChar, qPos + 1);
      if (closeQuote === -1 || closeQuote > nextGt) {
        // This '>' is inside a quoted value (or quote unclosed); skip it
        searchFrom = nextGt + 1;
        continue;
      }
      searchFrom = closeQuote + 1;
    }
    // Known limitation: prop values with '>' inside template literals (e.g. label={\`score > 0\`})
    // may in rare cases be misparsed; prefer simple quoted strings for props that contain '>'.
    const attrs = str.slice(afterTag, tagEnd).replace(/^\s+/, '').trim();
    const innerStart = tagEnd + 1;
    let depth = 1;
    let i = innerStart;
    let innerEnd = innerStart;
    let inString = false;
    let quoteChar = null;
    while (depth > 0 && i < str.length) {
      if (inString) {
        if (str[i] === '\\') {
          i += 2;
          continue;
        }
        if (str[i] === quoteChar) {
          inString = false;
          quoteChar = null;
          i++;
          continue;
        }
        i++;
        continue;
      }
      if (str[i] === '"' || str[i] === "'" || str[i] === '`') {
        inString = true;
        quoteChar = str[i];
        i++;
        continue;
      }
      if (str.substring(i, i + 9) === '<Sequence') {
        depth += 1;
        i += 9;
        continue;
      }
      if (str.substring(i, i + 11) === '</Sequence>') {
        depth -= 1;
        if (depth === 0) {
          innerEnd = i;
          break;
        }
        i += 11;
        continue;
      }
      i++;
    }
    blocks.push({ attrs, block: str.slice(innerStart, innerEnd) });
    pos = innerEnd + 11;
  }
  return blocks;
}

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
  // Only resolves ALL_CAPS constants (e.g. STEP_DUR = 75). camelCase constants are not resolved by design.
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

  // ── Match Sequence blocks (stack-based for nested <Sequence>) ─────────────
  const sequenceBlocks = findSequenceBlocks(compositionSource);
  // Caption text: supports quoted strings with escapes (e.g. text="hello \"world\"")
  const captionTextPattern = /text=(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;

  for (const { attrs, block } of sequenceBlocks) {
    // Accept numeric literals AND constant/expression references, e.g.:
    //   from={90}  from={STEP}  from={STEP * 2}
    const fromMatch = attrs.match(/\bfrom=\{([^}]+)\}/);
    const durationMatch = attrs.match(/\bdurationInFrames=\{([^}]+)\}/);
    if (!fromMatch || !durationMatch) continue;

    const from = resolveExpr(fromMatch[1]);
    const durationInFrames = resolveExpr(durationMatch[1]);
    if (isNaN(from) || isNaN(durationInFrames)) continue;

    captionTextPattern.lastIndex = 0;
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
