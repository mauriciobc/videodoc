import { test } from '@playwright/test';
import { capture, recordClip } from '@videodoc/core/playwright';
import { seedData } from '../fixtures/seed-data.js';

const SCREENSHOTS_DIR = 'docs-output/screenshots/auth-flow';
const CLIPS_DIR = 'docs-output/clips/auth-flow';

test('Journey: Login no Mealtime', async ({ page, context }) => {
  // Screenshot: página inicial
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await capture(page, '01-landing', SCREENSHOTS_DIR);

  // Screenshot: tela de login
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await capture(page, '02-login-screen', SCREENSHOTS_DIR);

  // Clipe: preenchimento do formulário — captura toda a interação como vídeo
  await recordClip(context, '03-form-filled', CLIPS_DIR, async (clipPage) => {
    await clipPage.goto('/login');
    await clipPage.waitForLoadState('networkidle');

    const emailInput = clipPage.getByLabel(/e-?mail/i).or(clipPage.getByPlaceholder(/e-?mail|email/i)).first();
    const passwordInput = clipPage.getByLabel(/senha/i).or(clipPage.getByPlaceholder(/senha|password/i)).first();
    await emailInput.fill(seedData.user.email);
    await passwordInput.fill(seedData.user.password);
  });
});
