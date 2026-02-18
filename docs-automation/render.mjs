/**
 * Render script for Remotion compositions.
 *
 * Pipeline (per composition):
 *   1. Voiceover  — extracts <Caption> text, calls Google TTS, writes MP3 to
 *                   docs-output/audio/<Id>-voiceover.mp3 (skipped when no
 *                   TTS credentials are set in env).
 *   2. Bundle     — webpack bundle via @remotion/bundler SSR API.
 *   3. Render     — headless Chrome render via @remotion/renderer.
 *
 * The SSR API is used instead of `npx remotion render` because of a monorepo
 * webpack alias conflict (see docs-automation/README.md for details).
 *
 * Usage:
 *   node docs-automation/render.mjs [composition-id] [output-path]
 *
 * Defaults:
 *   composition-id  AuthFlow
 *   output-path     docs-output/<composition-id>.mp4
 *
 * Environment variables (for voiceover):
 *   GOOGLE_APPLICATION_CREDENTIALS  path to service-account JSON   (preferred)
 *   GOOGLE_TTS_API_KEY              API key (alternative)
 */

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const compositionId = process.argv[2] ?? 'AuthFlow';
const outputLocation =
  process.argv[3] ?? path.join(__dirname, '..', 'docs-output', `${compositionId}.mp4`);

const entryPoint = path.join(__dirname, 'Root.jsx');
const compositionFile = path.join(__dirname, 'compositions', `${compositionId}.jsx`);

// docs-output/ is the Remotion publicDir: staticFile('audio/X.mp3') resolves to
// docs-output/audio/X.mp3, staticFile('screenshots/...') to docs-output/screenshots/...
const publicDir = path.join(__dirname, '..', 'docs-output');
const audioDir = path.join(publicDir, 'audio');

// ── Step 1: Voiceover ─────────────────────────────────────────────────────────

const hasTTSCredentials =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_TTS_API_KEY;

if (hasTTSCredentials) {
  console.log(`\n🎙  Generating voiceover for ${compositionId}...`);
  const { extractCaptions } = await import('@videodoc/core/voiceover').catch(() => null) ?? {};
  if (!extractCaptions) {
    console.warn('   ⚠  @videodoc/core/voiceover not available, skipping voiceover.');
  } else {
    const { generateVoiceover } = await import(
      '../packages/core/src/voiceover/generate-voiceover.js'
    );
    const { extractCaptions: extract } = await import(
      '../packages/core/src/voiceover/extract-captions.js'
    );
    const { readFileSync, writeFileSync, existsSync, mkdirSync } = await import('fs');

    if (existsSync(compositionFile)) {
      const source = readFileSync(compositionFile, 'utf-8');
      const narration = extract(source, 30);
      const narrationPath = compositionFile.replace(/\.(jsx?|tsx?)$/, '.narration.json');
      writeFileSync(narrationPath, JSON.stringify(narration, null, 2));
      console.log(`   ✓ Extracted ${narration.steps.length} caption(s)`);

      const audioPath = path.join(audioDir, `${compositionId}-voiceover.mp3`);
      mkdirSync(audioDir, { recursive: true });
      await generateVoiceover(narrationPath, audioPath);
    } else {
      console.warn(`   ⚠  Composition file not found: ${compositionFile}`);
    }
  }
} else {
  const audioFile = path.join(audioDir, `${compositionId}-voiceover.mp3`);
  const { existsSync } = await import('fs');
  if (!existsSync(audioFile)) {
    console.log(
      '\nℹ  No TTS credentials found. Rendering without voiceover.\n' +
        '   Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_TTS_API_KEY to enable narration.\n'
    );
  } else {
    console.log(`\n🎙  Using existing voiceover: ${audioFile}`);
  }
}

// ── Step 2: Bundle ────────────────────────────────────────────────────────────

// Fix monorepo webpack alias conflict: @remotion/bundler maps '@remotion/studio'
// to dist/index.js (a single file). Webpack then resolves '@remotion/studio/renderEntry'
// as dist/index.js/renderEntry, ignoring the package exports field. We replace the
// broad alias with an exact-match alias so subpaths resolve correctly.
const webpackOverride = (currentConfig) => {
  const { '@remotion/studio': studioAlias, ...restAliases } = currentConfig.resolve.alias ?? {};
  return {
    ...currentConfig,
    resolve: {
      ...currentConfig.resolve,
      alias: {
        ...restAliases,
        '@remotion/studio$': studioAlias,
        '@remotion/studio/renderEntry': path.join(
          require.resolve('@remotion/studio/renderEntry'),
          '..',
          'esm',
          'renderEntry.mjs',
        ),
      },
    },
  };
};

console.log(`\n📦  Bundling ${compositionId}...`);
const bundleLocation = await bundle({ entryPoint, webpackOverride, publicDir });

// ── Step 3: Render ────────────────────────────────────────────────────────────

fs.mkdirSync(path.dirname(outputLocation), { recursive: true });

console.log(`🎬  Selecting composition: ${compositionId}`);
const composition = await selectComposition({ serveUrl: bundleLocation, id: compositionId });

console.log(`🎥  Rendering → ${outputLocation}`);
await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: 'h264',
  outputLocation,
  onProgress: ({ renderedFrames, encodedFrames, progress }) => {
    const pct = Math.round(progress * 100);
    process.stdout.write(`\r   ${pct}% (${renderedFrames} rendered / ${encodedFrames} encoded)`);
  },
});

console.log(`\n\n✅  Done! ${outputLocation}`);
