const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const url = 'https://strm3.uqload.is/hls2/04/05394/7x2am3fewkd8_,l,n,.urlset/master.m3u8?t=JGo5AP41fS0xgOZ5hf1ix3t93k1EwW3M_cGTaMS99gA&s=1786041720&e=43200&v=&i=0.3&sp=0';
  console.log(`Test from browser:\n${url}\n`);

  try {
    const resp = await ctx.request.get(url, { failOnStatusCode: false });
    console.log(`status: ${resp.status()}`);
    console.log(`content-type: ${resp.headers()['content-type'] || '∅'}`);
    const body = await resp.body();
    console.log(`body length: ${body.length}`);
    console.log(`body preview: ${body.toString('utf8', 0, 200)}`);
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  await browser.close();
})();
