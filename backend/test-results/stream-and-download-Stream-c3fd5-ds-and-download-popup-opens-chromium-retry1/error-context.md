# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stream-and-download.spec.ts >> Streaming + Download >> Movie: stream loads and download popup opens
- Location: e2e/stream-and-download.spec.ts:6:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
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
        - img "Nino dans la nuit" [ref=e29]
        - generic [ref=e33]:
          - generic [ref=e34]:
            - img "Nino dans la nuit"
          - generic [ref=e35]:
            - generic [ref=e37]: Drame
            - heading "Nino dans la nuit" [level=1] [ref=e38]
            - generic [ref=e39]:
              - generic [ref=e40]:
                - img [ref=e41]
                - generic [ref=e43]: "5"
                - generic [ref=e44]: /10
              - generic [ref=e45]:
                - img [ref=e46]
                - text: "2026"
              - generic [ref=e49]:
                - img [ref=e50]
                - text: 1h 56m
              - generic [ref=e52]: movie
            - paragraph [ref=e53]: Suite à une soirée qui tourne mal, Nino Paradis, 20 ans, prend la fuite. Après une tentative ratée d’intégrer la Légion étrangère, il rentre à Paris où il retrouve Lale, celle qui embrase son cœur, ainsi que Malik et Charlie, ses deux compagnons d’infortune. De petits boulots mal payés en soirée, Nino cherche sa place dans un monde qui lui laisse peu d’espoir, mais s’évertue à continuer de rêver…
            - generic [ref=e54]:
              - button "Watch" [ref=e55]:
                - img [ref=e56]
                - generic [ref=e58]: Watch
              - button "Trailer" [ref=e59]:
                - img [ref=e60]
                - generic [ref=e62]: Trailer
              - button "Download" [ref=e63]:
                - img [ref=e64]
                - generic [ref=e66]: Download
              - button "Share" [ref=e67]:
                - img [ref=e68]
      - generic [ref=e70]:
        - generic [ref=e71]:
          - heading "Synopsis" [level=2] [ref=e72]: Synopsis
          - paragraph [ref=e74]: Suite à une soirée qui tourne mal, Nino Paradis, 20 ans, prend la fuite. Après une tentative ratée d’intégrer la Légion étrangère, il rentre à Paris où il retrouve Lale, celle qui embrase son cœur, ainsi que Malik et Charlie, ses deux compagnons d’infortune. De petits boulots mal payés en soirée, Nino cherche sa place dans un monde qui lui laisse peu d’espoir, mais s’évertue à continuer de rêver…
        - generic [ref=e75]:
          - heading "Cast" [level=2] [ref=e76]: Cast
          - generic [ref=e78]:
            - generic [ref=e79]: Oscar Högström
            - generic [ref=e80]: Mara Taquin
            - generic [ref=e81]: Bilal Hassani
            - generic [ref=e82]: Théo Augier
            - generic [ref=e83]: Félix Maritaud
        - generic [ref=e84]:
          - heading "Watch" [level=2] [ref=e85]: Watch
          - generic [ref=e88]:
            - paragraph [ref=e92]: Chargement…
            - generic [ref=e93]:
              - generic [ref=e94]:
                - generic [ref=e95]:
                  - generic [ref=e96]: CHILLERS+
                  - heading "Nino dans la nuit" [level=1] [ref=e98]
                - paragraph [ref=e99]: Drame
              - generic [ref=e100]:
                - generic [ref=e101]:
                  - button "Couper le son" [ref=e102]:
                    - img [ref=e103]
                  - slider: "1"
                - button "Fermer le lecteur" [ref=e106]:
                  - img [ref=e107]
            - generic [ref=e109]:
              - generic [ref=e110]:
                - slider [ref=e111] [cursor=pointer]: "0"
                - generic [ref=e112]:
                  - generic [ref=e113]: 0:00
                  - generic [ref=e114]: 0:00
              - generic [ref=e115]:
                - generic [ref=e116]:
                  - button "Reculer de 10 secondes" [ref=e117]:
                    - img [ref=e118]
                  - button "Lire" [ref=e120]:
                    - img [ref=e121]
                  - button "Avancer de 10 secondes" [ref=e123]:
                    - img [ref=e124]
                - generic [ref=e126]:
                  - button "Download" [ref=e127]:
                    - img [ref=e128]
                  - button "Paramètres" [ref=e130]:
                    - img [ref=e131]
                  - button "Plein écran" [ref=e133]:
                    - img [ref=e134]
        - generic [ref=e136]:
          - heading "You Might Also Like" [level=2] [ref=e137]: You Might Also Like
          - generic [ref=e139]:
            - generic [ref=e140] [cursor=pointer]:
              - generic [ref=e141]:
                - img "L'Odyssée" [ref=e142]
                - img [ref=e144]
              - generic [ref=e146]:
                - heading "L'Odyssée" [level=3] [ref=e147]
                - generic [ref=e148]:
                  - generic [ref=e149]: "2026"
                  - generic [ref=e150]: •
                  - generic [ref=e151]:
                    - img [ref=e152]
                    - generic [ref=e154]: "7.7"
            - generic [ref=e155] [cursor=pointer]:
              - generic [ref=e156]:
                - img "Obsession" [ref=e157]
                - img [ref=e159]
              - generic [ref=e161]:
                - heading "Obsession" [level=3] [ref=e162]
                - generic [ref=e163]:
                  - generic [ref=e164]: "2026"
                  - generic [ref=e165]: •
                  - generic [ref=e166]:
                    - img [ref=e167]
                    - generic [ref=e169]: "8.3"
            - generic [ref=e170] [cursor=pointer]:
              - generic [ref=e171]:
                - img "Backrooms" [ref=e172]
                - img [ref=e174]
              - generic [ref=e176]:
                - heading "Backrooms" [level=3] [ref=e177]
                - generic [ref=e178]:
                  - generic [ref=e179]: "2026"
                  - generic [ref=e180]: •
                  - generic [ref=e181]:
                    - img [ref=e182]
                    - generic [ref=e184]: "7"
            - generic [ref=e185] [cursor=pointer]:
              - generic [ref=e186]:
                - img "Disclosure Day" [ref=e187]
                - img [ref=e189]
              - generic [ref=e191]:
                - heading "Disclosure Day" [level=3] [ref=e192]
                - generic [ref=e193]:
                  - generic [ref=e194]: "2026"
                  - generic [ref=e195]: •
                  - generic [ref=e196]:
                    - img [ref=e197]
                    - generic [ref=e199]: "6.7"
            - generic [ref=e200] [cursor=pointer]:
              - generic [ref=e201]:
                - img "Vaiana, la légende du bout du monde" [ref=e202]
                - img [ref=e204]
              - generic [ref=e206]:
                - heading "Vaiana, la légende du bout du monde" [level=3] [ref=e207]
                - generic [ref=e208]:
                  - generic [ref=e209]: "2026"
                  - generic [ref=e210]: •
                  - generic [ref=e211]:
                    - img [ref=e212]
                    - generic [ref=e214]: "5.8"
            - generic [ref=e215] [cursor=pointer]:
              - generic [ref=e216]:
                - img "Scary Movie" [ref=e217]
                - img [ref=e219]
              - generic [ref=e221]:
                - heading "Scary Movie" [level=3] [ref=e222]
                - generic [ref=e223]:
                  - generic [ref=e224]: "2026"
                  - generic [ref=e225]: •
                  - generic [ref=e226]:
                    - img [ref=e227]
                    - generic [ref=e229]: "5.4"
            - generic [ref=e230] [cursor=pointer]:
              - generic [ref=e231]:
                - img "Toy Story 5" [ref=e232]
                - img [ref=e234]
              - generic [ref=e236]:
                - heading "Toy Story 5" [level=3] [ref=e237]
                - generic [ref=e238]:
                  - generic [ref=e239]: "2026"
                  - generic [ref=e240]: •
                  - generic [ref=e241]:
                    - img [ref=e242]
                    - generic [ref=e244]: "7.4"
            - generic [ref=e245] [cursor=pointer]:
              - generic [ref=e246]:
                - img "Des Minions et des monstres" [ref=e247]
                - img [ref=e249]
              - generic [ref=e251]:
                - heading "Des Minions et des monstres" [level=3] [ref=e252]
                - generic [ref=e253]:
                  - generic [ref=e254]: "2026"
                  - generic [ref=e255]: •
                  - generic [ref=e256]:
                    - img [ref=e257]
                    - generic [ref=e259]: "6.4"
  - contentinfo [ref=e260]:
    - generic [ref=e261]:
      - generic [ref=e262]:
        - generic [ref=e263]:
          - heading "CHILLERS" [level=3] [ref=e264]
          - paragraph [ref=e265]: L'expérience ultime du streaming gratuit. Films, séries, anime — accès instantané, zéro pub.
          - paragraph [ref=e266]: Chillers ne stocke aucun fichier. Tout contenu est hébergé par des tiers non affiliés. À des fins éducatives uniquement.
        - generic [ref=e267]:
          - heading "Liens" [level=4] [ref=e268]
          - list [ref=e269]:
            - listitem [ref=e270]:
              - link "À Propos" [ref=e271] [cursor=pointer]:
                - /url: /about
                - img [ref=e272]
                - text: À Propos
            - listitem [ref=e274]:
              - link "Contact" [ref=e275] [cursor=pointer]:
                - /url: /contact
                - img [ref=e276]
                - text: Contact
            - listitem [ref=e279]:
              - link "Soutenir" [ref=e280] [cursor=pointer]:
                - /url: /support
                - img [ref=e281]
                - text: Soutenir
            - listitem [ref=e283]:
              - link "Politique de confidentialité" [ref=e284] [cursor=pointer]:
                - /url: /privacy
                - img [ref=e285]
                - text: Politique de confidentialité
        - generic [ref=e287]:
          - heading "Categories" [level=4] [ref=e288]
          - list [ref=e289]:
            - listitem [ref=e290]:
              - link "Action & Adventure" [ref=e291] [cursor=pointer]:
                - /url: "#"
                - img [ref=e292]
                - text: Action & Adventure
            - listitem [ref=e294]:
              - link "Sci-Fi & Cyberpunk" [ref=e295] [cursor=pointer]:
                - /url: "#"
                - img [ref=e296]
                - text: Sci-Fi & Cyberpunk
            - listitem [ref=e298]:
              - link "Anime Blockbusters" [ref=e299] [cursor=pointer]:
                - /url: "#"
                - img [ref=e300]
                - text: Anime Blockbusters
            - listitem [ref=e302]:
              - link "Cultural Documentaries" [ref=e303] [cursor=pointer]:
                - /url: "#"
                - img [ref=e304]
                - text: Cultural Documentaries
        - generic [ref=e306]:
          - heading "Soutenir" [level=4] [ref=e307]
          - paragraph [ref=e308]: Le projet vit grâce à vos dons. Orange Money & Mobile Money acceptés.
          - link "Nous soutenir" [ref=e309] [cursor=pointer]:
            - /url: /support
            - img [ref=e310]
            - text: Nous soutenir
        - generic [ref=e312]:
          - heading "Join the Chill" [level=4] [ref=e313]
          - paragraph [ref=e314]: Follow us on social channels to keep up with premier releases.
          - generic [ref=e315]:
            - link "𝕏" [ref=e316] [cursor=pointer]:
              - /url: "#"
            - link "f" [ref=e317] [cursor=pointer]:
              - /url: "#"
            - link [ref=e318] [cursor=pointer]:
              - /url: "#"
              - img [ref=e319]
            - link "▶" [ref=e322] [cursor=pointer]:
              - /url: "#"
      - generic [ref=e323]:
        - generic [ref=e324]: © 2026 Chillers. No rights reserved.
        - generic [ref=e325]:
          - link "À Propos" [ref=e326] [cursor=pointer]:
            - /url: /about
            - img [ref=e327]
            - text: À Propos
          - generic [ref=e329]: •
          - link "Contact" [ref=e330] [cursor=pointer]:
            - /url: /contact
            - img [ref=e331]
            - text: Contact
          - generic [ref=e334]: •
          - link "Confidentialité" [ref=e335] [cursor=pointer]:
            - /url: /privacy
            - img [ref=e336]
            - text: Confidentialité
  - generic [ref=e342] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e343]:
      - img [ref=e344]
    - generic [ref=e347]:
      - button "Open issues overlay" [ref=e348]:
        - generic [ref=e349]:
          - generic [ref=e350]: "0"
          - generic [ref=e351]: "1"
        - generic [ref=e352]: Issue
      - button "Collapse issues badge" [ref=e353]:
        - img [ref=e354]
  - alert [ref=e356]
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
> 36  |         expect(playbackState!.paused).toBe(false);
      |                                       ^ Error: expect(received).toBe(expected) // Object.is equality
  37  |         expect(playbackState!.currentTime).toBeGreaterThan(0);
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
```