import { test as base } from '@playwright/test';
import { setupLocalStorageState, setupApiState } from './helpers.js';

export function createFixture(seedData) {
  return {
    data: seedData,
    extend({ stateMethod = 'localStorage', baseUrl = '/' } = {}) {
      return base.extend({
        outputDir: async (_deps, use) => {
          await use(process.env.VIDEODOC_OUTPUT_DIR || './docs-output/screenshots');
        },
        page: async ({ page, request }, use) => {
          await page.goto(baseUrl);
          if (stateMethod === 'localStorage') {
            await setupLocalStorageState(page, seedData);
            await page.reload({ waitUntil: 'networkidle' });
          } else if (stateMethod === 'api' && seedData.apiEndpoints) {
            await setupApiState(request, seedData.apiEndpoints);
          }
          await use(page);
        },
      });
    },
  };
}
