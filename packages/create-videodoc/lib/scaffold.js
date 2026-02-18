import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function scaffold(answers) {
  const {
    projectName,
    baseUrl,
    stateMethod,
    primaryColor,
    outputDir,
    fps,
    resolution,
  } = answers;

  const targetDir = path.join(process.cwd(), 'docs-automation');
  const normalizedOutputDir = normalizeOutputDir(outputDir);
  const productId = slugify(projectName) || 'default-product';

  const dirs = [
    targetDir,
    path.join(targetDir, 'journeys'),
    path.join(targetDir, 'compositions'),
    path.join(targetDir, 'fixtures'),
    path.join(targetDir, 'scripts'),
    path.join(targetDir, 'server'),
    path.join(targetDir, 'ui'),
    path.join(targetDir, 'ui', 'src'),
    path.join(targetDir, 'assets', 'screenshots'),
    path.join(targetDir, 'assets', 'brand'),
  ];
  dirs.forEach((d) => fs.mkdirSync(d, { recursive: true }));
  writeFile(path.join(targetDir, 'assets', 'brand', '.gitkeep'), '');
  scaffoldUiAndServer(targetDir);

  writeFile(
    path.join(targetDir, 'playwright.config.js'),
    playwrightConfig({ baseUrl, outputDir: normalizedOutputDir, resolution })
  );

  writeFile(
    path.join(targetDir, 'remotion.config.js'),
    remotionConfig({ fps, resolution })
  );

  writeFile(
    path.join(targetDir, 'theme.js'),
    themeFile({ primaryColor })
  );

  writeFile(
    path.join(targetDir, 'Root.jsx'),
    rootFile({ projectName, fps, resolution })
  );

  writeFile(
    path.join(targetDir, 'fixtures', 'seed-data.js'),
    seedDataFile({ stateMethod })
  );

  writeFile(
    path.join(targetDir, 'journeys', 'example-journey.spec.js'),
    journeyTemplate({ baseUrl, stateMethod, outputDir: normalizedOutputDir })
  );

  writeFile(
    path.join(targetDir, 'compositions', 'ExampleJourney.jsx'),
    compositionTemplate({ projectName })
  );

  writeFile(
    path.join(targetDir, 'scripts', 'generate-root.mjs'),
    generateRootTemplate()
  );

  writeFile(
    path.join(targetDir, 'Root.generated.jsx'),
    rootGeneratedPlaceholder()
  );

  writeFile(
    path.join(targetDir, 'manifest.json'),
    manifestFile({
      projectName,
      productId,
      baseUrl,
      primaryColor,
      fps,
      resolution,
    })
  );

  patchPackageJson();
  patchGitignore();

  const manifestPath = path.join(targetDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  validateManifest(manifest, targetDir);
}

export async function addUiScaffold() {
  const targetDir = path.join(process.cwd(), 'docs-automation');
  fs.mkdirSync(targetDir, { recursive: true });
  scaffoldUiAndServer(targetDir);
  patchPackageJson();
  patchGitignore();
}

function writeFile(filePath, content) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

function playwrightConfig({ baseUrl, outputDir, resolution }) {
  return `import { defineConfig } from '@playwright/test';
import { defaultSlowMo } from '@videodoc/core/playwright';

export default defineConfig({
  testDir: './journeys',
  use: {
    baseURL: '${baseUrl}',
    viewport: { width: ${resolution.width}, height: ${resolution.height} },
    video: 'on',
    launchOptions: {
      slowMo: defaultSlowMo,
    },
  },
  outputDir: '${outputDir}/raw-videos',
});
`;
}

function remotionConfig({ fps, resolution }) {
  return `import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

export const VIDEO_FPS = ${fps};
export const VIDEO_WIDTH = ${resolution.width};
export const VIDEO_HEIGHT = ${resolution.height};
`;
}

function themeFile({ primaryColor }) {
  return `import { mergeTheme } from '@videodoc/core/theme';

export const theme = mergeTheme({
  accent: '${primaryColor}',
  stepCardAccent: '${primaryColor}',
});
`;
}

function manifestFile({ projectName, baseUrl, primaryColor, fps, resolution }) {
  return JSON.stringify({
    version: 1,
    defaults: {
      composition: {
        fps,
        width: resolution.width,
        height: resolution.height,
      },
    },
    products: [
      {
        id: slugify(projectName) || 'default-product',
        name: projectName,
        baseURL: baseUrl,
        brand: {
          colors: {
            accent: primaryColor,
            stepCardAccent: primaryColor,
          },
          assets: {},
        },
      },
    ],
    flows: [
      {
        id: 'ExampleJourney',
        productId: slugify(projectName) || 'default-product',
        label: 'Example Journey',
        journeyFile: 'example-journey.spec.js',
        screenshotsDir: 'screenshots/example-journey',
        composition: {
          fps,
          width: resolution.width,
          height: resolution.height,
          durationInSeconds: 12,
          defaultProps: {
            appName: projectName,
          },
        },
      },
    ],
  }, null, 2);
}

function rootFile({ projectName, fps, resolution }) {
  return `import { Composition } from 'remotion';
import { ExampleJourney } from './compositions/ExampleJourney.jsx';
import { VIDEO_FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from './remotion.config.js';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="ExampleJourney"
        component={ExampleJourney}
        ${'{/* TODO: update durationInFrames to match your composition length */}'}
        durationInFrames={30 * VIDEO_FPS}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={{ appName: '${projectName}' }}
      />
    </>
  );
};
`;
}

function seedDataFile({ stateMethod }) {
  const apiNote = stateMethod === 'api'
    ? `  apiEndpoints: [
    { method: 'POST', url: '/api/seed', body: { reset: true } },
  ],` : '';

  return `export const seedData = {
  user: {
    name: 'Demo User',
    email: 'demo@example.com',
    password: 'demo1234',
  },
  items: [
    { id: '1', name: 'Example Item 1', createdAt: '2025-01-15T08:00:00Z' },
    { id: '2', name: 'Example Item 2', createdAt: '2025-01-16T09:30:00Z' },
  ],
${apiNote}
};
`;
}

function journeyTemplate({ baseUrl, stateMethod, outputDir }) {
  const stateSetup = stateMethod === 'localStorage'
    ? `  await setupLocalStorageState(page, seedData);
  await page.reload({ waitUntil: 'networkidle' });`
    : `  // Seed via API if configured`;

  return `import { test } from '@playwright/test';
import { capture, setupLocalStorageState } from '@videodoc/core/playwright';
import { seedData } from '../fixtures/seed-data.js';

const JOURNEY = 'example-journey';
const OUT = (name) => \`${outputDir}/screenshots/\${JOURNEY}/\${name}\`;

test('Journey: Example', async ({ page }) => {
  await page.goto('${baseUrl}');
${stateSetup}

  await page.waitForLoadState('networkidle');
  await capture(page, '01-home', OUT('01-home'));

  await page.getByTestId('your-button').click();
  await page.waitForSelector('[data-testid="your-result"]');
  await capture(page, '02-after-click', OUT('02-after-click'));
});
`;
}

function compositionTemplate({ projectName }) {
  return `import { AbsoluteFill, Sequence } from 'remotion';
import { staticFile } from 'remotion';
import { Intro, Outro, ScreenFrame, Caption, Highlight } from '@videodoc/core';
import { theme } from '../theme.js';

const ss = (name) => staticFile(\`screenshots/example-journey/\${name}.png\`);

export const ExampleJourney = ({ appName = '${projectName}' }) => (
  <AbsoluteFill style={{ background: theme.background }}>
    <Sequence from={0} durationInFrames={90}>
      <Intro appName={appName} title="How to Complete This Task" theme={theme} />
    </Sequence>

    <Sequence from={90} durationInFrames={90}>
      <ScreenFrame src={ss('01-home')} theme={theme} />
      <Caption text="This is the home screen." theme={theme} />
    </Sequence>

    <Sequence from={180} durationInFrames={90}>
      <ScreenFrame src={ss('02-after-click')} theme={theme} />
      <Highlight x={100} y={50} width={120} height={40} theme={theme} />
      <Caption text="Tap the button to perform the action." theme={theme} />
    </Sequence>

    <Sequence from={270} durationInFrames={90}>
      <Outro message="You're all set!" theme={theme} />
    </Sequence>
  </AbsoluteFill>
);
`;
}

function generateRootTemplate() {
  return `import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.join(__dirname, '..');
const manifestPath = path.join(docsDir, 'manifest.json');
const generatedRootPath = path.join(docsDir, 'Root.generated.jsx');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
const flows = manifest.flows ?? [];
const defaults = manifest.defaults?.composition ?? {};

const imports = flows
  .map((flow) => \`import { \${flow.id} } from './compositions/\${flow.id}.jsx';\`)
  .join('\\n');

const compositionBlocks = flows
  .map((flow) => {
    const comp = flow.composition ?? {};
    const fps = comp.fps ?? defaults.fps ?? 30;
    const width = comp.width ?? defaults.width ?? 1280;
    const height = comp.height ?? defaults.height ?? 720;
    const durationInSeconds = comp.durationInSeconds ?? 12;
    const durationInFrames = Math.round(durationInSeconds * fps);
    const defaultProps = JSON.stringify(comp.defaultProps ?? { appName: flow.label ?? flow.id });
    return \`      <Composition
        id="\${flow.id}"
        component={\${flow.id}}
        durationInFrames={\${durationInFrames}}
        fps={\${fps}}
        width={\${width}}
        height={\${height}}
        defaultProps={\${defaultProps}}
      />\`;
  })
  .join('\\n\\n');

const source = \`import { Composition, registerRoot } from 'remotion';
\${imports}

const RemotionRoot = () => {
  return (
    <>
\${compositionBlocks || '      {/* No flows found in manifest */}'}
    </>
  );
};

registerRoot(RemotionRoot);
\`;

fs.writeFileSync(generatedRootPath, source, 'utf-8');
console.log('Generated', generatedRootPath);
`;
}

function rootGeneratedPlaceholder() {
  return `import { registerRoot } from 'remotion';
const Placeholder = () => null;
registerRoot(Placeholder);
`;
}

function scaffoldUiAndServer(targetDir) {
  writeFile(path.join(targetDir, 'server', 'index.mjs'), serverTemplate());
  writeFile(path.join(targetDir, 'ui', 'package.json'), uiPackageJsonTemplate());
  writeFile(path.join(targetDir, 'ui', 'index.html'), uiIndexHtmlTemplate());
  writeFile(path.join(targetDir, 'ui', 'vite.config.js'), uiViteConfigTemplate());
  writeFile(path.join(targetDir, 'ui', 'src', 'main.jsx'), uiMainTemplate());
  writeFile(path.join(targetDir, 'ui', 'src', 'App.jsx'), uiAppTemplate());
}

function patchPackageJson() {
  const pkgPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(pkgPath)) return;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  pkg.scripts = pkg.scripts ?? {};
  pkg.devDependencies = pkg.devDependencies ?? {};

  const newScripts = {
    'docs:prerender': 'node docs-automation/scripts/generate-root.mjs',
    'docs:screenshots': 'npx playwright test --config=docs-automation/playwright.config.js',
    'docs:preview': 'npm run docs:prerender && npx remotion preview docs-automation/Root.generated.jsx',
    'docs:render': 'npm run docs:prerender && npx remotion render docs-automation/Root.generated.jsx ExampleJourney',
    'docs:generate': 'npm run docs:screenshots && npm run docs:render',
    'docs:server': 'node docs-automation/server/index.mjs',
    'docs:ui': 'npx vite docs-automation/ui --config docs-automation/ui/vite.config.js --host --port 5174',
  };

  Object.entries(newScripts).forEach(([key, val]) => {
    if (!pkg.scripts[key]) {
      pkg.scripts[key] = val;
    }
  });

  const suggestedDevDeps = {
    '@videodoc/core': '^0.1.0',
    '@playwright/test': '^1.40.0',
    'remotion': '^4.0.0',
    'react': '^18.2.0',
    'react-dom': '^18.2.0',
  };
  Object.entries(suggestedDevDeps).forEach(([dep, version]) => {
    if (!(dep in pkg.devDependencies)) {
      pkg.devDependencies[dep] = version;
    }
  });

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
}

