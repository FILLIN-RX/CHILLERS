/**
 * @jest-environment jsdom
 */

import {
  isIOS,
  streamDownloadToDisk,
} from '@/services/streamSaver';
import {
  proxyDownloadHref,
  resolveDownloadUrl,
  verifyDownloadStarted,
  getPremiumDownloadUrl,
} from '@/services/downloads';

describe('Download Service & Platform Detection (Normal vs iOS)', () => {
  const originalUserAgent = navigator.userAgent;
  const originalPlatform = navigator.platform;
  const originalMaxTouchPoints = navigator.maxTouchPoints;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    Object.defineProperty(navigator, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: originalMaxTouchPoints,
      configurable: true,
    });
    jest.restoreAllMocks();
  });

  describe('isIOS() detection', () => {
    it('detects iPhone Safari as iOS', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        configurable: true,
      });
      expect(isIOS()).toBe(true);
    });

    it('detects iPad as iOS', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
        configurable: true,
      });
      expect(isIOS()).toBe(true);
    });

    it('detects iPadOS desktop-class browser (MacIntel + multi-touch)', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        configurable: true,
      });
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      });
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 5,
        configurable: true,
      });
      expect(isIOS()).toBe(true);
    });

    it('identifies standard Desktop Chrome as normal browser (NOT iOS)', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        configurable: true,
      });
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true,
      });
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 0,
        configurable: true,
      });
      expect(isIOS()).toBe(false);
    });

    it('identifies standard Desktop Firefox as normal browser (NOT iOS)', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
        configurable: true,
      });
      expect(isIOS()).toBe(false);
    });

    it('identifies Android Chrome as normal browser (NOT iOS)', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        configurable: true,
      });
      expect(isIOS()).toBe(false);
    });

    it('identifies Mac Safari without touch as desktop Mac (NOT iOS)', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        configurable: true,
      });
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      });
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 0,
        configurable: true,
      });
      expect(isIOS()).toBe(false);
    });
  });

  describe('streamDownloadToDisk() on iOS Browsers', () => {
    beforeEach(() => {
      // Configurer comme un appareil iOS (iPhone Safari)
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        configurable: true,
      });
    });

    it('triggers native iOS download via an anchor click without WritableStream/StreamSaver', async () => {
      const clickSpy = jest.fn();
      const appendChildSpy = jest.spyOn(document.body, 'appendChild');

      // Mock createElement pour capturer l'élément 'a'
      const origCreateElement = document.createElement.bind(document);
      jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = origCreateElement(tagName);
        if (tagName === 'a') {
          el.click = clickSpy;
        }
        return el;
      });

      const abortCtrl = new AbortController();
      const result = await streamDownloadToDisk('https://cdn.example.com/video.mp4', {
        filename: 'mon-film.mp4',
        signal: abortCtrl.signal,
      });

      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalledTimes(1);

      // Vérifie les attributs requis pour iOS
      const createdAnchor = appendChildSpy.mock.calls.find(
        ([node]) => (node as HTMLElement).tagName === 'A'
      )?.[0] as HTMLAnchorElement;

      expect(createdAnchor).toBeDefined();
      expect(createdAnchor.href).toBe('https://cdn.example.com/video.mp4');
      expect(createdAnchor.download).toBe('mon-film.mp4');
      expect(createdAnchor.target).toBe('_blank');
      expect(createdAnchor.rel).toContain('noopener');

      // Sur iOS Safari, streamSaver est contourné et retourne totalBytes: null
      expect(result).toEqual({ totalBytes: null });
    });

    it('handles relative /api/ URLs on iOS by prepending backend origin', async () => {
      const clickSpy = jest.fn();
      jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLElement;
        if (tagName === 'a') {
          el.click = clickSpy;
        }
        return el;
      });

      const abortCtrl = new AbortController();
      await streamDownloadToDisk('/api/download/file?url=abc', {
        filename: 'test.mp4',
        signal: abortCtrl.signal,
      });

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('proxyDownloadHref() & URL formatting', () => {
    it('wraps generic external URLs with backend proxy', () => {
      const href = proxyDownloadHref('https://cdn.example.com/stream.mp4', 'movie.mp4');
      expect(href).toContain('/download/file?url=https%3A%2F%2Fcdn.example.com%2Fstream.mp4');
      expect(href).toContain('filename=movie.mp4');
    });

    it('keeps existing /api/ URLs intact without double wrapping', () => {
      const href = proxyDownloadHref('/api/download/stream?title=Test', 'test.mp4');
      expect(href).toBe('/api/download/stream?title=Test');
    });

    it('returns direct doodstream download link as-is', () => {
      const doodUrl = 'https://doodstream.com/d/abc123xyz';
      const href = proxyDownloadHref(doodUrl, 'dood.mp4');
      expect(href).toBe(doodUrl);
    });

    it('generates valid premium download URL', () => {
      const url = getPremiumDownloadUrl('Inception', 'Inception.2010.mp4');
      expect(url).toContain('/download/premium?title=Inception');
      expect(url).toContain('filename=Inception.2010.mp4');
    });
  });

  describe('verifyDownloadStarted()', () => {
    it('returns true when Range: bytes=0-0 returns a valid byte stream', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-length': '1' }),
        body: {
          getReader: () => ({
            read: jest.fn().mockResolvedValue({
              value: new Uint8Array([0x00]),
              done: false,
            }),
            releaseLock: jest.fn(),
          }),
        },
      } as any);

      const verified = await verifyDownloadStarted('https://cdn.example.com/test.mp4');
      expect(verified).toBe(true);
    });

    it('returns false when the server returns HTTP error status', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
      } as any);

      const verified = await verifyDownloadStarted('https://cdn.example.com/forbidden.mp4');
      expect(verified).toBe(false);
    });
  });
});
