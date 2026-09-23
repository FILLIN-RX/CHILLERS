/* Frame-exact renderer: drives Intro.seek(t) in Chrome, pipes PNG frames
   straight into ffmpeg, and muxes the synthesised sound signature.
   node brand/intro/render.mjs --width 1920 --out brand/intro/out/x.mp4 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => [a.replace(/^--/, ''), all[i + 1]]).filter(([, v]) => v !== undefined)
);
const WIDTH = +(args.width || 1920);
const HEIGHT = Math.round((WIDTH * 9) / 16);
const FPS = +(args.fps || 60);
const DUR = 3.5;
const FRAMES = Math.round(DUR * FPS);
const OUT = args.out || `${ROOT}/out/chillers-intro-${HEIGHT}p${FPS}.mp4`;
const CHROME = args.chrome || '/usr/bin/google-chrome';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const wav = `${ROOT}/out/intro-audio.wav`;

const ffmpeg = spawn('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-vcodec', 'png', '-i', 'pipe:0',
  '-i', wav,
  '-c:v', 'libx264', '-preset', args.preset || 'slow', '-crf', String(args.crf ?? 16),
  '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '5.2',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
  '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
  '-movflags', '+faststart', '-shortest', OUT,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb', '--hide-scrollbars', '--disable-lcd-text'],
});
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') console.log('  [page]', m.text()); });
await page.goto(`${BASE}/index.html?render=1`, { waitUntil: 'load' });
await page.waitForFunction('window.__introReady === true', null, { timeout: 60000 });
console.log(`stage ${WIDTH}x${HEIGHT} @ ${FPS}fps — ${FRAMES} frames, strips:`, await page.evaluate('Intro.strips'));

// sound signature first: it is resolution independent
if (!fs.existsSync(wav)) {
  const bytes = await page.evaluate(async () => {
    const buf = await window.IntroAudio.render(48000);
    return Array.from(window.IntroAudio.toWav(buf));
  });
  fs.writeFileSync(wav, Uint8Array.from(bytes));
  console.log('audio  ', wav, (bytes.length / 1024).toFixed(0), 'KB');
}

const shot = () => page.screenshot({ clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT }, type: 'png', timeout: 120000 });
const t0 = Date.now();
for (let i = 0; i < FRAMES; i++) {
  await page.evaluate((t) => window.__seek(t), i / FPS);
  if (i % 10 === 0) process.stdout.write(`\r  frame ${i + 1}/${FRAMES}`);
  const buf = await shot();
  if (!ffmpeg.stdin.write(buf)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
}
console.log(`\r  frame ${FRAMES}/${FRAMES} — ${((Date.now() - t0) / 1000).toFixed(1)}s`);
ffmpeg.stdin.end();
await new Promise((r) => ffmpeg.on('close', r));
await browser.close();
server.close();
console.log('video  ', OUT, (fs.statSync(OUT).size / 1048576).toFixed(1), 'MB');