function patchGitignore() {
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  const entries = [
    'docs-automation/Root.generated.jsx',
    'docs-output/',
    'docs-automation/assets/screenshots/',
  ];

  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, `${entries.join('\n')}\n`, 'utf-8');
    return;
  }

  const current = fs.readFileSync(gitignorePath, 'utf-8');
  const lines = current.split('\n');
  let changed = false;

  for (const entry of entries) {
    if (!lines.includes(entry)) {
      lines.push(entry);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(gitignorePath, `${lines.join('\n').replace(/\n+$/, '\n')}`, 'utf-8');
  }
}

function serverTemplate() {
  return `import http from 'http';

const port = Number(process.env.DOCS_SERVER_PORT ?? 3333);
const server = http.createServer((_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, message: 'Scaffolded docs server placeholder' }));
});

server.listen(port, () => {
  console.log(\`Docs server placeholder em http://localhost:\${port}\`);
});
`;
}

function uiPackageJsonTemplate() {
  return JSON.stringify(
    {
      name: 'videodoc-ui',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite --host --port 5174',
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
      },
      devDependencies: {
        vite: '^7.1.11',
      },
    },
    null,
    2
  );
}

function uiIndexHtmlTemplate() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Videodoc UI</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
}

function uiViteConfigTemplate() {
  return `import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3333',
    },
  },
});
`;
}

