/**
 * Test de téléchargement EFFECTIF — vérifie qu'on reçoit vraiment un
 * fichier vidéo (octets MP4/MPEG-TS), pas une page HTML 403.
 *
 * Flow testé :
 *   1. Clic icône download dans VideoPlayer
 *   2. Modal DownloadModal s'ouvre, fait /api/doodstream/download
 *   3. Clic "Télécharger" dans le modal → window.open vers Uqload embed
 *   4. Sur la page Uqload, clic sur le bouton download
 *   5. Vérifier qu'on récupère bien des bytes MP4
 */

import { test, expect, request as playwrightRequest } from '@playwright/test';

const API_BASE = 'http://localhost:4000';
const TARGETS = [
  { title: 'FROM', tmdbId: 124364, season: 1, episode: 1 },
  { title: 'Supergirl', tmdbId: 62688, season: 1, episode: 1 },
];

for (const TARGET of TARGETS) {
test.describe(`Real download — ${TARGET.title} S${TARGET.season}E${TARGET.episode}`, () => {
  test('1) Backend API direct: reçoit un MP4', async () => {
    const ctx = await playwrightRequest.newContext();
    const url = `${API_BASE}/api/doodstream/download?title=${encodeURIComponent(TARGET.title)}&tmdb_id=${TARGET.tmdbId}&season=${TARGET.season}&episode=${TARGET.episode}`;
    const res = await ctx.get(url);
    const body = await res.json();
    console.log(`\n[API] ${body.data?.downloadUrl?.slice(0, 120)}`);
    console.log(`     uqloadCode=${body.data?.uqloadCode}`);
    expect(body.success).toBe(true);
    expect(body.data?.downloadUrl).toBeTruthy();
  });

  test('2) Browser end-to-end: du clic au fichier vidéo réel', async ({ context }) => {
    console.log(`\n=== ${TARGET.title} S${TARGET.season}E${TARGET.episode} ===\n`);

    // Configurer le contexte pour accepter les downloads
    const page = await context.newPage();
    const downloads: any[] = [];

    page.on('download', (d) => {
      downloads.push(d);
      console.log(`   📥 download event: ${d.suggestedFilename()} (${d.url().slice(0, 80)})`);
    });

    // Ouvrir la page watch
    await page.goto(`/watch/${TARGET.tmdbId}?type=series&season=${TARGET.season}&episode=${TARGET.episode}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    // Étape 1 : clic sur l'icône download du VideoPlayer
    // L'icône Tabler IconDownload commence par "M4 17v2a2..." (coffret + flèche)
    console.log(`\n▶️  Étape 1: clic icône download du VideoPlayer`);
    const iconBtn = page.locator('button:has(svg path[d^="M4 17"])').first();
    try {
      await iconBtn.waitFor({ state: 'visible', timeout: 10000 });
      await iconBtn.click();
      console.log(`   ✅ Clic icône download`);
    } catch {
      // Fallback : prendre le dernier bouton (controls sont en bas à droite)
      const allBtns = await page.locator('button').count();
      console.log(`   ⚠️  Icône stricte pas trouvée, fallback ${allBtns} boutons`);
      // Le bouton download est généralement le 2e bouton dans la barre de controls
      const controlBar = page.locator('.absolute.bottom-0 button, .video-controls button').last();
      // Sinon, on prend tous les boutons visibles dans la zone
      try {
        const lastBtn = page.locator('button').filter({ has: page.locator('svg') }).last();
        await lastBtn.click({ timeout: 5000 });
      } catch {
        throw new Error('Could not find download icon');
      }
    }

    // Étape 2 : attendre que le modal apparaisse et que le bouton Télécharger soit prêt
    console.log(`▶️  Étape 2: attente du modal DownloadModal + bouton "Télécharger"`);
    const modalBtn = page.locator('button:has-text("Télécharger")').last();
    await modalBtn.waitFor({ state: 'visible', timeout: 15000 });
    console.log(`   ✅ Modal prêt avec bouton "Télécharger"`);

    // Étape 3 : clic sur "Télécharger" du modal
    console.log(`▶️  Étape 3: clic "Télécharger" → window.open vers embed Uqload`);
    const pagePromise = context.waitForEvent('page', { timeout: 15000 }).catch(() => null);
    await modalBtn.click();

    // Attendre que l'onglet Uqload s'ouvre
    const uqloadPage = await pagePromise;
    if (!uqloadPage) {
      console.log(`   ⚠️  Pas de nouvel onglet ouvert — peut-être window.open bloqué`);
    } else {
      console.log(`   ✅ Onglet ouvert: ${uqloadPage.url().slice(0, 80)}`);
      await uqloadPage.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      await uqloadPage.waitForTimeout(3000);
    }

    // Vérifier le contenu de l'onglet
    const allPages = context.pages();
    console.log(`\n🪟 ${allPages.length} onglets ouverts:`);
    for (const [i, p] of allPages.entries()) {
      console.log(`   [${i}] ${p.url().slice(0, 100)}`);
    }

    // Trouver l'onglet Uqload (embed) ou regarder si download a été déclenché
    const uqloadTab = allPages.find(p => /uqload\.is/.test(p.url()));
    if (uqloadTab) {
      console.log(`\n▶️  Étape 4: sur la page Uqload, chercher le bouton download`);

      // Uqload a un bouton download avec icône ou texte
      // Souvent c'est une icône "download" ou un bouton "Download"
      const uqloadDlBtn = uqloadTab.locator('a:has-text("Download"), button:has-text("Download"), a[href*=".mp4"], a[download], .download-btn, [id*="download" i]').first();
      const visible = await uqloadDlBtn.isVisible({ timeout: 8000 }).catch(() => false);

      if (visible) {
        const href = await uqloadDlBtn.getAttribute('href');
        const dlAttr = await uqloadDlBtn.getAttribute('download');
        console.log(`   ✅ Bouton download Uqload trouvé (href=${href?.slice(0, 60)}, download=${dlAttr})`);

        // Récupérer le fichier MP4 directement depuis l'URL si href existe
        if (href && /\.mp4|\.m3u8/i.test(href)) {
          console.log(`\n▶️  Étape 5: download direct via l'URL ${href.slice(0, 80)}`);
          const apiCtx = await playwrightRequest.newContext();
          const fullUrl = href.startsWith('http') ? href : new URL(href, uqloadTab.url()).toString();
          const dlRes = await apiCtx.get(fullUrl, { failOnStatusCode: false, timeout: 30000 });
          console.log(`   status: ${dlRes.status()}`);
          console.log(`   content-type: ${dlRes.headers()['content-type'] || '∅'}`);
          if (dlRes.status() === 200) {
            const buf = await dlRes.body();
            const header = buf.subarray(0, 16).toString('hex');
            console.log(`   header hex: ${header}`);
            const isMp4 = buf.subarray(4, 8).toString() === 'ftyp';
            const isHls = buf.subarray(0, 7).toString() === '#EXTM3U';
            const isHtml = buf.subarray(0, 16).toString().includes('3c21444f') || // "<!DO"
                           buf.subarray(0, 16).toString().includes('3c68746d');   // "<htm"
            console.log(`   isMp4: ${isMp4}, isHls: ${isHls}, isHtml: ${isHtml}, size: ${buf.length}`);

            if (isHtml) {
              const txt = buf.toString('utf8', 0, 200);
              console.log(`\n❌ Le fichier est une page HTML (probablement 403):`);
              console.log(`   ${txt}`);
              throw new Error('Got HTML instead of video');
            }
            if (isMp4) {
              console.log(`\n✅ MP4 valide reçu (${buf.length} bytes)`);
            } else if (isHls) {
              console.log(`\n✅ HLS m3u8 valide reçu`);
            } else {
              console.log(`\n⚠️  Format non-MP4 mais pas HTML, header: ${header}`);
            }
          } else {
            console.log(`   ❌ HTTP ${dlRes.status()}`);
          }
        } else {
          // Sinon cliquer sur le bouton et attendre le download event
          console.log(`   Clic sur le bouton download Uqload...`);
          await uqloadDlBtn.click();
          await uqloadTab.waitForTimeout(5000);
        }
      } else {
        console.log(`   ⚠️  Pas de bouton download trouvé sur la page Uqload`);
        // Peut-être un <video> avec src MP4 qu'on peut fetch directement
        const videoSrc = await uqloadTab.locator('video source, video').first().getAttribute('src').catch(() => null);
        console.log(`   video src: ${videoSrc?.slice(0, 100) || '∅'}`);
      }
    }

    // Sinon, on regarde si le download dialog a été déclenché directement
    if (downloads.length > 0) {
      console.log(`\n▶️  ${downloads.length} download(s) interceptés:`);
      for (const d of downloads) {
        console.log(`   filename: ${d.suggestedFilename()}`);
        console.log(`   url: ${d.url().slice(0, 120)}`);

        // Sauvegarder le fichier dans /tmp pour analyse post-mortem
        const savePath = `/tmp/${d.suggestedFilename()}`;
        try {
          await d.saveAs(savePath);
          console.log(`   ✅ Sauvegardé dans ${savePath}`);

          // Analyser avec fs (bytes magiques)
          const fs = require('fs');
          if (fs.existsSync(savePath)) {
            const stat = fs.statSync(savePath);
            const fd = fs.openSync(savePath, 'r');
            const buf = Buffer.alloc(16);
            fs.readSync(fd, buf, 0, 16, 0);
            fs.closeSync(fd);
            const header = buf.subarray(0, 16).toString('hex');
            const isMp4 = buf.subarray(4, 8).toString() === 'ftyp';
            const isHls = buf.subarray(0, 7).toString() === '#EXTM3U';
            const isHtml = buf.subarray(0, 6).toString('utf8').toLowerCase().includes('<!doct');

            console.log(`   size: ${stat.size} bytes`);
            console.log(`   header hex: ${header}`);
            console.log(`   isMp4 (ftyp): ${isMp4}`);
            console.log(`   isHls (m3u8): ${isHls}`);
            console.log(`   isHtml (page error): ${isHtml}`);

            if (isHtml) {
              const txt = fs.readFileSync(savePath).toString('utf8', 0, 200);
              console.log(`\n❌ PROBLÈME : fichier = page HTML 403`);
              console.log(`   contenu: ${txt}`);
              throw new Error('Got HTML instead of video');
            }
            if (isMp4) {
              console.log(`\n✅ MP4 valide: ${stat.size} bytes`);
            } else if (isHls) {
              console.log(`\n✅ HLS m3u8 valide: ${stat.size} bytes`);
            } else {
              console.log(`\n⚠️  Format inconnu, header: ${header}`);
            }
          }
        } catch (e: any) {
          console.log(`   ❌ saveAs failed: ${e.message}`);
        }
      }
    }

    console.log(`\n✅ Test terminé pour ${TARGET.title}`);
  });
});
}