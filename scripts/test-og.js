const https = require('https');

const urls = [
  { name: 'Game of Thrones (Série)', url: 'https://chillers-pi.vercel.app/watch/1399?type=tv' },
  { name: 'House of the Dragon (Série)', url: 'https://chillers-pi.vercel.app/watch/94997?type=tv' },
  { name: 'Spider-Man: No Way Home (Film)', url: 'https://chillers-pi.vercel.app/watch/634649?type=movie' },
  { name: 'Spider-Man (2002) (Film)', url: 'https://chillers-pi.vercel.app/watch/557?type=movie' },
  { name: 'Spider-Man: Across the Spider-Verse', url: 'https://chillers-pi.vercel.app/watch/569094?type=movie' },
  { name: 'Supergirl (Film testé avant)', url: 'https://chillers-pi.vercel.app/watch/1081003?type=movie' },
];

function fetchMeta(item) {
  return new Promise((resolve) => {
    https.get(item.url, (res) => {
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => {
        console.log('\n======================================================');
        console.log(`🎬 ${item.name}`);
        console.log(`🔗 URL: ${item.url}`);
        console.log(`📡 HTTP Status: ${res.statusCode}`);

        const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || 'N/A';
        const ogTitle = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i) ||
                         html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i) || [])[1] || 'N/A';
        const ogImage = (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i) ||
                         html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:image["']/i) || [])[1] || 'N/A';
        const ogDesc = (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i) ||
                        html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i) || [])[1] || 'N/A';
        const twImage = (html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']*)["']/i) ||
                         html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']twitter:image["']/i) || [])[1] || 'N/A';

        console.log(`📌 Title: ${title}`);
        console.log(`🏷️  OG Title: ${ogTitle}`);
        console.log(`🖼️  OG Image: ${ogImage}`);
        console.log(`📝 OG Desc: ${ogDesc}`);
        console.log(`🐦 Twitter Image: ${twImage}`);

        const isCustomImage = ogImage.includes('image.tmdb.org');
        console.log(isCustomImage ? '✅ TMDB Poster/Backdrop OK !' : '⚠️ Image par défaut CHILLERS');
        resolve();
      });
    }).on('error', (err) => {
      console.log(`❌ Erreur sur ${item.url}:`, err.message);
      resolve();
    });
  });
}

async function run() {
  for (const item of urls) {
    await fetchMeta(item);
  }
}

run();
