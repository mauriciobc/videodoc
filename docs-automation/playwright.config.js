import { defineConfig } from '@playwright/test';
import { defaultSlowMo } from '@videodoc/core/playwright';

export default defineConfig({
  testDir: './journeys',
  use: {
    baseURL: 'https://mealtime.app.br/',
    viewport: { width: 1280, height: 720 },
    video: 'on',
    launchOptions: {
      slowMo: defaultSlowMo,
    },
  },
  outputDir: '../docs-output/raw-videos',
});
