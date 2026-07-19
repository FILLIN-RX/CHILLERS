# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stream-and-download.spec.ts >> Streaming + Download >> Movie: stream loads and download popup opens
- Location: e2e/stream-and-download.spec.ts:6:7

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - link "Chillers Logo" [ref=e5] [cursor=pointer]:
          - /url: /
          - img "Chillers Logo" [ref=e6]
        - navigation [ref=e7]:
          - link "Home" [ref=e8] [cursor=pointer]:
            - /url: /
            - text: Home
          - link "Movies" [ref=e10] [cursor=pointer]:
            - /url: /media/movies
          - link "Series" [ref=e11] [cursor=pointer]:
            - /url: /media/series
          - link "Anime" [ref=e12] [cursor=pointer]:
            - /url: /media/anime
          - link "Categories" [ref=e13] [cursor=pointer]:
            - /url: /categories
      - generic [ref=e14]:
        - button "Search" [ref=e15]:
          - img [ref=e16]
        - button "en" [ref=e19]:
          - text: en
          - img [ref=e20]
  - main [ref=e22]:
    - generic [ref=e23]:
      - button "Back" [ref=e25]:
        - img [ref=e26]
      - generic [ref=e28]:
        - img "Seule la tendresse" [ref=e29]
        - generic [ref=e33]:
          - generic [ref=e34]:
            - img "Seule la tendresse"
          - generic [ref=e35]:
            - generic [ref=e37]: Movie
            - heading "Seule la tendresse" [level=1] [ref=e38]
            - generic [ref=e39]:
              - generic [ref=e40]:
                - img [ref=e41]
                - generic [ref=e43]: "7"
                - generic [ref=e44]: /10
              - generic [ref=e45]:
                - img [ref=e46]
                - text: "2026"
              - generic [ref=e49]:
                - img [ref=e50]
                - text: 0h 50m
              - generic [ref=e52]: movie
            - paragraph [ref=e53]: Gaëllle tente d'exister au millieu d'un hiver qui n'en fini pas, d'un boulot physique, d'amis électroniques et d'un père diminué.
            - generic [ref=e54]:
              - button "Watch" [ref=e55]:
                - img [ref=e56]
                - generic [ref=e58]: Watch
              - button "Download" [ref=e59]:
                - img [ref=e60]
                - generic [ref=e62]: Download
              - button "Share" [ref=e63]:
                - img [ref=e64]
      - generic [ref=e66]:
        - generic [ref=e67]:
          - heading "Synopsis" [level=2] [ref=e68]: Synopsis
          - paragraph [ref=e70]: Gaëllle tente d'exister au millieu d'un hiver qui n'en fini pas, d'un boulot physique, d'amis électroniques et d'un père diminué.
        - generic [ref=e71]:
          - heading "Cast" [level=2] [ref=e72]: Cast
          - generic [ref=e74]:
            - generic [ref=e75]: Johanna Fillieule
            - generic [ref=e76]: Élise Lhomeau
            - generic [ref=e77]: Valentin Campagne
            - generic [ref=e78]: Thomas Badinot
        - generic [ref=e79]:
          - heading "Watch" [level=2] [ref=e80]: Watch
          - generic [ref=e83]:
            - paragraph [ref=e87]: Chargement…
            - generic [ref=e88]:
              - generic [ref=e89]:
                - generic [ref=e90]:
                  - generic [ref=e91]: CHILLERS+
                  - heading "Seule la tendresse" [level=1] [ref=e93]
                - paragraph [ref=e94]: Movie
              - generic [ref=e95]:
                - generic [ref=e96]:
                  - button "Couper le son" [ref=e97]:
                    - img [ref=e98]
                  - slider: "1"
                - button "Fermer le lecteur" [ref=e101]:
                  - img [ref=e102]
            - generic [ref=e104]:
              - generic [ref=e105]:
                - slider [ref=e106] [cursor=pointer]: "0"
                - generic [ref=e107]:
                  - generic [ref=e108]: 0:00
                  - generic [ref=e109]: 0:00
              - generic [ref=e110]:
                - generic [ref=e111]:
                  - button "Reculer de 10 secondes" [ref=e112]:
                    - img [ref=e113]
                  - button "Mettre en pause" [ref=e115]:
                    - img [ref=e116]
                  - button "Avancer de 10 secondes" [ref=e118]:
                    - img [ref=e119]
                - generic [ref=e121]:
                  - button "Download" [ref=e122]:
                    - img [ref=e123]
                  - button "Paramètres" [ref=e125]:
                    - img [ref=e126]
                  - button "Plein écran" [ref=e128]:
                    - img [ref=e129]
        - generic [ref=e131]:
          - heading "You Might Also Like" [level=2] [ref=e132]: You Might Also Like
          - generic [ref=e134]:
            - generic [ref=e135] [cursor=pointer]:
              - generic [ref=e136]:
                - img "L'Odyssée" [ref=e137]
                - img [ref=e139]
              - generic [ref=e141]:
                - heading "L'Odyssée" [level=3] [ref=e142]
                - generic [ref=e143]:
                  - generic [ref=e144]: "2026"
                  - generic [ref=e145]: •
                  - generic [ref=e146]:
                    - img [ref=e147]
                    - generic [ref=e149]: "7.7"
            - generic [ref=e150] [cursor=pointer]:
              - generic [ref=e151]:
                - img "Obsession" [ref=e152]
                - img [ref=e154]
              - generic [ref=e156]:
                - heading "Obsession" [level=3] [ref=e157]
                - generic [ref=e158]:
                  - generic [ref=e159]: "2026"
                  - generic [ref=e160]: •
                  - generic [ref=e161]:
                    - img [ref=e162]
                    - generic [ref=e164]: "8.3"
            - generic [ref=e165] [cursor=pointer]:
              - generic [ref=e166]:
                - img "Backrooms" [ref=e167]
                - img [ref=e169]
              - generic [ref=e171]:
                - heading "Backrooms" [level=3] [ref=e172]
                - generic [ref=e173]:
                  - generic [ref=e174]: "2026"
                  - generic [ref=e175]: •
                  - generic [ref=e176]:
                    - img [ref=e177]
                    - generic [ref=e179]: "7"
            - generic [ref=e180] [cursor=pointer]:
              - generic [ref=e181]:
                - img "Disclosure Day" [ref=e182]
                - img [ref=e184]
              - generic [ref=e186]:
                - heading "Disclosure Day" [level=3] [ref=e187]
                - generic [ref=e188]:
                  - generic [ref=e189]: "2026"
                  - generic [ref=e190]: •
                  - generic [ref=e191]:
                    - img [ref=e192]
                    - generic [ref=e194]: "6.7"
            - generic [ref=e195] [cursor=pointer]:
              - generic [ref=e196]:
                - img "Vaiana, la légende du bout du monde" [ref=e197]
                - img [ref=e199]
              - generic [ref=e201]:
                - heading "Vaiana, la légende du bout du monde" [level=3] [ref=e202]
                - generic [ref=e203]:
                  - generic [ref=e204]: "2026"
                  - generic [ref=e205]: •
                  - generic [ref=e206]:
                    - img [ref=e207]
                    - generic [ref=e209]: "5.8"
            - generic [ref=e210] [cursor=pointer]:
              - generic [ref=e211]:
                - img "Scary Movie" [ref=e212]
                - img [ref=e214]
              - generic [ref=e216]:
                - heading "Scary Movie" [level=3] [ref=e217]
                - generic [ref=e218]:
                  - generic [ref=e219]: "2026"
                  - generic [ref=e220]: •
                  - generic [ref=e221]:
                    - img [ref=e222]
                    - generic [ref=e224]: "5.4"
            - generic [ref=e225] [cursor=pointer]:
              - generic [ref=e226]:
                - img "Toy Story 5" [ref=e227]
                - img [ref=e229]
              - generic [ref=e231]:
                - heading "Toy Story 5" [level=3] [ref=e232]
                - generic [ref=e233]:
                  - generic [ref=e234]: "2026"
                  - generic [ref=e235]: •
                  - generic [ref=e236]:
                    - img [ref=e237]
                    - generic [ref=e239]: "7.4"
            - generic [ref=e240] [cursor=pointer]:
              - generic [ref=e241]:
                - img "Des Minions et des monstres" [ref=e242]
                - img [ref=e244]
              - generic [ref=e246]:
                - heading "Des Minions et des monstres" [level=3] [ref=e247]
                - generic [ref=e248]:
                  - generic [ref=e249]: "2026"
                  - generic [ref=e250]: •
                  - generic [ref=e251]:
                    - img [ref=e252]
                    - generic [ref=e254]: "6.4"
  - contentinfo [ref=e255]:
    - generic [ref=e256]:
      - generic [ref=e257]:
        - generic [ref=e258]:
          - heading "CHILLERS" [level=3] [ref=e259]
          - paragraph [ref=e260]: L'expérience ultime du streaming gratuit. Films, séries, anime — accès instantané, zéro pub.
          - paragraph [ref=e261]: Chillers ne stocke aucun fichier. Tout contenu est hébergé par des tiers non affiliés. À des fins éducatives uniquement.
        - generic [ref=e262]:
          - heading "Liens" [level=4] [ref=e263]
          - list [ref=e264]:
            - listitem [ref=e265]:
              - link "À Propos" [ref=e266] [cursor=pointer]:
                - /url: /about
                - img [ref=e267]
                - text: À Propos
            - listitem [ref=e269]:
              - link "Contact" [ref=e270] [cursor=pointer]:
                - /url: /contact
                - img [ref=e271]
                - text: Contact
            - listitem [ref=e274]:
              - link "Soutenir" [ref=e275] [cursor=pointer]:
                - /url: /support
                - img [ref=e276]
                - text: Soutenir
            - listitem [ref=e278]:
              - link "Politique de confidentialité" [ref=e279] [cursor=pointer]:
                - /url: /privacy
                - img [ref=e280]
                - text: Politique de confidentialité
        - generic [ref=e282]:
          - heading "Categories" [level=4] [ref=e283]
          - list [ref=e284]:
            - listitem [ref=e285]:
              - link "Action & Adventure" [ref=e286] [cursor=pointer]:
                - /url: "#"
                - img [ref=e287]
                - text: Action & Adventure
            - listitem [ref=e289]:
              - link "Sci-Fi & Cyberpunk" [ref=e290] [cursor=pointer]:
                - /url: "#"
                - img [ref=e291]
                - text: Sci-Fi & Cyberpunk
            - listitem [ref=e293]:
              - link "Anime Blockbusters" [ref=e294] [cursor=pointer]:
                - /url: "#"
                - img [ref=e295]
                - text: Anime Blockbusters
            - listitem [ref=e297]:
              - link "Cultural Documentaries" [ref=e298] [cursor=pointer]:
                - /url: "#"
                - img [ref=e299]
                - text: Cultural Documentaries
        - generic [ref=e301]:
          - heading "Soutenir" [level=4] [ref=e302]
          - paragraph [ref=e303]: Le projet vit grâce à vos dons. Orange Money & Mobile Money acceptés.
          - link "Nous soutenir" [ref=e304] [cursor=pointer]:
            - /url: /support
            - img [ref=e305]
            - text: Nous soutenir
        - generic [ref=e307]:
          - heading "Join the Chill" [level=4] [ref=e308]
          - paragraph [ref=e309]: Follow us on social channels to keep up with premier releases.
          - generic [ref=e310]:
            - link "𝕏" [ref=e311] [cursor=pointer]:
              - /url: "#"
            - link "f" [ref=e312] [cursor=pointer]:
              - /url: "#"
            - link [ref=e313] [cursor=pointer]:
              - /url: "#"
              - img [ref=e314]
            - link "▶" [ref=e317] [cursor=pointer]:
              - /url: "#"
      - generic [ref=e318]:
        - generic [ref=e319]: © 2026 Chillers. No rights reserved.
        - generic [ref=e320]:
          - link "À Propos" [ref=e321] [cursor=pointer]:
            - /url: /about
            - img [ref=e322]
            - text: À Propos
          - generic [ref=e324]: •
          - link "Contact" [ref=e325] [cursor=pointer]:
            - /url: /contact
            - img [ref=e326]
            - text: Contact
          - generic [ref=e329]: •
          - link "Confidentialité" [ref=e330] [cursor=pointer]:
            - /url: /privacy
            - img [ref=e331]
            - text: Confidentialité
  - button "Open Next.js Dev Tools" [ref=e338] [cursor=pointer]:
    - img [ref=e339]
  - alert [ref=e342]
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
  16  |         await expect(page.getByRole('heading', { name: title, exact: true }).first()).toBeVisible({ timeout: 20_000 });
  17  | 
  18  |         const videoEl = page.locator('video[src]');
  19  |         await expect(videoEl.first()).toBeVisible({ timeout: 30_000 });
  20  |         const videoSrc = await videoEl.first().getAttribute('src');
  21  |         expect(videoSrc).toBeTruthy();
  22  |         console.log(`  ✓ Stream src: ${videoSrc?.substring(0, 70)}…`);
  23  | 
  24  |         // Vérifie que la vidéo avance vraiment
  25  |         await page.evaluate(() => {
  26  |           const v = document.querySelector('video');
  27  |           if (v) v.play();
  28  |         });
  29  |         await page.waitForTimeout(3_000);
  30  |         const playbackState = await page.evaluate(() => {
  31  |           const v = document.querySelector('video');
  32  |           if (!v) return null;
  33  |           return { paused: v.paused, currentTime: v.currentTime, readyState: v.readyState };
  34  |         });
  35  |         expect(playbackState).not.toBeNull();
  36  |         expect(playbackState!.paused).toBe(false);
