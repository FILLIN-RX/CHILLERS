# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: film-download.spec.ts >> Film download flow >> view movie detail page → trigger download
- Location: e2e/film-download.spec.ts:37:7

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: page.screenshot: Target page, context or browser has been closed
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
              - button "Bientôt disponible" [disabled] [ref=e59]:
                - img [ref=e60]
                - generic [ref=e62]: Bientôt disponible
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
          - paragraph [ref=e85]: Loading stream…
        - generic [ref=e86]:
          - heading "You Might Also Like" [level=2] [ref=e87]: You Might Also Like
          - generic [ref=e89]:
            - generic [ref=e90] [cursor=pointer]:
              - generic [ref=e91]:
                - img "Obsession" [ref=e92]
                - img [ref=e94]
              - generic [ref=e96]:
                - heading "Obsession" [level=3] [ref=e97]
                - generic [ref=e98]:
                  - generic [ref=e99]: "2026"
                  - generic [ref=e100]: •
                  - generic [ref=e101]:
                    - img [ref=e102]
                    - generic [ref=e104]: "8.2"
            - generic [ref=e105] [cursor=pointer]:
              - generic [ref=e106]:
                - img "Disclosure Day" [ref=e107]
                - img [ref=e109]
              - generic [ref=e111]:
                - heading "Disclosure Day" [level=3] [ref=e112]
                - generic [ref=e113]:
                  - generic [ref=e114]: "2026"
                  - generic [ref=e115]: •
                  - generic [ref=e116]:
                    - img [ref=e117]
                    - generic [ref=e119]: "6.7"
            - generic [ref=e120] [cursor=pointer]:
              - generic [ref=e121]:
                - img "Toy Story 5" [ref=e122]
                - img [ref=e124]
              - generic [ref=e126]:
                - heading "Toy Story 5" [level=3] [ref=e127]
                - generic [ref=e128]:
                  - generic [ref=e129]: "2026"
                  - generic [ref=e130]: •
                  - generic [ref=e131]:
                    - img [ref=e132]
                    - generic [ref=e134]: "7.4"
            - generic [ref=e135] [cursor=pointer]:
              - generic [ref=e136]:
                - img "Scary Movie" [ref=e137]
                - img [ref=e139]
              - generic [ref=e141]:
                - heading "Scary Movie" [level=3] [ref=e142]
                - generic [ref=e143]:
                  - generic [ref=e144]: "2026"
                  - generic [ref=e145]: •
                  - generic [ref=e146]:
                    - img [ref=e147]
                    - generic [ref=e149]: "5.4"
            - generic [ref=e150] [cursor=pointer]:
              - generic [ref=e151]:
                - img "Vaiana, la légende du bout du monde" [ref=e152]
                - img [ref=e154]
              - generic [ref=e156]:
                - heading "Vaiana, la légende du bout du monde" [level=3] [ref=e157]
                - generic [ref=e158]:
                  - generic [ref=e159]: "2026"
                  - generic [ref=e160]: •
                  - generic [ref=e161]:
                    - img [ref=e162]
                    - generic [ref=e164]: "5.8"
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
                - img "The Furious" [ref=e182]
                - img [ref=e184]
              - generic [ref=e186]:
                - heading "The Furious" [level=3] [ref=e187]
                - generic [ref=e188]:
                  - generic [ref=e189]: "2026"
                  - generic [ref=e190]: •
                  - generic [ref=e191]:
                    - img [ref=e192]
                    - generic [ref=e194]: "7.4"
            - generic [ref=e195] [cursor=pointer]:
              - generic [ref=e196]:
                - img "Passenger" [ref=e197]
                - img [ref=e199]
              - generic [ref=e201]:
                - heading "Passenger" [level=3] [ref=e202]
                - generic [ref=e203]:
                  - generic [ref=e204]: "2026"
                  - generic [ref=e205]: •
                  - generic [ref=e206]:
                    - img [ref=e207]
                    - generic [ref=e209]: "7.2"
  - contentinfo [ref=e210]:
    - generic [ref=e211]:
      - generic [ref=e212]:
        - generic [ref=e213]:
          - heading "CHILLERS" [level=3] [ref=e214]
          - paragraph [ref=e215]: L'expérience ultime du streaming gratuit. Films, séries, anime — accès instantané, zéro pub.
          - paragraph [ref=e216]: Chillers ne stocke aucun fichier. Tout contenu est hébergé par des tiers non affiliés. À des fins éducatives uniquement.
        - generic [ref=e217]:
          - heading "Liens" [level=4] [ref=e218]
          - list [ref=e219]:
            - listitem [ref=e220]:
              - link "À Propos" [ref=e221] [cursor=pointer]:
                - /url: /about
                - img [ref=e222]
                - text: À Propos
            - listitem [ref=e224]:
              - link "Contact" [ref=e225] [cursor=pointer]:
                - /url: /contact
                - img [ref=e226]
                - text: Contact
            - listitem [ref=e229]:
              - link "Soutenir" [ref=e230] [cursor=pointer]:
                - /url: /support
                - img [ref=e231]
                - text: Soutenir
            - listitem [ref=e233]:
              - link "Politique de confidentialité" [ref=e234] [cursor=pointer]:
                - /url: /privacy
                - img [ref=e235]
                - text: Politique de confidentialité
        - generic [ref=e237]:
          - heading "Categories" [level=4] [ref=e238]
          - list [ref=e239]:
            - listitem [ref=e240]:
              - link "Action & Adventure" [ref=e241] [cursor=pointer]:
                - /url: "#"
                - img [ref=e242]
                - text: Action & Adventure
            - listitem [ref=e244]:
              - link "Sci-Fi & Cyberpunk" [ref=e245] [cursor=pointer]:
                - /url: "#"
                - img [ref=e246]
                - text: Sci-Fi & Cyberpunk
            - listitem [ref=e248]:
              - link "Anime Blockbusters" [ref=e249] [cursor=pointer]:
                - /url: "#"
                - img [ref=e250]
                - text: Anime Blockbusters
            - listitem [ref=e252]:
              - link "Cultural Documentaries" [ref=e253] [cursor=pointer]:
                - /url: "#"
                - img [ref=e254]
                - text: Cultural Documentaries
        - generic [ref=e256]:
          - heading "Soutenir" [level=4] [ref=e257]
          - paragraph [ref=e258]: Le projet vit grâce à vos dons. Orange Money & Mobile Money acceptés.
          - link "Nous soutenir" [ref=e259] [cursor=pointer]:
            - /url: /support
            - img [ref=e260]
            - text: Nous soutenir
        - generic [ref=e262]:
          - heading "Join the Chill" [level=4] [ref=e263]
          - paragraph [ref=e264]: Follow us on social channels to keep up with premier releases.
          - generic [ref=e265]:
            - link "𝕏" [ref=e266] [cursor=pointer]:
              - /url: "#"
            - link "f" [ref=e267] [cursor=pointer]:
              - /url: "#"
            - link [ref=e268] [cursor=pointer]:
              - /url: "#"
              - img [ref=e269]
            - link "▶" [ref=e272] [cursor=pointer]:
              - /url: "#"
      - generic [ref=e273]:
        - generic [ref=e274]: © 2026 Chillers. No rights reserved.
        - generic [ref=e275]:
          - link "À Propos" [ref=e276] [cursor=pointer]:
            - /url: /about
            - img [ref=e277]
            - text: À Propos
          - generic [ref=e279]: •
          - link "Contact" [ref=e280] [cursor=pointer]:
            - /url: /contact
            - img [ref=e281]
            - text: Contact
          - generic [ref=e284]: •
          - link "Confidentialité" [ref=e285] [cursor=pointer]:
            - /url: /privacy
            - img [ref=e286]
            - text: Confidentialité
  - button "Open Next.js Dev Tools" [ref=e293] [cursor=pointer]:
    - img [ref=e294]
  - alert [ref=e297]
