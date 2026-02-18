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

  const dirs = [
    targetDir,
    path.join(targetDir, 'journeys'),
    path.join(targetDir, 'compositions'),
    path.join(targetDir, 'fixtures'),
    path.join(targetDir, 'assets', 'screenshots'),
    path.join(targetDir, 'assets', 'brand'),
  ];
  dirs.forEach((d) => fs.mkdirSync(d, { recursive: true }));
  writeFile(path.join(targetDir, 'assets', 'brand', '.gitkeep'), '');

  writeFile(
    path.join(targetDir, 'playwright.config.js'),
    playwrightConfig({ baseUrl, outputDir, resolution })
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
    journeyTemplate({ baseUrl, stateMethod, outputDir })
  );

  writeFile(
    path.join(targetDir, 'compositions', 'ExampleJourney.jsx'),
    compositionTemplate({ projectName, outputDir })
  );

  writeFile(
    path.join(targetDir, 'manifest.json'),
    manifestFile({ projectName, baseUrl, primaryColor, fps, resolution })
  );

  patchPackageJson({ outputDir });
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
  return JSON.stringify(
    { projectName, baseUrl, primaryColor, fps, resolution },
    null,
    2
  );
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

function compositionTemplate({ projectName, outputDir }) {
  return `import { AbsoluteFill, Sequence } from 'remotion';
import { Intro, Outro, ScreenFrame, Caption, Highlight } from '@videodoc/core';
import { theme } from '../theme.js';

const SCREENSHOTS = '${outputDir}/screenshots/example-journey';

export const ExampleJourney = ({ appName = '${projectName}' }) => (
  <AbsoluteFill style={{ background: theme.background }}>
    <Sequence from={0} durationInFrames={90}>
      <Intro appName={appName} title="How to Complete This Task" theme={theme} />
    </Sequence>

    <Sequence from={90} durationInFrames={90}>
      <ScreenFrame src={\`\${SCREENSHOTS}/01-home.png\`} theme={theme} />
      <Caption text="This is the home screen." theme={theme} />
    </Sequence>

    <Sequence from={180} durationInFrames={90}>
      <ScreenFrame src={\`\${SCREENSHOTS}/02-after-click.png\`} theme={theme} />
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

function patchPackageJson({ outputDir }) {
  const pkgPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(pkgPath)) return;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  pkg.scripts = pkg.scripts ?? {};
  pkg.devDependencies = pkg.devDependencies ?? {};

  const newScripts = {
    'docs:screenshots': 'playwright test docs-automation/journeys/',
    'docs:preview':     'remotion preview docs-automation/Root.jsx',
    'docs:render':      'remotion render docs-automation/Root.jsx ExampleJourney',
    'docs:generate':    'npm run docs:screenshots && npm run docs:render',
    'docs:render:one':  'remotion render docs-automation/Root.jsx ExampleJourney',
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
