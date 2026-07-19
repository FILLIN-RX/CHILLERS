# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stream-and-download.spec.ts >> Streaming + Download >> TV Series: episode stream loads on season page
- Location: e2e/stream-and-download.spec.ts:76:7

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
          - link "Movies" [ref=e9] [cursor=pointer]:
            - /url: /media/movies
          - link "Series" [ref=e10] [cursor=pointer]:
            - /url: /media/series
            - text: Series
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
      - button "Retour" [ref=e25]:
        - img [ref=e26]
      - generic [ref=e29]:
        - generic [ref=e30]:
          - generic [ref=e31]:
            - generic [ref=e32]:
              - heading "FROM" [level=1] [ref=e33]
              - paragraph [ref=e34]: S4 · E1 — L'arrivée
            - generic [ref=e35]:
              - button "Previous" [disabled] [ref=e36]:
                - img [ref=e37]
              - button "Next" [ref=e39]:
                - img [ref=e40]
          - generic [ref=e43]:
            - paragraph [ref=e47]: Chargement…
            - generic [ref=e48]:
              - generic [ref=e49]:
                - generic [ref=e50]:
                  - generic [ref=e51]: CHILLERS+
                  - heading "FROM · E1" [level=1] [ref=e53]
                - paragraph
              - generic [ref=e54]:
                - generic [ref=e55]:
                  - button "Couper le son" [ref=e56]:
                    - img [ref=e57]
                  - slider: "1"
                - button "Fermer le lecteur" [ref=e60]:
                  - img [ref=e61]
            - generic [ref=e63]:
              - generic [ref=e64]:
                - slider [ref=e65] [cursor=pointer]: "0"
                - generic [ref=e66]:
                  - generic [ref=e67]: 0:00
                  - generic [ref=e68]: 0:00
              - generic [ref=e69]:
                - generic [ref=e70]:
                  - button "Reculer de 10 secondes" [ref=e71]:
                    - img [ref=e72]
                  - button "Lire" [ref=e74]:
                    - img [ref=e75]
                  - button "Avancer de 10 secondes" [ref=e77]:
                    - img [ref=e78]
                - generic [ref=e80]:
                  - button "Download" [ref=e81]:
                    - img [ref=e82]
                  - button "Paramètres" [ref=e84]:
                    - img [ref=e85]
                  - button "Plein écran" [ref=e87]:
                    - img [ref=e88]
          - generic [ref=e90]:
            - heading "Synopsis" [level=2] [ref=e91]
            - paragraph [ref=e92]: Une nouvelle arrivée en ville suscite le chaos. Jade et Tabitha se démènent pour comprendre leur révélation au Bottle Tree. Boyd doit gérer les implications du retour de Smiley.
          - generic [ref=e93]:
            - button "Précédent" [disabled] [ref=e94]:
              - img [ref=e95]
              - text: Précédent
            - button "Suivant" [ref=e97]:
              - text: Suivant
              - img [ref=e98]
            - button "Télécharger" [ref=e100]:
              - img [ref=e101]
              - text: Télécharger
        - generic [ref=e103]:
          - heading "Épisodes · 10" [level=3] [ref=e104]
          - generic [ref=e105]:
            - generic [ref=e106] [cursor=pointer]:
              - generic [ref=e107]:
                - img "L'arrivée" [ref=e108]
                - img [ref=e110]
              - generic [ref=e112]:
                - generic [ref=e113]:
                  - generic [ref=e114]: "1."
                  - heading "L'arrivée" [level=4] [ref=e115]
                - paragraph [ref=e116]: Une nouvelle arrivée en ville suscite le chaos. Jade et Tabitha se démènent pour comprendre leur révélation au Bottle Tree. Boyd doit gérer les implications du retour de Smiley.
                - generic [ref=e117]: 54m
            - generic [ref=e118] [cursor=pointer]:
              - img "Combat" [ref=e120]
              - generic [ref=e121]:
                - generic [ref=e122]:
                  - generic [ref=e123]: "2."
                  - heading "Combat" [level=4] [ref=e124]
                - paragraph [ref=e125]: Une découverte macabre provoque une onde de choc dans la ville tandis que Jade et Tabitha luttent contre le poids de leur révélation.
                - generic [ref=e126]: 55m
            - generic [ref=e127] [cursor=pointer]:
              - img "Et allons-y gaiment" [ref=e129]
              - generic [ref=e130]:
                - generic [ref=e131]:
                  - generic [ref=e132]: "3."
                  - heading "Et allons-y gaiment" [level=4] [ref=e133]
                - paragraph [ref=e134]: Boyd échafaude un plan pour sauver Acosta de ses démons pendant que Julie explore ses nouvelles capacités. Tabitha tente le tout pour le tout et Victor aide Ethan à trouver des réponses.
                - generic [ref=e135]: 48m
            - generic [ref=e136] [cursor=pointer]:
              - img "Des mythes et des monstres" [ref=e138]
              - generic [ref=e139]:
                - generic [ref=e140]:
                  - generic [ref=e141]: "4."
                  - heading "Des mythes et des monstres" [level=4] [ref=e142]
                - paragraph [ref=e143]: Une nouvelle menace plane sur Boyd et ses proches, sur le qui-vive. Julie cherche à maîtriser ses nouvelles facultés, et Sara est de nouveau tourmentée par les voix dans sa tête.
                - generic [ref=e144]: 52m
            - generic [ref=e145] [cursor=pointer]:
              - img "Quel long et étrange voyage !" [ref=e147]
              - generic [ref=e148]:
                - generic [ref=e149]:
                  - generic [ref=e150]: "5."
                  - heading "Quel long et étrange voyage !" [level=4] [ref=e151]
                - paragraph [ref=e152]: La recherche frénétique de réponses entraîne Boyd et Jade en territoire inconnu, alors qu'une simple livraison de nourriture se transforme en un véritable cauchemar dans le campement.
                - generic [ref=e153]: 53m
            - generic [ref=e154] [cursor=pointer]:
              - img "Le Cœur est un chasseur solitaire" [ref=e156]
              - generic [ref=e157]:
                - generic [ref=e158]:
                  - generic [ref=e159]: "6."
                  - heading "Le Cœur est un chasseur solitaire" [level=4] [ref=e160]
                - paragraph [ref=e161]: Une ville cauchemardesque du centre des États-Unis piège tous ceux qui y entrent. Alors que les habitants se battent pour conserver un sentiment de normalité et cherchent une issue, ils doivent également survivre aux menaces de la forêt environnante.
                - generic [ref=e162]: 52m
            - generic [ref=e163] [cursor=pointer]:
              - img "Un plan imparable" [ref=e165]
              - generic [ref=e166]:
                - generic [ref=e167]:
                  - generic [ref=e168]: "7."
                  - heading "Un plan imparable" [level=4] [ref=e169]
                - paragraph [ref=e170]: Boyd teste une théorie dangereuse, et les choses changent pour un des résidents.
                - generic [ref=e171]: 51m
            - generic [ref=e172] [cursor=pointer]:
              - img "Lourde est la tête" [ref=e174]
              - generic [ref=e175]:
                - generic [ref=e176]:
                  - generic [ref=e177]: "8."
                  - heading "Lourde est la tête" [level=4] [ref=e178]
                - paragraph [ref=e179]: Un plan dangereux voit le jour. Jusqu'où Boyd est-il prêt à aller pour sauver tout le monde ?
                - generic [ref=e180]: 58m
            - generic [ref=e181] [cursor=pointer]:
              - img "Le calme avant" [ref=e183]
              - generic [ref=e184]:
                - generic [ref=e185]:
                  - generic [ref=e186]: "9."
                  - heading "Le calme avant" [level=4] [ref=e187]
                - paragraph [ref=e188]: Les habitants sont à une croisée des chemins à laquelle ils n'ont jamais fait face, tandis que Boyd met en œuvre un plan audacieux mais dangereux.
                - generic [ref=e189]: 47m
            - generic [ref=e190] [cursor=pointer]:
              - img "Un arbre qui tombe dans la forêt" [ref=e192]
              - generic [ref=e193]:
                - generic [ref=e194]:
                  - generic [ref=e195]: "10."
                  - heading "Un arbre qui tombe dans la forêt" [level=4] [ref=e196]
                - paragraph [ref=e197]: La quête de Boyd pour ramener les résidents eux atteint un tournant terrifiant, et rien ne sera plus jamais pareil.
                - generic [ref=e198]: 49m
  - contentinfo [ref=e199]:
    - generic [ref=e200]:
      - generic [ref=e201]:
        - generic [ref=e202]:
          - heading "CHILLERS" [level=3] [ref=e203]
          - paragraph [ref=e204]: L'expérience ultime du streaming gratuit. Films, séries, anime — accès instantané, zéro pub.
          - paragraph [ref=e205]: Chillers ne stocke aucun fichier. Tout contenu est hébergé par des tiers non affiliés. À des fins éducatives uniquement.
        - generic [ref=e206]:
          - heading "Liens" [level=4] [ref=e207]
          - list [ref=e208]:
            - listitem [ref=e209]:
              - link "À Propos" [ref=e210] [cursor=pointer]:
                - /url: /about
                - img [ref=e211]
                - text: À Propos
            - listitem [ref=e213]:
              - link "Contact" [ref=e214] [cursor=pointer]:
                - /url: /contact
                - img [ref=e215]
                - text: Contact
            - listitem [ref=e218]:
              - link "Soutenir" [ref=e219] [cursor=pointer]:
                - /url: /support
                - img [ref=e220]
                - text: Soutenir
            - listitem [ref=e222]:
              - link "Politique de confidentialité" [ref=e223] [cursor=pointer]:
                - /url: /privacy
                - img [ref=e224]
                - text: Politique de confidentialité
        - generic [ref=e226]:
          - heading "Categories" [level=4] [ref=e227]
          - list [ref=e228]:
            - listitem [ref=e229]:
              - link "Action & Adventure" [ref=e230] [cursor=pointer]:
                - /url: "#"
                - img [ref=e231]
                - text: Action & Adventure
            - listitem [ref=e233]:
              - link "Sci-Fi & Cyberpunk" [ref=e234] [cursor=pointer]:
                - /url: "#"
                - img [ref=e235]
                - text: Sci-Fi & Cyberpunk
            - listitem [ref=e237]:
              - link "Anime Blockbusters" [ref=e238] [cursor=pointer]:
                - /url: "#"
                - img [ref=e239]
                - text: Anime Blockbusters
            - listitem [ref=e241]:
              - link "Cultural Documentaries" [ref=e242] [cursor=pointer]:
                - /url: "#"
                - img [ref=e243]
                - text: Cultural Documentaries
        - generic [ref=e245]:
          - heading "Soutenir" [level=4] [ref=e246]
          - paragraph [ref=e247]: Le projet vit grâce à vos dons. Orange Money & Mobile Money acceptés.
          - link "Nous soutenir" [ref=e248] [cursor=pointer]:
            - /url: /support
            - img [ref=e249]
            - text: Nous soutenir
        - generic [ref=e251]:
          - heading "Join the Chill" [level=4] [ref=e252]
          - paragraph [ref=e253]: Follow us on social channels to keep up with premier releases.
          - generic [ref=e254]:
            - link "𝕏" [ref=e255] [cursor=pointer]:
              - /url: "#"
            - link "f" [ref=e256] [cursor=pointer]:
              - /url: "#"
            - link [ref=e257] [cursor=pointer]:
              - /url: "#"
              - img [ref=e258]
            - link "▶" [ref=e261] [cursor=pointer]:
              - /url: "#"
      - generic [ref=e262]:
        - generic [ref=e263]: © 2026 Chillers. No rights reserved.
        - generic [ref=e264]:
          - link "À Propos" [ref=e265] [cursor=pointer]:
            - /url: /about
            - img [ref=e266]
            - text: À Propos
          - generic [ref=e268]: •
          - link "Contact" [ref=e269] [cursor=pointer]:
            - /url: /contact
            - img [ref=e270]
            - text: Contact
          - generic [ref=e273]: •
          - link "Confidentialité" [ref=e274] [cursor=pointer]:
            - /url: /privacy
            - img [ref=e275]
            - text: Confidentialité
  - generic [ref=e281] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e282]:
      - img [ref=e283]
    - generic [ref=e286]:
      - button "Open issues overlay" [ref=e287]:
        - generic [ref=e288]:
          - generic [ref=e289]: "0"
          - generic [ref=e290]: "1"
        - generic [ref=e291]: Issue
      - button "Collapse issues badge" [ref=e292]:
        - img [ref=e293]
  - alert [ref=e295]
```

# Test source

```ts
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
> 115 |         expect(playbackState!.paused).toBe(false);
      |                                       ^ Error: expect(received).toBe(expected) // Object.is equality
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
  147 |           await page.screenshot({ path: `e2e-serie-fail-${testInfo.project.name}.png`, fullPage: true });
  148 |           throw err;
  149 |         }
  150 |       }
  151 |     }
  152 |   });
  153 | });
  154 | 
```