> 37  |         expect(playbackState!.currentTime).toBeGreaterThan(0);
      |                                            ^ Error: expect(received).toBeGreaterThan(expected)
  38  |         expect(playbackState!.readyState).toBeGreaterThanOrEqual(3);
  39  |         console.log(`  ✓ Video plays: currentTime=${playbackState!.currentTime.toFixed(2)}s`);
  40  | 
  41  |         const downloadBtn = page.locator('button').filter({ hasText: /Download|Télécharger/ }).first();
  42  |         await expect(downloadBtn).toBeVisible({ timeout: 10_000 });
  43  |         await expect(downloadBtn).toBeEnabled({ timeout: 5_000 });
  44  | 
  45  |         // Capture the download URL via window.open interception
  46  |         let capturedUrl = '';
  47  |         await page.exposeFunction('__captureDownloadUrl', (url: string) => { capturedUrl = url; });
  48  |         await page.evaluate(() => {
  49  |           const orig = window.open;
  50  |           window.open = (url: any, target?: any) => {
  51  |             (window as any).__captureDownloadUrl(url);
  52  |             return orig ? orig.call(window, url, target) : null;
  53  |           };
  54  |         });
  55  | 
  56  |         await downloadBtn.click();
  57  |         await page.waitForTimeout(3_000);
  58  | 
  59  |         expect(capturedUrl).toMatch(/vidzy\.cc|doodstream|uqload|\.mp4|download/i);
  60  |         console.log(`  ✓ Download: ${capturedUrl.substring(0, 80)}…`);
  61  | 
  62  |         await page.screenshot({ path: `e2e-movie-ok-${testInfo.project.name}.png`, fullPage: true });
  63  |         console.log(`✓ OK: "${title}" — stream + download verified`);
  64  |         return;
  65  |       } catch (err) {
  66  |         const message = err instanceof Error ? err.message : String(err);
  67  |         console.log(`✗ ${message}`);
  68  |         if (attempt === 3) {
  69  |           await page.screenshot({ path: `e2e-movie-fail-${testInfo.project.name}.png`, fullPage: true });
  70  |           throw err;
  71  |         }
  72  |       }
  73  |     }
  74  |   });
  75  | 
  76  |   test('TV Series: episode stream loads on season page', async ({ page }, testInfo) => {
  77  |     test.setTimeout(180_000);
  78  |     for (let attempt = 1; attempt <= 3; attempt++) {
  79  |       let serie: { titre: string; tmdbId: number; episode: { season: number; episodeNumber: number; lien: string } };
  80  |       try {
  81  |         serie = await pickRandomSerie();
  82  |       } catch (err) {
  83  |         console.log(`✗ DB error: ${err instanceof Error ? err.message : String(err)}`);
  84  |         if (attempt === 3) throw err;
  85  |         continue;
  86  |       }
  87  | 
  88  |       const { titre, tmdbId, episode } = serie;
  89  |       const url = `/tv/${tmdbId}/season/${episode.season}`;
  90  |       console.log(`Attempt ${attempt}/3: "${titre}" → ${url}`);
  91  | 
  92  |       try {
  93  |         await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  94  |         await page.waitForURL(/\/tv\/.*\/season\//, { timeout: 15_000 });
  95  | 
  96  |         await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });
  97  | 
  98  |         const videoEl = page.locator('video[src]');
  99  |         await expect(videoEl.first()).toBeVisible({ timeout: 30_000 });
  100 |         const videoSrc = await videoEl.first().getAttribute('src');
  101 |         expect(videoSrc).toBeTruthy();
  102 |         console.log(`  ✓ Stream src: ${videoSrc?.substring(0, 70)}…`);
  103 | 
  104 |         await page.evaluate(() => {
  105 |           const v = document.querySelector('video');
  106 |           if (v) v.play();
  107 |         });
  108 |         await page.waitForTimeout(3_000);
  109 |         const playbackState = await page.evaluate(() => {
  110 |           const v = document.querySelector('video');
  111 |           if (!v) return null;
  112 |           return { paused: v.paused, currentTime: v.currentTime, readyState: v.readyState };
  113 |         });
  114 |         expect(playbackState).not.toBeNull();
  115 |         expect(playbackState!.paused).toBe(false);
  116 |         expect(playbackState!.currentTime).toBeGreaterThan(0);
  117 |         expect(playbackState!.readyState).toBeGreaterThanOrEqual(3);
  118 |         console.log(`  ✓ Video plays: currentTime=${playbackState!.currentTime.toFixed(2)}s`);
  119 | 
  120 |         const downloadBtn = page.locator('button').filter({ hasText: /Télécharger|Download/ }).first();
  121 |         await expect(downloadBtn).toBeVisible({ timeout: 10_000 });
  122 |         await expect(downloadBtn).toBeEnabled({ timeout: 5_000 });
  123 | 
  124 |         let capturedUrl = '';
  125 |         await page.exposeFunction('__captureDownloadUrl', (url: string) => { capturedUrl = url; });
  126 |         await page.evaluate(() => {
  127 |           const orig = window.open;
  128 |           window.open = (url: any, target?: any) => {
  129 |             (window as any).__captureDownloadUrl(url);
  130 |             return orig ? orig.call(window, url, target) : null;
  131 |           };
  132 |         });
  133 | 
  134 |         await downloadBtn.click();
  135 |         await page.waitForTimeout(3_000);
  136 | 
  137 |         expect(capturedUrl).toMatch(/vidzy\.cc|doodstream|uqload|\.mp4|download/i);
```