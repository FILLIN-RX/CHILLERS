import { test, expect } from '@playwright/test';
import { pickRandomUploadedFilm } from './helpers/film-picker';
import { pickRandomSerie } from './helpers/series-picker';

test.describe('Streaming + Download', () => {
  test('Movie: stream loads and download popup opens', async ({ page }, testInfo) => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const { title, tmdbId } = pickRandomUploadedFilm();
      console.log(`Attempt ${attempt}/5: "${title}" (tmdbId: ${tmdbId})`);

      try {
        await page.goto(`/media/${tmdbId}?type=movie`, { waitUntil: 'networkidle' });
        await page.waitForURL(/\/media\//, { timeout: 15_000 });

        await expect(page.getByRole('heading', { name: title, exact: true }).first()).toBeVisible({ timeout: 20_000 });

        const videoEl = page.locator('video[src]');
        await expect(videoEl.first()).toBeVisible({ timeout: 30_000 });
        const videoSrc = await videoEl.first().getAttribute('src');
        expect(videoSrc).toBeTruthy();
        console.log(`  ✓ Stream: ${videoSrc?.substring(0, 70)}…`);

        const downloadBtn = page.locator('button').filter({ hasText: /Download|Télécharger/ }).first();
        await expect(downloadBtn).toBeVisible({ timeout: 10_000 });
        await expect(downloadBtn).toBeEnabled({ timeout: 5_000 });

        const popupPromise = page.waitForEvent('popup', { timeout: 30_000 });
        await downloadBtn.click();
        const popup = await popupPromise;
        await popup.waitForLoadState('domcontentloaded');

        const popupUrl = popup.url();
        expect(popupUrl).toMatch(/vidzy\.cc|doodstream|uqload|\.mp4/i);
        console.log(`  ✓ Download: ${popupUrl.substring(0, 80)}…`);
        await popup.close();

        await page.screenshot({ path: `e2e-movie-ok-${testInfo.project.name}.png`, fullPage: true });
        console.log(`✓ OK: "${title}" — stream + download verified`);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`✗ ${message}`);
        if (attempt === 5) {
          await page.screenshot({ path: `e2e-movie-fail-${testInfo.project.name}.png`, fullPage: true });
          throw err;
        }
      }
    }
  });

  test('TV Series: episode stream loads on season page', async ({ page }, testInfo) => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      let serie: { titre: string; tmdbId: number; episode: { season: number; episodeNumber: number; lien: string } };
      try {
        serie = await pickRandomSerie();
      } catch (err) {
        console.log(`✗ DB error: ${err instanceof Error ? err.message : String(err)}`);
        if (attempt === 5) throw err;
        continue;
      }

      const { titre, tmdbId, episode } = serie;
      const url = `/tv/${tmdbId}/season/${episode.season}`;
      console.log(`Attempt ${attempt}/5: "${titre}" → ${url}`);

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForURL(/\/tv\/.*\/season\//, { timeout: 15_000 });

        await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });

        const videoEl = page.locator('video[src]');
        await expect(videoEl.first()).toBeVisible({ timeout: 30_000 });
        const videoSrc = await videoEl.first().getAttribute('src');
        expect(videoSrc).toBeTruthy();
        console.log(`  ✓ Stream: ${videoSrc?.substring(0, 70)}…`);

        const downloadBtn = page.locator('button').filter({ hasText: /Télécharger|Download/ }).first();
        await expect(downloadBtn).toBeVisible({ timeout: 10_000 });
        await expect(downloadBtn).toBeEnabled({ timeout: 5_000 });
        console.log(`  ✓ Download button ready`);

        await page.screenshot({ path: `e2e-serie-ok-${testInfo.project.name}.png`, fullPage: true });
        console.log(`✓ OK: "${titre}" — stream verified`);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`✗ ${message}`);
        if (attempt === 5) {
          await page.screenshot({ path: `e2e-serie-fail-${testInfo.project.name}.png`, fullPage: true });
          throw err;
        }
      }
    }
  });
});
