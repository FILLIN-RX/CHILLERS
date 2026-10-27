import assert from 'node:assert/strict';
import test from 'node:test';
import { parseXmltv, parseXmltvTime } from '../xmltv';
import { buildEpgMapping } from '../epg-map';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="TF1.fr"><display-name>TF1</display-name></channel>
  <channel id="Canal+.Sport.fr"><display-name>Canal+ Sport</display-name></channel>
  <channel id="CANAL+SPORT.fr"><display-name>Canal+ Sport</display-name></channel>
  <channel id="MTV.fr"><display-name>MTV</display-name></channel>
  <channel id="WarnerTV.fr"><display-name>Warner TV</display-name></channel>
  <channel id="L&apos;Equipe.fr"><display-name>L&apos;Equipe</display-name></channel>

  <programme start="20261026120000 +0000" stop="20261026130000 +0000" channel="TF1.fr">
    <title>Journal de 12h</title>
    <desc>L&apos;actualité.</desc>
    <category>Information</category>
  </programme>
  <programme start="20261026130000 +0000" stop="20261026140000 +0000" channel="TF1.fr">
    <title>Feuilleton</title>
  </programme>

  <programme start="20261026120000 +0000" stop="20261026130000 +0000" channel="Canal+.Sport.fr">
    <title>Multiplex</title>
  </programme>
  <programme start="20261026120000 +0000" stop="20261026130000 +0000" channel="CANAL+SPORT.fr">
    <title>Multiplex</title>
  </programme>
  <programme start="20261026130000 +0000" stop="20261026140000 +0000" channel="CANAL+SPORT.fr">
    <title>Après-match</title>
  </programme>

  <programme start="20261026120000 +0000" stop="20261026130000 +0000" channel="MTV.fr">
    <title>Clips</title>
  </programme>
  <programme start="20261026120000 +0000" stop="20261026130000 +0000" channel="WarnerTV.fr">
    <title>Film</title>
  </programme>
  <programme start="20261026120000 +0000" stop="20261026130000 +0000" channel="L&apos;Equipe.fr">
    <title>L&apos;Équipe du soir</title>
  </programme>
</tv>`;

test('parse les chaînes, les programmes et les entités XML', () => {
  const parsed = parseXmltv(XML);
  assert.equal(parsed.channels.size, 6);
  assert.equal(parsed.programCount, 8);
  assert.deepEqual(parsed.channels.get("L'Equipe.fr"), ["L'Equipe"]);

  const tf1 = parsed.programs.get('TF1.fr');
  assert.equal(tf1?.length, 2);
  assert.equal(tf1?.[0].title, 'Journal de 12h');
  assert.equal(tf1?.[0].description, "L'actualité.");
  assert.equal(tf1?.[0].category, 'Information');
  assert.equal(new Date(tf1![0].start).toISOString(), '2026-10-26T12:00:00.000Z');
});

test('convertit les dates XMLTV avec fuseau', () => {
  assert.equal(
    new Date(parseXmltvTime('20261026120000 +0200')!).toISOString(),
    '2026-10-26T10:00:00.000Z',
  );
  assert.equal(
    new Date(parseXmltvTime('20261026120000 -0400')!).toISOString(),
    '2026-10-26T16:00:00.000Z',
  );
  assert.equal(parseXmltvTime('invalide'), null);
});

test('associe tvg exact, doublons, alias et refuse les faux positifs', () => {
  const parsed = parseXmltv(XML);
  const result = buildEpgMapping([
    { channelKey: 'tf1', name: 'TF1', tvg: 'TF1.fr' },
    { channelKey: 'canal-sport', name: 'CANAL+ SPORT', tvg: 'Canal+.Sport.fr' },
    { channelKey: 'canal-sport-1', name: 'CANAL+ SPORT 1', tvg: 'Canal+.Sport.1.fr' },
    { channelKey: 'mtv', name: 'MTV FRANCE' },
    { channelKey: 'warner', name: 'WARNER', tvg: 'Warner.fr' },
    { channelKey: 'lequipe', name: "L'EQUIPE", tvg: "L'Equipe.fr" },
  ], parsed);

  assert.equal(result.mappings.get('tf1')?.method, 'tvg');
  assert.equal(result.mappings.get('tf1')?.sourceId, 'TF1.fr');
  assert.equal(result.mappings.get('canal-sport')?.sourceId, 'CANAL+SPORT.fr');
  assert.equal(result.mappings.get('mtv')?.method, 'alias');
  assert.equal(result.mappings.get('mtv')?.sourceId, 'MTV.fr');
  assert.equal(result.mappings.get('lequipe')?.sourceId, "L'Equipe.fr");
  assert.equal(result.mappings.has('canal-sport-1'), false);
  assert.equal(result.mappings.has('warner'), false);
});
