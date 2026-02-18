import path from 'path';
import fs from 'fs';

export const defaultSlowMo = 600;

export async function capture(page, name, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: false, animations: 'disabled' });
}

/**
 * Grava uma sequência de interações como um clipe de vídeo nomeado.
 * Cria uma nova página no contexto (herdando as configurações de vídeo),
 * executa `fn(page)` e fecha a página para finalizar a gravação.
 *
 * @param {import('@playwright/test').BrowserContext} context
 * @param {string} name - Nome do clipe (sem extensão)
 * @param {string} outputDir - Diretório de saída
 * @param {(page: import('@playwright/test').Page) => Promise<void>} fn
 */
export async function recordClip(context, name, outputDir, fn) {
  const page = await context.newPage();
  try {
    await fn(page);
  } finally {
    await page.close();
    const video = page.video();
    if (video) {
      fs.mkdirSync(outputDir, { recursive: true });
      await video.saveAs(path.join(outputDir, `${name}.webm`));
    }
  }
}

/**
 * Salva o vídeo gravado de uma página em um local nomeado.
 * Deve ser chamada APÓS o fechamento da página.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} name - Nome do arquivo (sem extensão)
 * @param {string} outputDir - Diretório de saída
 * @returns {Promise<string|null>} Caminho do arquivo salvo, ou null se sem vídeo
 */
export async function saveVideo(page, name, outputDir) {
  const video = page.video();
  if (!video) return null;
  fs.mkdirSync(outputDir, { recursive: true });
  const dest = path.join(outputDir, `${name}.webm`);
  await video.saveAs(dest);
  return dest;
}

export async function captureFullPage(page, name, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: true, animations: 'disabled' });
}

export async function waitAndCapture(page, selector, name, outputDir) {
  await page.waitForSelector(selector, { state: 'visible' });
  await capture(page, name, outputDir);
}

export async function hoverAndCapture(page, selector, name, outputDir) {
  await page.hover(selector);
  await new Promise((r) => setTimeout(r, 300));
  await capture(page, name, outputDir);
}

export async function setupLocalStorageState(page, data) {
  await page.evaluate((d) => {
    Object.entries(d).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
  }, data);
}

export async function setupApiState(request, endpoints) {
  for (const { method, url, body } of endpoints) {
    await request[method.toLowerCase()](url, body ? { data: body } : undefined);
  }
}

export async function resetToFreshState(page, baseUrl) {
  await page.goto(baseUrl);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
}
