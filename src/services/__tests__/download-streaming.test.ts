/**
 * @jest-environment jsdom
 */

import { ReadableStream, WritableStream } from 'stream/web';
(global as any).ReadableStream = ReadableStream;
(global as any).WritableStream = WritableStream;

import { streamDownloadToDisk } from '@/services/streamSaver';

// Mock streamsaver module
const mockWriter = {
  write: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  abort: jest.fn().mockResolvedValue(undefined),
};

const mockCreateWriteStream = jest.fn().mockReturnValue({
  getWriter: () => mockWriter,
});

jest.mock('streamsaver', () => ({
  __esModule: true,
  default: {
    mitm: '',
    createWriteStream: (...args: any[]) => mockCreateWriteStream(...args),
  },
}));

describe('Normal Browser Streaming (Desktop Chrome / Android / StreamSaver)', () => {
  const originalUserAgent = navigator.userAgent;
  const originalPlatform = navigator.platform;
  const originalMaxTouchPoints = navigator.maxTouchPoints;

  beforeEach(() => {
    // Standard Desktop Chrome User-Agent
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

    jest.clearAllMocks();
  });

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
  });

  it('streams chunks to disk via StreamSaver and emits throttled progress', async () => {
    const chunk1 = new Uint8Array([1, 2, 3, 4]);
    const chunk2 = new Uint8Array([5, 6, 7, 8]);
    const totalBytes = 8;

    // Readable stream mock for fetch body
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk1);
        controller.enqueue(chunk2);
        controller.close();
      },
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': String(totalBytes) }),
      body: readable,
    } as any);

    const onProgress = jest.fn();
    const abortCtrl = new AbortController();

    const result = await streamDownloadToDisk('https://example.com/video.mp4', {
      filename: 'video.mp4',
      signal: abortCtrl.signal,
      onProgress,
      throttleMs: 0, // no throttle in test to verify emissions
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(fetchUrl).toContain('/download/file?url=');

    expect(mockCreateWriteStream).toHaveBeenCalledWith(
      'video.mp4',
      expect.objectContaining({
        size: totalBytes,
      })
    );

    expect(mockWriter.write).toHaveBeenCalledWith(chunk1);
    expect(mockWriter.write).toHaveBeenCalledWith(chunk2);
    expect(mockWriter.close).toHaveBeenCalled();

    expect(onProgress).toHaveBeenCalled();
    expect(result.totalBytes).toBe(totalBytes);
  });

  it('aborts cleanly when signal is aborted', async () => {
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        // ne ferme pas immédiatement
      },
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '100' }),
      body: readable,
    } as any);

    const abortCtrl = new AbortController();

    const downloadPromise = streamDownloadToDisk('https://example.com/video.mp4', {
      filename: 'aborted.mp4',
      signal: abortCtrl.signal,
    });

    // Abort en cours
    abortCtrl.abort();

    await expect(downloadPromise).rejects.toThrow();
  });
});
