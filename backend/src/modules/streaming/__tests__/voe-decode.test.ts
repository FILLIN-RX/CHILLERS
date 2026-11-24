import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeEmbedUrl, decodeVoePayload, extractVoeSources } from '../providers/direct-scraper';

const SEPARATORS = ['@$', '^^', '~@', '%?', '*~', '!!', '#&'];

function rot13(value: string): string {
  return value.replace(/[A-Za-z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

/** Encodeur inverse du décodeur VOE, calqué sur l'obfuscation observée. */
function encodeVoePayload(payload: Record<string, unknown>): string {
  const first = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  const reversed = Array.from(first).reverse().join('');
  const shifted = Array.from(reversed)
    .map((c) => String.fromCharCode(c.charCodeAt(0) + 3))
    .join('');
  const second = Buffer.from(shifted, 'utf8').toString('base64');

  let separated = '';
  for (let i = 0; i < second.length; i++) {
    separated += second[i];
    if (i > 0 && i % 17 === 0) separated += SEPARATORS[(i / 17) % SEPARATORS.length];
  }

  return rot13(separated);
}

test('un payload VOE obfusqué est décodé (source HLS + mp4 direct)', () => {
  const payload = {
    source: 'https://cloudwindow-route.com/engine/hls2-c/x/master.m3u8?t=abc',
    direct_access_url: 'https://cloudwindow-route.com/engine/mp4/x.mp4?t=abc',
    uid: '42',
  };

  const decoded = decodeVoePayload(encodeVoePayload(payload));

  assert.equal(decoded?.source, payload.source);
  assert.equal(decoded?.direct_access_url, payload.direct_access_url);
});

test('un payload VOE corrompu renvoie null sans lever', () => {
  assert.equal(decodeVoePayload('pas-du-tout-un-blob'), null);
  assert.equal(decodeVoePayload(''), null);
});

test('extractVoeSources ignore la vidéo leurre et garde la vraie source', () => {
  const realHls = 'https://cloudwindow-route.com/engine/hls2-c/x/master.m3u8?t=abc';
  const realMp4 = 'https://cloudwindow-route.com/engine/mp4/x.mp4?t=abc';
  const blob = encodeVoePayload({ source: realHls, direct_access_url: realMp4 });
  const html = `
    <html><body>
      <script>var source='https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720p_1MB.mp4';</script>
      <script type="application/json">["${blob}"]</script>
    </body></html>`;

  const sources = extractVoeSources(html);

  assert.deepEqual(sources.map((s) => s.url), [realHls, realMp4]);
  assert.equal(sources[0].type, 'hls');
  assert.equal(sources[1].type, 'mp4');
});

test('extractVoeSources lit aussi l ancien format `hls` en clair', () => {
  const html = `<html><body><script>player.setup({ "hls": "https://cdn.example.com/x/master.m3u8" });</script></body></html>`;
  const sources = extractVoeSources(html);
  assert.deepEqual(sources, [{ url: 'https://cdn.example.com/x/master.m3u8', type: 'hls' }]);
});

test('decodeEmbedUrl décode les entités HTML et les slashs échappés', () => {
  assert.equal(
    decodeEmbedUrl('https://trakx.lol/voe3/newPlayer.php?id=abc&amp;x=1'),
    'https://trakx.lol/voe3/newPlayer.php?id=abc&x=1',
  );
  assert.equal(
    decodeEmbedUrl('https:\\/\\/vidzy.org\\/embed-abc.html'),
    'https://vidzy.org/embed-abc.html',
  );
});
