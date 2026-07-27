import { test, expect, Page } from '@playwright/test';

const AD_KEYWORDS = [
  'doubleclick.net', 'googleadservices', 'googlesyndication', 'adservice',
  'adserver', 'pagead', 'advertisement', 'advert',
  'popup', 'affiliate', 'adblock',
  'amazon-adsystem', 'casalemedia', 'contextweb', 'pubmatic',
  'rubiconproject', 'sharethrough', 'taboola', 'outbrain',
];

async function blockAds(page: Page) {
  await page.route('**/*', (route) => {
    const url = route.request().url().toLowerCase();
    for (const ad of AD_KEYWORDS) {
      if (url.includes(ad)) { route.abort(); return; }
    }
    route.continue();
  });
}

async function goToWatchPage(page: Page): Promise<string> {
  // Essaie d'abord via la page d'accueil : survoler une carte, cliquer play
  console.log('↦ Navigation vers /');
  await page.goto('/');
  await page.waitForSelector('[class*="cursor-pointer"]', { timeout: 25000 });
  await page.waitForTimeout(2000);

  const card = page.locator('[data-testid="movie-card"]').first();
  await expect(card).toBeVisible({ timeout: 25000 });
  console.log('↦ Carte film trouvée, survol...');

  // Révèle l'overlay au hover
  await card.hover({ force: true });
  await page.waitForTimeout(500);

  // Clic sur le bouton play (aria-label="Regarder")
  const playBtn = card.locator('button[aria-label="Regarder"], button[aria-label*="Watch"]').first();
  const isVisible = await playBtn.isVisible();
  if (isVisible) {
    console.log('↦ Clic bouton play');
    await playBtn.click();
  } else {
    // Fallback: clic direct sur la carte → va vers la page détail
    console.log('↦ Bouton play invisible, clic direct sur la carte');
    await card.click();
    await page.waitForTimeout(3000);
    // puis navigation vers /watch
    const url = page.url();
    const match = url.match(/\/media\/(\d+)/);
    if (match) {
      const id = match[1];
      console.log(`↦ Navigation directe vers /watch/${id}?type=movie`);
      await page.goto(`/watch/${id}?type=movie`);
    }
  }

  await page.waitForTimeout(5000);
  console.log(`↦ URL actuelle: ${page.url().slice(0, 100)}`);
  return page.url();
}

test.describe('Streaming sans pub', () => {

  test('lecteur ne contient pas d iframe pub', async ({ page }) => {
    await blockAds(page);
    page.on('response', r => { if (r.status() >= 400) console.log(`  ⚠ ${r.status()} ${r.url().slice(0, 100)}`); });

    const url = await goToWatchPage(page);
    console.log(`[1/3] Sur ${url.slice(0, 80)}`);

    const iframes = page.locator('iframe');
    const count = await iframes.count();
    console.log(`[1/3] ${count} iframe(s) trouvé(s).`);
    let hasAd = false;
    for (let i = 0; i < count; i++) {
      const src = await iframes.nth(i).getAttribute('src');
      if (src) {
        const lower = src.toLowerCase();
        console.log(`  iframe #${i}: ${src.slice(0, 120)}`);
        for (const ad of AD_KEYWORDS) {
          if (lower.includes(ad)) {
            console.log(`  ❌ Pub détectée: ${ad}`);
            hasAd = true;
          }
        }
      }
    }
    expect(hasAd).toBe(false);
    console.log('[1/3] ✅ Aucune iframe pub');
  });

  test('flux hls sans segments pub', async ({ page }) => {
    const streamUrls: string[] = [];

    await page.route('**/stream**', (route) => {
      streamUrls.push(route.request().url());
      route.continue();
    });

    const url = await goToWatchPage(page);
    console.log(`[2/3] ${streamUrls.length} appel(s) API stream intercepté(s).`);
    let hasAd = false;
    for (const u of streamUrls) {
      const lower = u.toLowerCase();
      console.log(`  Flux: ${u.slice(0, 120)}`);
      for (const ad of AD_KEYWORDS) {
        if (lower.includes(ad)) {
          console.log(`  ❌ Pub dans flux: ${ad}`);
          hasAd = true;
        }
      }
    }
    expect(hasAd).toBe(false);
    console.log('[2/3] ✅ Flux HLS sans pub');
  });

  test('API stream ne retourne pas d embed pub', async ({ page }) => {
    const responses: any[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/stream') || url.includes('/nexstream/')) {
        try {
          const body = await response.json();
          responses.push({ url, body });
          console.log(`  Réponse API: ${url.slice(0, 100)}`);
        } catch {}
      }
    });

    const url = await goToWatchPage(page);
    await page.waitForTimeout(3000);

    console.log(`[3/3] ${responses.length} réponse(s) API analysée(s).`);
    let hasAd = false;
    for (const { url: u, body } of responses) {
      if (body?.data?.embedUrl) {
        const lower = body.data.embedUrl.toLowerCase();
        console.log(`  embedUrl: ${body.data.embedUrl.slice(0, 120)}`);
        for (const ad of AD_KEYWORDS) {
          if (lower.includes(ad)) {
            console.log(`  ❌ Pub dans embedUrl: ${ad}`);
            hasAd = true;
          }
        }
      }
    }
    expect(hasAd).toBe(false);
    console.log('[3/3] ✅ API stream sans pub');
  });

});
