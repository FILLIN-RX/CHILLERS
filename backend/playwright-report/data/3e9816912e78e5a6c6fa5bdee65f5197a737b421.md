# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stream-and-download.spec.ts >> Streaming + Download >> Movie: stream loads and download popup opens
- Location: e2e/stream-and-download.spec.ts:6:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('video[src]').first()
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 30000ms
  - waiting for locator('video[src]').first()

```

```yaml
- banner:
  - link "Chillers Logo":
    - /url: /
    - img "Chillers Logo"
  - navigation:
    - link "Home":
      - /url: /
    - link "Movies":
      - /url: /media/movies
    - link "Series":
      - /url: /media/series
    - link "Anime":
      - /url: /media/anime
    - link "Categories":
      - /url: /categories
  - button "Search"
  - button "en":
    - text: en
    - img
- main:
  - button "Back"
  - img "Agent Stone"
  - img "Agent Stone"
  - text: Action Crime Thriller
  - heading "Agent Stone" [level=1]
  - text: 6.7 /10 2023 2h 2m movie
  - paragraph: Rachel Stone est agent de renseignement au sein d'une équipe du MI6, mais il s'agit d'une couverture. Elle travaille en fait pour une organisation paraétatique de maintien de la paix qui utilise une puissante intelligence artificielle, le Heart. Alors qu'elle désobéit aux ordres pour sauver son équipe, elle révèle son identité et sert de cheval de Troie pour compromettre le système. Mise à pied, elle décide de partir à la recherche de la mystérieuse commanditaire et de son acolyte.
  - button "Watch"
  - button "Trailer"
  - button "Download"
  - button "Share"
  - heading "Synopsis" [level=2]
  - paragraph: Rachel Stone est agent de renseignement au sein d'une équipe du MI6, mais il s'agit d'une couverture. Elle travaille en fait pour une organisation paraétatique de maintien de la paix qui utilise une puissante intelligence artificielle, le Heart. Alors qu'elle désobéit aux ordres pour sauver son équipe, elle révèle son identité et sert de cheval de Troie pour compromettre le système. Mise à pied, elle décide de partir à la recherche de la mystérieuse commanditaire et de son acolyte.
  - heading "Cast" [level=2]
  - text: Gal Gadot Jamie Dornan Alia Bhatt Sophie Okonedo Matthias Schweighöfer
  - heading "Watch" [level=2]
  - iframe
  - heading "You Might Also Like" [level=2]
  - img "L'Odyssée"
  - heading "L'Odyssée" [level=3]
  - text: 2026 • 7.7
  - img "Obsession"
  - heading "Obsession" [level=3]
  - text: 2026 • 8.3
  - img "Backrooms"
  - heading "Backrooms" [level=3]
  - text: 2026 • 7
  - img "Disclosure Day"
  - heading "Disclosure Day" [level=3]
  - text: 2026 • 6.7
  - img "Vaiana, la légende du bout du monde"
  - heading "Vaiana, la légende du bout du monde" [level=3]
  - text: 2026 • 5.8
  - img "Scary Movie"
  - heading "Scary Movie" [level=3]
  - text: 2026 • 5.4
  - img "Toy Story 5"
  - heading "Toy Story 5" [level=3]
  - text: 2026 • 7.4
  - img "Des Minions et des monstres"
  - heading "Des Minions et des monstres" [level=3]
  - text: 2026 • 6.4
- contentinfo:
  - heading "CHILLERS" [level=3]
  - paragraph: L'expérience ultime du streaming gratuit. Films, séries, anime — accès instantané, zéro pub.
  - paragraph: Chillers ne stocke aucun fichier. Tout contenu est hébergé par des tiers non affiliés. À des fins éducatives uniquement.
  - heading "Liens" [level=4]
  - list:
    - listitem:
      - link "À Propos":
        - /url: /about
    - listitem:
      - link "Contact":
        - /url: /contact
    - listitem:
      - link "Soutenir":
        - /url: /support
    - listitem:
      - link "Politique de confidentialité":
        - /url: /privacy
  - heading "Categories" [level=4]
  - list:
    - listitem:
      - link "Action & Adventure":
        - /url: "#"
    - listitem:
      - link "Sci-Fi & Cyberpunk":
        - /url: "#"
    - listitem:
      - link "Anime Blockbusters":
        - /url: "#"
    - listitem:
      - link "Cultural Documentaries":
        - /url: "#"
  - heading "Soutenir" [level=4]
  - paragraph: Le projet vit grâce à vos dons. Orange Money & Mobile Money acceptés.
  - link "Nous soutenir":
    - /url: /support
  - heading "Join the Chill" [level=4]
  - paragraph: Follow us on social channels to keep up with premier releases.
  - link "𝕏":
    - /url: "#"
  - link "f":
    - /url: "#"
  - link:
    - /url: "#"
  - link "▶":
    - /url: "#"
  - text: © 2026 Chillers. No rights reserved.
  - link "À Propos":
    - /url: /about
  - text: •
  - link "Contact":
    - /url: /contact
  - text: •
  - link "Confidentialité":
    - /url: /privacy
