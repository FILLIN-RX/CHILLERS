import test from 'node:test';
import assert from 'node:assert/strict';

import { cacheTtlFor, isEmbedOrHtml, normalizeDirectUrl } from '../../../utils/stream-result';
import { DEFAULT_EXPIRY_MARGIN_SECONDS, hasSignedLinkExpiry, isSignedLinkExpired } from '../../../utils/link-ttl';
import { isDeadEmbedPage, normalizeEmbedInput } from '../providers/direct-scraper';

const WEAK_TTL = 10 * 60 * 1000;

test('une page embed n est jamais une URL directe', () => {
  assert.equal(isEmbedOrHtml('https://uqload.vc/embed-0palt3je2cdr.html'), true);
  assert.equal(isEmbedOrHtml('https://vidzy.org/embed-sx2iet0pkd8p.html'), true);
  assert.equal(isEmbedOrHtml('https://u14.vidzy.cc/v/05/00040/x/X.m3u8?t=a&s=1&e=2'), false);
  assert.equal(normalizeDirectUrl('https://vidzy.org/embed-sx2iet0pkd8p.html'), undefined);
  assert.equal(
    normalizeDirectUrl('https://u14.vidzy.cc/v/05/00040/x/X.m3u8?t=a&s=1&e=2'),
    'https://u14.vidzy.cc/v/05/00040/x/X.m3u8?t=a&s=1&e=2',
  );
});

test('un embed sans URL directe est caché court, pas 24 h', () => {
  assert.equal(cacheTtlFor({ provider: 'frenchstream' }, { weakTtl: WEAK_TTL }), WEAK_TTL);
  assert.equal(
    cacheTtlFor({ provider: 'frenchstream', directUrl: 'https://vidzy.org/embed-x.html' }, { weakTtl: WEAK_TTL }),
    WEAK_TTL,
  );
  assert.equal(
    cacheTtlFor(
      { provider: 'frenchstream', directUrl: 'https://u14.vidzy.cc/v/x/X.m3u8' },
      { weakTtl: WEAK_TTL },
    ),
    undefined,
  );
  assert.equal(
    cacheTtlFor({ provider: 'oha' }, { weakTtl: WEAK_TTL, ohaTtl: 30 * 60 * 1000 }),
    30 * 60 * 1000,
  );
});

test('la page « File is no longer available » est détectée', () => {
  const dead = '<html><body><div>File is no longer available as it expired or has been deleted.</div></body></html>';
  assert.equal(isDeadEmbedPage(dead), true);
  assert.equal(isDeadEmbedPage('<html><body><video src="https://cdn/x.m3u8"></video></body></html>'), false);
});

test('un code nu est normalisé en embed Uqload', () => {
  assert.equal(normalizeEmbedInput('w5rBLBCyDBiz'), 'https://uqload.is/embed-w5rBLBCyDBiz.html');
  assert.equal(
    normalizeEmbedInput('https://uqload.is/embed-0palt3je2cdr.html'),
    'https://uqload.is/embed-0palt3je2cdr.html',
  );
});

test('marge d expiration alignée sur 120 s', () => {
  assert.equal(DEFAULT_EXPIRY_MARGIN_SECONDS, 120);
  const now = Math.floor(Date.now() / 1000);
  const url = `https://u14.vidzy.cc/v/x.m3u8?t=abc&s=${now}&e=${now + 60}`;
  assert.equal(hasSignedLinkExpiry(url), true);
  assert.equal(isSignedLinkExpired(url), true);
  assert.equal(isSignedLinkExpired(url, 0), false);
  assert.equal(hasSignedLinkExpiry('https://uqload.is/embed-0palt3je2cdr.html'), false);
  assert.equal(isSignedLinkExpired('https://uqload.is/embed-0palt3je2cdr.html'), false);
});
