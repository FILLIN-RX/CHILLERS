# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stream-and-download.spec.ts >> Streaming + Download >> TV Series: episode stream loads on season page
- Location: e2e/stream-and-download.spec.ts:76:7

# Error details

```
Error: write EPIPE
```

# Test source

```ts
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
  138 |         console.log(`  ✓ Download: ${capturedUrl.substring(0, 80)}…`);
  139 | 
  140 |         await page.screenshot({ path: `e2e-serie-ok-${testInfo.project.name}.png`, fullPage: true });
  141 |         console.log(`✓ OK: "${titre}" — stream + download verified`);
  142 |         return;
  143 |       } catch (err) {
  144 |         const message = err instanceof Error ? err.message : String(err);
  145 |         console.log(`✗ ${message}`);
  146 |         if (attempt === 3) {
> 147 |           await page.screenshot({ path: `e2e-serie-fail-${testInfo.project.name}.png`, fullPage: true });
      |                      ^ Error: write EPIPE
  148 |           throw err;
  149 |         }
  150 |       }
  151 |     }
  152 |   });
  153 | });
  154 | 
```