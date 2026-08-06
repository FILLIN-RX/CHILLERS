const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const url = "https://strm3.uqload.is/v/04/05394/7x2am3fewkd8_n/87kao37lf3gw_n.mp4?t=g3Xr4e-7F-LAsenQPjD1vlOnd9vpYm_H-Voqm03gcXs&s=1786042106&e=43200&v=&sp=500&i=0.3";
  console.log("\n[A] Browser direct MP4 URL:");
  const resp = await ctx.request.get(url, { failOnStatusCode: false });
  console.log(`    status: ${resp.status()}`);
  console.log(`    content-type: ${resp.headers()['content-type'] || '∅'}`);
  const body = await resp.body();
  console.log(`    body length: ${body.length}`);
  if (resp.status() === 200) {
    const hdr = body.subarray(0, 16).toString('hex');
    console.log(`    header: ${hdr}`);
    console.log(`    isMp4: ${body.subarray(4, 8).toString() === 'ftyp'}`);
  } else {
    console.log(`    preview: ${body.toString('utf8', 0, 200)}`);
  }
  await browser.close();
})();
