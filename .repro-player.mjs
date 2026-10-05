import { chromium } from 'playwright';
const URL = 'http://localhost:3000/watch/634649';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });

for (const w of [320, 360, 390]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  try { await page.getByText('Fermer', { exact: true }).first().click({ timeout: 3000 }); } catch {}
  await page.evaluate(async () => { const v = document.querySelector('video'); if (v) { v.muted = true; try { await v.play(); } catch {} } });
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const root = document.querySelector('[class*="group/container"]');
    const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { l: +b.left.toFixed(1), r: +b.right.toFixed(1), w: +b.width.toFixed(1) }; };
    const q = (s) => root?.querySelector(s);
    // lignes de contrôle
    const rows = [...(root?.querySelectorAll('div.flex.items-center.justify-between') || [])].map(rect);
    const time = [...(root?.querySelectorAll('span.tabular-nums') || [])].map(rect);
    const rightGroup = [...(root?.querySelectorAll('div') || [])].filter(d => typeof d.className === 'string' && d.className.includes('gap-0.5')).map(rect);
    const btns = [...(root?.querySelectorAll('button') || [])].filter(b => /Plein écran|Paramètres|Lecteur réduit \(i\)/.test(b.getAttribute('aria-label') || b.title || b.textContent || '')).map(b => ({ t: (b.getAttribute('aria-label') || b.title || '').slice(0, 30), ...rect(b) }));
    const video = rect(root?.querySelector('video'));
    const title = rect(root?.querySelector('span.truncate, .truncate'));
    return { vw: document.documentElement.clientWidth, root: rect(root), rows, time, rightGroup, btns, video, title };
  });
  console.log(`\n### width=${r.vw}`);
  console.log(' root  ', JSON.stringify(r.root));
  console.log(' video ', JSON.stringify(r.video));
  console.log(' rows  ', JSON.stringify(r.rows));
  console.log(' time  ', JSON.stringify(r.time));
  console.log(' title ', JSON.stringify(r.title));
  console.log(' rightGroups', JSON.stringify(r.rightGroup));
  r.btns.forEach(b => console.log('  btn:', JSON.stringify(b)));
  await ctx.close();
}
await browser.close();
