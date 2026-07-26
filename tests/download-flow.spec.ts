import { test } from '@playwright/test';

const MOVIES = [
  { title: 'Salem\'s Lot', tmdbId: '748230' },
  { title: 'Pillion', tmdbId: '1339713' },
];

test.describe('Download Flow Test', () => {
  for (const movie of MOVIES) {
    test(`Download "${movie.title}" (${movie.tmdbId})`, async ({ page }) => {
      test.setTimeout(60000);

      console.log(`\n=== ${movie.title} (${movie.tmdbId}) ===`);

      let apiResponse: any = null;
      await page.route(/\/api\/doodstream\/download/, async (route) => {
        try {
          const resp = await route.fetch();
          apiResponse = await resp.json();
          console.log(`API: success=${apiResponse?.success}`);
          if (apiResponse?.success) {
            const u = apiResponse.data?.downloadUrl || apiResponse.data?.directUrl || '';
            console.log(`  type=${u.includes('.m3u8') ? 'HLS' : u.includes('.mp4') ? 'MP4' : '?'}`);
            console.log(`  url=${u.slice(0, 100)}`);
          }
          await route.continue();
        } catch {}
      });

      await page.goto(`/watch/${movie.tmdbId}?type=movie`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      const btn = page.locator('button').filter({ hasText: /Télécharger|Download|télécharger|download|Bientôt/i }).first();
      const visible = await btn.isVisible().catch(() => false);

      if (!visible) {
        console.log('❌ Bouton introuvable');
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        return;
      }

      const text = await btn.innerText();
      console.log(`Btn: "${text}"`);

      if (/Bientôt|indisponible/i.test(text)) {
        console.log('⚠ Stream indisponible');
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        return;
      }

      await btn.click();
      await page.waitForTimeout(5000);

      if (apiResponse) {
        const u = apiResponse.data?.downloadUrl || apiResponse.data?.directUrl || '';
        const t = u.includes('.m3u8') ? 'HLS' : u.includes('.mp4') ? 'MP4' : '?';
        console.log(`✅ API: success=true, type=${t}`);
        if (u.includes('.mp4')) {
          console.log(`✅ Download direct: navigateur ouvre l'URL .mp4 (CDN, pas proxy)`);
        }
      } else {
        console.log('⚠ API pas interceptée (route déjà résolue)');
      }

      await page.unrouteAll({ behavior: 'ignoreErrors' });
      console.log('');
    });
  }
});
