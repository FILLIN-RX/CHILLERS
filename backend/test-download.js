const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    acceptDownloads: true,
  });

  for (const target of [
    { title: 'FROM', tmdbId: 124364, season: 1, episode: 1 },
    { title: 'Supergirl', tmdbId: 62688, season: 1, episode: 1 },
  ]) {
    console.log(`\n=== ${target.title} S${target.season}E${target.episode} ===\n`);

    // 1. Récupérer une URL fraîche via l'API backend
    const apiRes = await ctx.request.get(
      `http://localhost:4000/api/doodstream/download?title=${target.title}&tmdb_id=${target.tmdbId}&season=${target.season}&episode=${target.episode}`
    );
    const apiBody = await apiRes.json();
    const realUrl = apiBody.data.downloadUrl;
    console.log(`1) Fresh URL from API:`);
    console.log(`   ${realUrl.slice(0, 120)}`);
    console.log(`   uqloadCode: ${apiBody.data.uqloadCode}\n`);

    // 2. Demander le proxy backend avec cette URL
    const proxyUrl = `http://localhost:4000/api/doodstream/download/proxy?url=${encodeURIComponent(realUrl)}&filename=${target.title}-S${target.season}E${target.episode}.mp4`;
    console.log(`2) Calling proxy URL: ${proxyUrl.slice(0, 120)}...`);

    const page = await ctx.newPage();
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);

    // Naviguer vers l'URL proxy
    try {
      const resp = await page.goto(proxyUrl, { waitUntil: 'commit', timeout: 60000 });
      console.log(`   Initial response: ${resp?.status()} ${resp?.headers()['content-type'] || '∅'}`);
      console.log(`   Location: ${resp?.headers()['location']?.slice(0, 100) || '∅'}`);
    } catch (e) {
      console.log(`   Page load: ${e.message.slice(0, 100)}`);
    }

    const download = await downloadPromise;
    if (download) {
      const savePath = `/tmp/${download.suggestedFilename()}`;
      await download.saveAs(savePath);
      const stat = fs.statSync(savePath);
      const fd = fs.openSync(savePath, 'r');
      const buf = Buffer.alloc(16);
      fs.readSync(fd, buf, 0, 16, 0);
      fs.closeSync(fd);
      const isMp4 = buf.subarray(4, 8).toString() === 'ftyp';
      const isHls = buf.subarray(0, 7).toString() === '#EXTM3U';
      const isHtml = buf.subarray(0, 6).toString('utf8').toLowerCase().includes('<!doct') || buf.subarray(0, 6).toString('utf8').toLowerCase().includes('<html');

      console.log(`\n3) Download saved:`);
      console.log(`   file: ${savePath}`);
      console.log(`   size: ${stat.size} bytes`);
      console.log(`   header hex: ${buf.subarray(0, 16).toString('hex')}`);
      console.log(`   isMp4: ${isMp4}`);
      console.log(`   isHls: ${isHls}`);
      console.log(`   isHtml (403): ${isHtml}`);

      if (isHtml) {
        console.log(`\n   ❌ PROBLÈME : page HTML (probablement 403 ou redirect non suivi)`);
        console.log(`   Contenu: ${fs.readFileSync(savePath).toString('utf8', 0, 300)}`);
      } else if (isMp4) {
        console.log(`\n   ✅ MP4 valide reçu — ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
      } else if (isHls) {
        console.log(`\n   ✅ HLS m3u8 reçu`);
      }
    } else {
      console.log(`\n   ❌ Aucun download event déclenché`);
    }

    await page.close();
  }

  await browser.close();
})();
