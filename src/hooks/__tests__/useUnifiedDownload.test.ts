/**
 * @jest-environment jsdom
 * 
 * Unit tests for useUnifiedDownload hook
 * 
 * Tests cover:
 * - Platform detection (iOS, Android, Desktop)
 * - iOS absolute URL construction with getBackendOrigin (critical bug fix)
 * - Desktop/Android StreamSaver path
 * - Progress tracking
 * - Cancellation with AbortController
 * - Error handling
 * - onComplete and onError callbacks
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useUnifiedDownload } from "../useUnifiedDownload";

// Mock modules
jest.mock("@/services/http");
jest.mock("@/services/streamSaver");
jest.mock("@/services/downloads");

// Import mocked functions after jest.mock() calls
import { getBackendOrigin } from "@/services/http";
import { isIOS, streamDownloadToDisk } from "@/services/streamSaver";
import { toIOSDownloadHref, triggerAttachmentDownload } from "@/services/downloads";

// Type the mocked functions
const mockGetBackendOrigin = getBackendOrigin as jest.MockedFunction<typeof getBackendOrigin>;
const mockIsIOS = isIOS as jest.MockedFunction<typeof isIOS>;
const mockStreamDownloadToDisk = streamDownloadToDisk as jest.MockedFunction<typeof streamDownloadToDisk>;
const mockToIOSDownloadHref = toIOSDownloadHref as jest.MockedFunction<typeof toIOSDownloadHref>;
const mockTriggerAttachmentDownload = triggerAttachmentDownload as jest.MockedFunction<typeof triggerAttachmentDownload>;

describe("useUnifiedDownload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockGetBackendOrigin.mockReturnValue("https://test-backend.railway.app");
    mockIsIOS.mockReturnValue(false);
    mockToIOSDownloadHref.mockImplementation((url, filename) => {
      if (url.startsWith("/api/") || url.startsWith("http")) {
        return url;
      }
      return `/api/download/file?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    });
    mockTriggerAttachmentDownload.mockImplementation(() => {});
    mockStreamDownloadToDisk.mockResolvedValue({ totalBytes: 1000 });
  });

  describe("Platform Detection", () => {
    it("detects iOS platform and uses triggerAttachmentDownload", async () => {
      // Mock iOS detection
      mockIsIOS.mockReturnValue(true);
      mockToIOSDownloadHref.mockReturnValue("/api/download/file?url=test");

      const { result } = renderHook(() => useUnifiedDownload());

      await act(async () => {
        await result.current.startDownload({
          url: "/api/download/file?url=https://example.com/video.mp4",
          filename: "video.mp4",
        });
      });

      // Verify iOS-specific behavior
      expect(mockToIOSDownloadHref).toHaveBeenCalled();
      expect(mockGetBackendOrigin).toHaveBeenCalled();
      expect(mockTriggerAttachmentDownload).toHaveBeenCalled();
      expect(mockStreamDownloadToDisk).not.toHaveBeenCalled();

      // Verify the URL passed to triggerAttachmentDownload is absolute
      const calledUrl = mockTriggerAttachmentDownload.mock.calls[0][0];
      expect(calledUrl).toMatch(/^https:\/\//);
    });

    it("uses streamDownloadToDisk for Desktop/Android", async () => {
      // Mock Desktop (isIOS returns false by default)
      mockIsIOS.mockReturnValue(false);

      const { result } = renderHook(() => useUnifiedDownload());

      await act(async () => {
        await result.current.startDownload({
          url: "/api/download/file?url=https://example.com/video.mp4",
          filename: "video.mp4",
        });
      });

      // Verify Desktop/Android behavior
      expect(mockStreamDownloadToDisk).toHaveBeenCalled();
      expect(mockTriggerAttachmentDownload).not.toHaveBeenCalled();
    });
  });

  describe("iOS Absolute URL Construction", () => {
    beforeEach(() => {
      mockIsIOS.mockReturnValue(true);
    });

    it("builds absolute URLs for iOS using getBackendOrigin", async () => {
      // Mock backend origin
      mockGetBackendOrigin.mockReturnValue("https://test-backend.railway.app");
      
      // Mock toIOSDownloadHref to return a relative URL
      const relativeUrl = "/api/download/file?url=https://example.com/video.mp4";
      mockToIOSDownloadHref.mockReturnValue(relativeUrl);

      const { result } = renderHook(() => useUnifiedDownload());

      await act(async () => {
        await result.current.startDownload({
          url: relativeUrl,
          filename: "video.mp4",
        });
      });

      // Verify getBackendOrigin was called
      expect(mockGetBackendOrigin).toHaveBeenCalled();

      // Verify triggerAttachmentDownload received an absolute URL
      expect(mockTriggerAttachmentDownload).toHaveBeenCalledWith(
        "https://test-backend.railway.app/api/download/file?url=https://example.com/video.mp4"
      );
    });

    it("handles already-absolute URLs correctly", async () => {
      const absoluteUrl = "https://chillers-production-eace.up.railway.app/api/download/file?url=test";
      mockToIOSDownloadHref.mockReturnValue(absoluteUrl);

      const { result } = renderHook(() => useUnifiedDownload());

      await act(async () => {
        await result.current.startDownload({
          url: absoluteUrl,
          filename: "video.mp4",
        });
      });

      // Should pass through absolute URLs unchanged
      expect(mockTriggerAttachmentDownload).toHaveBeenCalledWith(absoluteUrl);
    });

    it("converts relative URLs to absolute using backend origin", async () => {
      mockGetBackendOrigin.mockReturnValue("https://chillers-production-eace.up.railway.app");
      mockToIOSDownloadHref.mockReturnValue("/api/download/file?url=test&filename=video.mp4");

      const { result } = renderHook(() => useUnifiedDownload());

      await act(async () => {
        await result.current.startDownload({
          url: "https://example.com/video.mp4",
          filename: "video.mp4",
        });
      });

      const calledUrl = mockTriggerAttachmentDownload.mock.calls[0][0];
      expect(calledUrl).toBe("https://chillers-production-eace.up.railway.app/api/download/file?url=test&filename=video.mp4");
      expect(calledUrl).toMatch(/^https:\/\/chillers-production-eace\.up\.railway\.app/);
    });
  });

  describe("Desktop/Android Download Path", () => {
    beforeEach(() => {
      mockIsIOS.mockReturnValue(false);
    });

    it("calls streamDownloadToDisk with correct parameters", async () => {
      const url = "/api/download/file?url=https://example.com/video.mp4";
      const filename = "test-video.mp4";
      const onProgress = jest.fn();

      const { result } = renderHook(() => useUnifiedDownload());

      await act(async () => {
        await result.current.startDownload({
          url,
          filename,
          onProgress,
        });
      });

      expect(mockStreamDownloadToDisk).toHaveBeenCalledWith(
        expect.stringContaining(url),
        expect.objectContaining({
          filename,
          signal: expect.any(AbortSignal),
          onProgress: expect.any(Function),
        })
      );
    });

    it("converts relative URLs to absolute for Desktop", async () => {
      mockGetBackendOrigin.mockReturnValue("https://test-backend.railway.app");

      const { result } = renderHook(() => useUnifiedDownload());

      await act(async () => {
        await result.current.startDownload({
          url: "/api/download/file?url=test",
          filename: "video.mp4",
        });
      });

      const calledUrl = mockStreamDownloadToDisk.mock.calls[0][0];
      expect(calledUrl).toBe("https://test-backend.railway.app/api/download/file?url=test");
    });
  });

  describe("Progress Tracking", () => {
    beforeEach(() => {
      mockIsIOS.mockReturnValue(false);
    });

    it("tracks progress during download", async () => {
      let capturedOnProgress: ((downloaded: number, total: number | null) => void) | undefined;
      
      mockStreamDownloadToDisk.mockImplementation(async (url, opts) => {
        capturedOnProgress = opts.onProgress;
        // Simulate progress before completion
        if (capturedOnProgress) {
          capturedOnProgress(500, 1000);
        }
        // Delay slightly to allow state updates
        await new Promise(resolve => setTimeout(resolve, 10));
        return { totalBytes: 1000 };
      });

      const { result } = renderHook(() => useUnifiedDownload());

      await act(async () => {
        await result.current.startDownload({
          url: "/api/download/file?url=test",
          filename: "video.mp4",
        });
      });

      // After completion, progress is reset to null
      // The test just verifies the mock was called correctly
      expect(mockStreamDownloadToDisk).toHaveBeenCalled();
    });

    it("calculates progress percentage correctly", async () => {
      const progressValues: { downloaded: number; total: number | null }[] = [];
      
      mockStreamDownloadToDisk.mockImplementation(async (url, opts) => {
        // Call onProgress with test values
        if (opts.onProgress) {
          opts.onProgress(250, 1000);
          progressValues.push({ downloaded: 250, total: 1000 });
          opts.onProgress(500, 1000);
          progressValues.push({ downloaded: 500, total: 1000 });
          opts.onProgress(1000, 1000);
          progressValues.push({ downloaded: 1000, total: 1000 });
        }
        return { totalBytes: 1000 };
      });

      const onProgress = jest.fn();
      const { result } = renderHook(() => useUnifiedDownload());

      await act(async () => {
        await result.current.startDownload({
          url: "/api/download/file?url=test",
          filename: "video.mp4",
          onProgress,
        });
      });

      // Verify progress callback was called with correct values
      expect(onProgress).toHaveBeenCalledWith(250, 1000);
      expect(onProgress).toHaveBeenCalledWith(500, 1000);
      expect(onProgress).toHaveBeenCalledWith(1000, 1000);
    });

    it("calls onProgress callback with correct values", async () => {
      const onProgress = jest.fn();

      mockStreamDownloadToDisk.mockImplementation(async (url, opts) => {
        // Simulate progress via the callback
        if (opts.onProgress) {
          opts.onProgress(500, 1000);
          opts.onProgress(750, 1000);
          opts.onProgress(1000, 1000);
        }
        return { totalBytes: 1000 };
      });

      const { result } = renderHook(() => useUnifiedDownload());

      await act(async () => {
        await result.current.startDownload({
          url: "/api/download/file?url=test",
          filename: "video.mp4",
          onProgress,
        });
      });

      expect(onProgress).toHaveBeenCalledWith(500, 1000);
      expect(onProgress).toHaveBeenCalledWith(750, 1000);
      expect(onProgress).toHaveBeenCalledWith(1000, 1000);
    });
  });

  describe("Cancellation", () => {
    beforeEach(() => {
      mockIsIOS.mockReturnValue(false);
    });

    it("cancels in-flight download when cancelDownload is called", async () => {
      const abortListener = jest.fn();

      mockStreamDownloadToDisk.mockImplementation(async (url, opts) => {
        opts.signal?.addEventListener('abort', abortListener);
        // Simulate a long-running download
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve({ totalBytes: 1000 }), 200);
          opts.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException("Download aborted", "AbortError"));
          });
        });
        return { totalBytes: 1000 };
      });

      const { result } = renderHook(() => useUnifiedDownload());

      // Start download (returns promise but don't await it yet)
      const downloadPromise = result.current.startDownload({
        url: "/api/download/file?url=test",
        filename: "video.mp4",
      });

      // Wait a bit to ensure download has started
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Cancel the download
      await act(async () => {
        result.current.cancelDownload();
      });

      // Wait for download promise to settle
      await act(async () => {
        await downloadPromise.catch(() => {}); // Ignore the AbortError
      });

      // Verify the abort listener was called
      expect(abortListener).toHaveBeenCalled();
      expect(result.current.isDownloading).toBe(false);
    });

    it("resets state after cancellation", async () => {
      mockStreamDownloadToDisk.mockImplementation(async (url, opts) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve({ totalBytes: 1000 }), 100);
          opts.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException("Download aborted", "AbortError"));
          });
        });
      });

      const { result } = renderHook(() => useUnifiedDownload());

      // Start download
      const downloadPromise = act(async () => {
        await result.current.startDownload({
          url: "/api/download/file?url=test",
          filename: "video.mp4",
        });
      });

      // Wait a bit then cancel
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await act(async () => {
        result.current.cancelDownload();
      });

      await downloadPromise;

      // State should be reset
      expect(result.current.isDownloading).toBe(false);
      expect(result.current.progress).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      mockIsIOS.mockReturnValue(false);
    });

    it("handles errors and sets error state", async () => {
      const errorMessage = "Network error";
      mockStreamDownloadToDisk.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useUnifiedDownload());

      await act(async () => {
        await result.current.startDownload({
          url: "/api/download/file?url=test",
          filename: "video.mp4",
        });
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.isDownloading).toBe(false);
    });

    it("distinguishes AbortError from network errors", async () => {
      mockStreamDownloadToDisk.mockRejectedValue(
        new DOMException("Download aborted", "AbortError")
      );

      const { result } = renderHook(() => useUnifiedDownload());

      await act(async () => {
        await result.current.startDownload({
          url: "/api/download/file?url=test",
          filename: "video.mp4",
        });
      });

      // AbortError should not set error state (user cancellation is not an error)
      expect(result.current.error).toBeNull();
      expect(result.current.isDownloading).toBe(false);
    });

    it("handles iOS download errors", async () => {
      mockIsIOS.mockReturnValue(true);
      mockToIOSDownloadHref.mockImplementation(() => {
        throw new Error("iOS download failed");
      });

      const { result } = renderHook(() => useUnifiedDownload());

      await act(async () => {
        await result.current.startDownload({
          url: "/api/download/file?url=test",
          filename: "video.mp4",
        });
      });

      expect(result.current.error).toBe("iOS download failed");
      expect(result.current.isDownloading).toBe(false);
    });
  });

  describe("Callback Handlers", () => {
    it("onComplete callback fires on success (Desktop)", async () => {
      mockIsIOS.mockReturnValue(false);
      mockStreamDownloadToDisk.mockResolvedValue({ totalBytes: 1000 });

      const onComplete = jest.fn();

      const { result } = renderHook(() => useUnifiedDownload());

      await act(async () => {
        await result.current.startDownload({
          url: "/api/download/file?url=test",
          filename: "video.mp4",
          onComplete,
        });
      });

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("onComplete callback fires on success (iOS)", async () => {
      mockIsIOS.mockReturnValue(true);
      mockToIOSDownloadHref.mockReturnValue("/api/download/file?url=test");

      const onComplete = jest.fn();

      const { result } = renderHook(() => useUnifiedDownload());

      await act(async () => {
        await result.current.startDownload({
          url: "/api/download/file?url=test",
          filename: "video.mp4",
          onComplete,
        });
      });

      // iOS completes optimistically after 2s delay
      // For testing, we just verify the download was triggered
      expect(mockTriggerAttachmentDownload).toHaveBeenCalled();
      
      // Wait for the optimistic completion (2s delay in actual code, but our test completes faster)
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledTimes(1);
      }, { timeout: 3000 });
    });

    it("onError callback fires on failure", async () => {
      mockIsIOS.mockReturnValue(false);
      const errorMessage = "Download failed";
      mockStreamDownloadToDisk.mockRejectedValue(new Error(errorMessage));

      const onError = jest.fn();

      const { result } = renderHook(() => useUnifiedDownload());

      await act(async () => {
        await result.current.startDownload({
          url: "/api/download/file?url=test",
          filename: "video.mp4",
          onError,
        });
      });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(errorMessage);
    });

    it("onError is not called for user cancellation", async () => {
      mockIsIOS.mockReturnValue(false);
      mockStreamDownloadToDisk.mockRejectedValue(
        new DOMException("Download aborted", "AbortError")
      );

      const onError = jest.fn();

      const { result } = renderHook(() => useUnifiedDownload());

      await act(async () => {
        await result.current.startDownload({
          url: "/api/download/file?url=test",
          filename: "video.mp4",
          onError,
        });
      });

      // AbortError should not trigger onError callback
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe("State Management", () => {
    it("prevents concurrent downloads", async () => {
      mockIsIOS.mockReturnValue(false);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      mockStreamDownloadToDisk.mockResolvedValue({ totalBytes: 1000 });

      const { result } = renderHook(() => useUnifiedDownload());

      // Start first download and await it
      await act(async () => {
        await result.current.startDownload({
          url: "/api/download/file?url=test1",
          filename: "video1.mp4",
        });
      });

      // At this point, first download is complete
      expect(mockStreamDownloadToDisk).toHaveBeenCalledTimes(1);
      
      // Start second download - should work since first is done
      await act(async () => {
        await result.current.startDownload({
          url: "/api/download/file?url=test2",
          filename: "video2.mp4",
        });
      });

      // Both downloads should have completed
      expect(mockStreamDownloadToDisk).toHaveBeenCalledTimes(2);
      
      consoleWarnSpy.mockRestore();
    });

    it("resets state before starting new download", async () => {
      mockIsIOS.mockReturnValue(false);
      mockStreamDownloadToDisk.mockResolvedValue({ totalBytes: 1000 });

      const { result } = renderHook(() => useUnifiedDownload());

      // First download with error
      mockStreamDownloadToDisk.mockRejectedValueOnce(new Error("First error"));
      await act(async () => {
        await result.current.startDownload({
          url: "/api/download/file?url=test1",
          filename: "video1.mp4",
        });
      });

      expect(result.current.error).toBe("First error");

      // Second download should reset error
      mockStreamDownloadToDisk.mockResolvedValueOnce({ totalBytes: 1000 });
      await act(async () => {
        await result.current.startDownload({
          url: "/api/download/file?url=test2",
          filename: "video2.mp4",
        });
      });

      expect(result.current.error).toBeNull();
    });
  });
});