```

# Test source

```ts
  1  | import { test, expect, Page } from '@playwright/test';
  2  | import { pickRandomUploadedFilm } from './helpers/film-picker';
  3  | 
  4  | async function runFlow(page: Page, title: string, tmdbId: number) {
  5  |   // Navigate directly to the movie detail page
  6  |   // (search overlay has a bug: local MongoDB entries use _id instead of tmdbId)
  7  |   await page.goto(`/media/${tmdbId}?type=movie`, { waitUntil: 'domcontentloaded' });
  8  |   await page.waitForURL(/\/media\//, { timeout: 15_000 });
  9  | 
  10 |   // Wait for the movie title to appear (page content loaded)
  11 |   await expect(page.locator('h1')).toContainText(title, { timeout: 15_000 });
  12 | 
  13 |   // Wait until the download button is ready (not in loading/disabled state).
  14 |   // The download button shows "Télécharger" text when the stream is ready,
  15 |   // and "Bientôt disponible" when unavailable.
  16 |   // We wait up to 25s for the stream to resolve.
  17 |   const downloadBtn = page.getByRole('button', { name: /Télécharger/ });
  18 | 
  19 |   try {
  20 |     await expect(downloadBtn).toBeVisible({ timeout: 25_000 });
  21 |     await expect(downloadBtn).toBeEnabled({ timeout: 5_000 });
  22 |   } catch {
  23 |     throw new Error(`Film "${title}" (tmdbId: ${tmdbId}) — Téléchargement non disponible`);
  24 |   }
  25 | 
  26 |   // Click download → startDownload → triggerDownload → popup
  27 |   const popupPromise = page.waitForEvent('popup', { timeout: 30_000 });
  28 |   await downloadBtn.click();
  29 |   const popup = await popupPromise;
  30 | 
  31 |   const popupUrl = popup.url();
  32 |   expect(popupUrl).toMatch(/vidzy\.cc|doodstream|\.mp4|download/i);
  33 |   await popup.close();
  34 | }
  35 | 
  36 | test.describe('Film download flow', () => {
  37 |   test('view movie detail page → trigger download', async ({ page }, testInfo) => {
  38 |     for (let attempt = 1; attempt <= 5; attempt++) {
  39 |       const { title, tmdbId } = pickRandomUploadedFilm();
  40 |       console.log(`Attempt ${attempt}/5: "${title}" (tmdbId: ${tmdbId})`);
  41 | 
  42 |       try {
  43 |         await runFlow(page, title, tmdbId);
  44 |         await page.screenshot({ path: `e2e-success-${testInfo.project.name}.png`, fullPage: true });
  45 |         console.log(`✓ OK: "${title}"`);
  46 |         return;
  47 |       } catch (err) {
  48 |         const message = err instanceof Error ? err.message : String(err);
  49 |         console.log(`✗ ${message}`);
  50 |         if (attempt === 5) {
> 51 |           await page.screenshot({ path: `e2e-failure-${testInfo.project.name}.png`, fullPage: true });
     |                      ^ Error: page.screenshot: Target page, context or browser has been closed
  52 |           throw err;
  53 |         }
  54 |       }
  55 |     }
  56 |   });
  57 | });
  58 | 
```