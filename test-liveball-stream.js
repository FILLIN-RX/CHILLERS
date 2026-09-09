const CloudScraper = require('cloudscraper');

async function testStreamResolution() {
  const MATCH_ID = '1635643';
  
  console.log('='.repeat(60));
  console.log('Testing Stream Resolution with CloudScraper');
  console.log('Match ID:', MATCH_ID);
  console.log('='.repeat(60));
  
  try {
    // Step 1: Fetch page
    console.log('\n[Step 1] Fetching match page...');
    const pageResponse = await CloudScraper.get(
      `https://liveball.sx/match/${MATCH_ID}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      }
    );
    
    console.log('✓ Got page (' + pageResponse.length + ' bytes)');
    
    // Step 2: Extract token using simple regex
    console.log('\n[Step 2] Extracting token...');
    const tokenMatch = pageResponse.match(/"t":"([^"]+)"/);
    if (!tokenMatch) {
      console.error('❌ No token found');
      return false;
    }
    
    const token = tokenMatch[1];
    console.log('✓ Token extracted:', token.substring(0, 40) + '...');
    
    // Step 3: Post to API with CloudScraper
    console.log('\n[Step 3] Posting to /api/c/r with CloudScraper...');
    const payload = JSON.stringify({ t: token, f: '0' });
    
    const apiResponse = await CloudScraper.post(
      'https://liveball.sx/api/c/r',
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Referer': `https://liveball.sx/match/${MATCH_ID}`,
          'Content-Length': payload.length.toString(),
        },
        body: payload,
        json: true,
      }
    );
    
    console.log('✓ API responded');
    
    // Step 4: Parse response
    console.log('\n[Step 4] Parsing stream data...');
    let parsed = apiResponse;
    if (typeof apiResponse === 'string') {
      parsed = JSON.parse(apiResponse);
    }
    
    if (parsed.e) {
      console.error('❌ API Error:', parsed.e);
      return false;
    }
    
    if (!parsed.d) {
      console.error('❌ No stream data in response');
      return false;
    }
    
    const streamUrl = Buffer.from(parsed.d, 'base64').toString('utf8').trim();
    console.log('✓ Stream URL decoded');
    console.log('  URL:', streamUrl.substring(0, 100) + '...');
    
    if (!streamUrl.match(/\.m3u8/)) {
      console.error('❌ Invalid m3u8 URL');
      return false;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ SUCCESS: Stream resolved!');
    console.log('='.repeat(60));
    return true;
    
  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    if (err.response) {
      console.error('Response status:', err.response.status);
    }
    return false;
  }
}

testStreamResolution().then(success => {
  process.exit(success ? 0 : 1);
});
