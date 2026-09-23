/* Quick visual check: dump a few key frames without encoding video.
   node brand/intro/preview.mjs 0.2 0.5 1.4 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const W = +(process.env.W || 1280), H = Math.round((W * 9) / 16);
const TIMES = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
if (!TIMES.length) TIMES.push(0.2, 0.5, 0.8, 1.4, 2.0, 2.7, 3.3);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb', '--hide-scrollbars'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', (m) => console.log('  [' + m.type() + ']', m.text()));
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?render=1`);
await page.waitForFunction('window.__introReady === true', null, { timeout: 60000 });
console.log('canvas', await page.evaluate('__size()'), 'strips', await page.evaluate('Intro.strips'));

fs.mkdirSync(`${ROOT}/frames`, { recursive: true });
for (const t of TIMES) {
  await page.evaluate((x) => window.__seek(x), t);
  const f = `${ROOT}/frames/preview-${String(t).replace('.', 'p')}.png`;
  fs.writeFileSync(f, await page.locator('#c').screenshot({ type: 'png' }));
  console.log('wrote', f);
}
await browser.close();
server.close();