function uiMainTemplate() {
  return `import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
`;
}

function uiAppTemplate() {
  return `import React from 'react';

export function App() {
  return (
    <main style={{ fontFamily: 'Inter, Arial, sans-serif', padding: 24 }}>
      <h1>Videodoc UI placeholder</h1>
      <p>Este projeto foi scaffoldado com suporte para docs:ui/docs:server.</p>
    </main>
  );
}
`;
}

export function validateManifest(manifest, docsAutomationDir) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('manifest.json inválido: conteúdo ausente ou não-objeto.');
  }

  const products = manifest.products ?? [];
  const flows = manifest.flows ?? [];

  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('manifest.json inválido: "products" deve ter ao menos 1 item.');
  }

  if (!Array.isArray(flows) || flows.length === 0) {
    throw new Error('manifest.json inválido: "flows" deve ter ao menos 1 item.');
  }

  const productIds = new Set(products.map((p) => p.id));
  const seenFlowIds = new Set();

  for (const flow of flows) {
    if (!flow.id) throw new Error('manifest.json inválido: flow sem "id".');
    if (seenFlowIds.has(flow.id)) {
      throw new Error(`manifest.json inválido: flow.id duplicado: ${flow.id}`);
    }
    seenFlowIds.add(flow.id);

    if (!productIds.has(flow.productId)) {
      throw new Error(
        `manifest.json inválido: flow "${flow.id}" referencia productId inexistente "${flow.productId}".`
      );
    }

    const journeyPath = path.join(docsAutomationDir, 'journeys', flow.journeyFile ?? '');
    if (!flow.journeyFile || !fs.existsSync(journeyPath)) {
      throw new Error(
        `manifest.json inválido: journeyFile não encontrado para flow "${flow.id}": ${flow.journeyFile}`
      );
    }

    const compositionPath = path.join(docsAutomationDir, 'compositions', `${flow.id}.jsx`);
    if (!fs.existsSync(compositionPath)) {
      throw new Error(
        `manifest.json inválido: composition não encontrada para flow "${flow.id}": ${flow.id}.jsx`
      );
    }
  }
}

function normalizeOutputDir(outputDir) {
  return outputDir.replace(/^\.?\//, '');
}

function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
