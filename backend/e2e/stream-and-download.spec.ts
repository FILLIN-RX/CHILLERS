import { test, expect, Page } from '@playwright/test';
import { pickRandomUploadedFilm } from './helpers/film-picker';

async function runStreamAndDownloadFlow(page: Page, title: string, tmdbId: number) {
  await page.goto(`/media/${tmdbId}?type=movie`, { waitUntil: 'networkidle' });
  await page.waitForURL(/\/media\//, { timeout: 15_000 });

  const pageTitle = page.getByRole('heading', { name: title, exact: true }).first();
  await expect(pageTitle).toBeVisible({ timeout: 20_000 });

  const videoEl = page.locator('video[src]');
  await expect(videoEl.first()).toBeVisible({ timeout: 30_000 });
  const videoSrc = await videoEl.first().getAttribute('src');
  expect(videoSrc).toBeTruthy();
  console.log(`  ✓ Stream: ${title} — ${videoSrc?.substring(0, 70)}…`);

  const downloadBtn = page.locator('button').filter({ hasText: 'Download' }).first();
  await expect(downloadBtn).toBeVisible({ timeout: 10_000 });
  await expect(downloadBtn).toBeEnabled({ timeout: 5_000 });
  console.log(`  ✓ Download button ready`);
}

test.describe('Stream + Download flow', () => {
  test('movie page: stream plays and download triggers', async ({ page }, testInfo) => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const { title, tmdbId } = pickRandomUploadedFilm();
      console.log(`Attempt ${attempt}/5: "${title}" (tmdbId: ${tmdbId})`);

      try {
        await runStreamAndDownloadFlow(page, title, tmdbId);
        await page.screenshot({ path: `e2e-success-${testInfo.project.name}.png`, fullPage: true });
        console.log(`\n✓ OK: "${title}" — stream + download verified`);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`✗ ${message}`);
        if (attempt === 5) {
          await page.screenshot({ path: `e2e-failure-${testInfo.project.name}.png`, fullPage: true });
          throw err;
        }
      }
    }
  });
});
