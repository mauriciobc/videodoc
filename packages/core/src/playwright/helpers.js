import path from 'path';
import fs from 'fs';

export const defaultSlowMo = 600;

export async function capture(page, name, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: false, animations: 'disabled' });
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