- alert
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { pickRandomUploadedFilm } from './helpers/film-picker';
  3   | import { pickRandomSerie } from './helpers/series-picker';
  4   | 
  5   | test.describe('Streaming + Download', () => {
  6   |   test('Movie: stream loads and download popup opens', async ({ page }, testInfo) => {
  7   |     test.setTimeout(180_000);
  8   |     for (let attempt = 1; attempt <= 3; attempt++) {
  9   |       const { title, tmdbId } = pickRandomUploadedFilm();
  10  |       console.log(`Attempt ${attempt}/3: "${title}" (tmdbId: ${tmdbId})`);
  11  | 
  12  |       try {
  13  |         await page.goto(`/media/${tmdbId}?type=movie`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  14  |         await page.waitForURL(/\/media\//, { timeout: 15_000 });
  15  | 
  16  |         await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });
  17  | 
  18  |         const videoEl = page.locator('video[src]');
> 19  |         await expect(videoEl.first()).toBeVisible({ timeout: 30_000 });
      |                                       ^ Error: expect(locator).toBeVisible() failed
  20  |         const videoSrc = await videoEl.first().getAttribute('src');
  21  |         expect(videoSrc).toBeTruthy();
  22  |         console.log(`  ✓ Stream src: ${videoSrc?.substring(0, 70)}…`);
  23  | 
  24  |         // Vérifie que la vidéo est montée sans erreur
  25  |         const videoError = await page.evaluate(() => {
  26  |           const v = document.querySelector('video');
  27  |           return v ? (v.error?.message || null) : 'no video';
  28  |         });
  29  |         expect(videoError).toBeNull();
  30  |         console.log(`  ✓ Video mounted (no error)`);
  31  | 
  32  |         const downloadBtn = page.locator('button').filter({ hasText: /Download|Télécharger/ }).first();
  33  |         await expect(downloadBtn).toBeVisible({ timeout: 10_000 });
  34  |         await expect(downloadBtn).toBeEnabled({ timeout: 5_000 });
  35  | 
  36  |         // Capture the download URL via window.open interception
  37  |         await page.evaluate(() => {
  38  |           (window as any).__lastDownloadUrl = '';
  39  |           const orig = window.open;
  40  |           window.open = (url: any, target?: any) => {
  41  |             (window as any).__lastDownloadUrl = url || '';
  42  |             window.open = orig;
  43  |             return orig ? orig.call(window, url, target) : null;
  44  |           };
  45  |         });
  46  | 
  47  |         await downloadBtn.click();
  48  |         await page.waitForTimeout(3_000);
  49  | 
  50  |         const downloadUrl = await page.evaluate(() => (window as any).__lastDownloadUrl || '');
  51  |         expect(downloadUrl).toMatch(/vidzy\.cc|doodstream|uqload|\.mp4|download/i);
  52  |         console.log(`  ✓ Download: ${downloadUrl.substring(0, 80)}…`);
  53  | 
  54  |         await page.screenshot({ path: `e2e-movie-ok-${testInfo.project.name}.png`, fullPage: true });
  55  |         console.log(`✓ OK: "${title}" — stream + download verified`);
  56  |         return;
  57  |       } catch (err) {
  58  |         const message = err instanceof Error ? err.message : String(err);
  59  |         console.log(`✗ ${message}`);
  60  |         if (attempt === 3) {
  61  |           await page.screenshot({ path: `e2e-movie-fail-${testInfo.project.name}.png`, fullPage: true });
  62  |           throw err;
  63  |         }
  64  |       }
  65  |     }
  66  |   });
  67  | 
  68  |   test('TV Series: episode stream loads on season page', async ({ page }, testInfo) => {
  69  |     test.setTimeout(180_000);
  70  |     for (let attempt = 1; attempt <= 3; attempt++) {
  71  |       let serie: { titre: string; tmdbId: number; episode: { season: number; episodeNumber: number; lien: string } };
  72  |       try {
  73  |         serie = await pickRandomSerie();
  74  |       } catch (err) {
  75  |         console.log(`✗ DB error: ${err instanceof Error ? err.message : String(err)}`);
  76  |         if (attempt === 3) throw err;
  77  |         continue;
  78  |       }
  79  | 
  80  |       const { titre, tmdbId, episode } = serie;
  81  |       const url = `/tv/${tmdbId}/season/${episode.season}`;
  82  |       console.log(`Attempt ${attempt}/3: "${titre}" → ${url}`);
  83  | 
  84  |       try {
  85  |         await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  86  |         await page.waitForURL(/\/tv\/.*\/season\//, { timeout: 15_000 });
  87  | 
  88  |         await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });
  89  | 
  90  |         const videoEl = page.locator('video[src]');
  91  |         await expect(videoEl.first()).toBeVisible({ timeout: 30_000 });
  92  |         const videoSrc = await videoEl.first().getAttribute('src');
  93  |         expect(videoSrc).toBeTruthy();
  94  |         console.log(`  ✓ Stream src: ${videoSrc?.substring(0, 70)}…`);
  95  | 
  96  |         const videoError = await page.evaluate(() => {
  97  |           const v = document.querySelector('video');
  98  |           return v ? (v.error?.message || null) : 'no video';
  99  |         });
  100 |         expect(videoError).toBeNull();
  101 |         console.log(`  ✓ Video mounted (no error)`);
  102 | 
  103 |         const downloadBtn = page.locator('button').filter({ hasText: /Télécharger|Download/ }).first();
  104 |         await expect(downloadBtn).toBeVisible({ timeout: 10_000 });
  105 |         await expect(downloadBtn).toBeEnabled({ timeout: 5_000 });
  106 | 
  107 |         await page.evaluate(() => {
  108 |           (window as any).__lastDownloadUrl = '';
  109 |           const orig = window.open;
  110 |           window.open = (url: any, target?: any) => {
  111 |             (window as any).__lastDownloadUrl = url || '';
  112 |             window.open = orig;
  113 |             return orig ? orig.call(window, url, target) : null;
  114 |           };
  115 |         });
  116 | 
  117 |         await downloadBtn.click();
  118 |         await page.waitForTimeout(3_000);
  119 | 
```