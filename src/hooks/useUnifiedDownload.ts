"use client";

import { useCallback, useState, useRef } from "react";
import { getBackendOrigin } from "@/services/http";
import { isIOS, streamDownloadToDisk } from "@/services/streamSaver";
import { toIOSDownloadHref, triggerAttachmentDownload } from "@/services/downloads";

/**
 * Options for unified download operation.
 */
export interface UnifiedDownloadOptions {
  /** The URL to download (relative or absolute). Relative URLs are converted to absolute backend URLs. */
  url: string;
  /** Suggested filename for the downloaded file. */
  filename: string;
  /** Progress callback fired during download (Desktop/Android only). */
  onProgress?: (bytesDownloaded: number, totalBytes: number | null) => void;
  /** Completion callback fired when download finishes successfully. */
  onComplete?: () => void;
  /** Error callback fired when download fails. */
  onError?: (error: string) => void;
  /** Enable debug logging. */
  debug?: boolean;
}

/**
 * Platform detection result.
 */
type Platform = "ios" | "android" | "desktop";

/**
 * Progress state for download tracking.
 */
interface ProgressState {
  downloaded: number;
  total: number | null;
  percent: number | null;
}

/**
 * Return value of the useUnifiedDownload hook.
 */
export interface UseUnifiedDownloadReturn {
  /** Start a download with the provided options. */
  startDownload: (options: UnifiedDownloadOptions) => Promise<void>;
  /** Cancel the currently running download. */
  cancelDownload: () => void;
  /** Whether a download is currently in progress. */
  isDownloading: boolean;
  /** Current download progress (Desktop/Android only). */
  progress: ProgressState | null;
  /** Error message if download failed. */
  error: string | null;
}

/**
 * Unified download hook that handles downloads across all platforms.
 * 
 * **Critical iOS Fix**: This hook ALWAYS builds absolute backend URLs using 
 * `getBackendOrigin()` for relative paths. In production, relative paths like 
 * `/api/download/file?...` would resolve to the frontend domain (chillers.site) 
 * instead of the backend (chillers-production-eace.up.railway.app), causing 
 * iOS downloads to fail. The hook ensures all URLs are absolute before passing 
 * them to `window.open()` on iOS.
 * 
 * **Platform Strategy**:
 * - **iOS (Safari)**: Uses native download manager via `window.open()` with 
 *   Content-Disposition: attachment headers. The tab auto-closes after 2s.
 * - **Desktop/Android**: Uses StreamSaver.js to stream bytes directly to disk 
 *   with progress tracking and cancellation support.
 * 
 * @returns Hook interface with `startDownload`, `cancelDownload`, `isDownloading`, `progress`, and `error`.
 * 
 * @example
 * ```tsx
 * const { startDownload, cancelDownload, isDownloading, progress, error } = useUnifiedDownload();
 * 
 * const handleDownload = async () => {
 *   await startDownload({
 *     url: '/api/download/file?url=https://example.com/video.mp4',
 *     filename: 'video.mp4',
 *     onProgress: (downloaded, total) => {
 *       console.log(`Downloaded ${downloaded} of ${total} bytes`);
 *     },
 *     onComplete: () => {
 *       console.log('Download complete!');
 *     },
 *     onError: (err) => {
 *       console.error('Download failed:', err);
 *     }
 *   });
 * };
 * ```
 */
export function useUnifiedDownload(): UseUnifiedDownloadReturn {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [platform] = useState<Platform>(detectPlatform());

  const abortControllerRef = useRef<AbortController | null>(null);
  const optionsRef = useRef<UnifiedDownloadOptions | null>(null);

  /**
   * Build an absolute backend URL from a relative or absolute URL.
   * This is the critical iOS fix: relative URLs must be converted to absolute
   * backend URLs before passing to window.open(), otherwise they resolve to
   * the frontend domain in production.
   */
  const buildAbsoluteUrl = useCallback((url: string): string => {
    // Already absolute
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Relative URL - prepend backend origin
    const origin = getBackendOrigin();
    return url.startsWith('/') ? `${origin}${url}` : `${origin}/${url}`;
  }, []);

  /**
   * iOS download path: proxy third-party URLs through backend,
   * build absolute URL, then trigger Safari's native download manager.
   */
  const handleIOSDownload = useCallback(async (options: UnifiedDownloadOptions): Promise<void> => {
    const { url, filename, onComplete, onError, debug } = options;

    try {
      if (debug) {
        console.log('[useUnifiedDownload] iOS download path');
        console.log('[useUnifiedDownload] Original URL:', url);
      }

      // Proxy third-party URLs through /api/download/file
      const proxiedUrl = toIOSDownloadHref(url, filename);

      if (debug) {
        console.log('[useUnifiedDownload] Proxied URL:', proxiedUrl);
      }

      // Build absolute backend URL (critical fix for production)
      const absoluteUrl = buildAbsoluteUrl(proxiedUrl);

      if (debug) {
        console.log('[useUnifiedDownload] Absolute URL:', absoluteUrl);
        console.log('[useUnifiedDownload] Backend origin:', getBackendOrigin());
      }

      // Trigger Safari's native download manager
      triggerAttachmentDownload(absoluteUrl);

      if (debug) {
        console.log('[useUnifiedDownload] iOS download triggered');
      }

      // iOS download is fire-and-forget; we can't track progress
      // Mark as complete optimistically after a short delay
      setTimeout(() => {
        setIsDownloading(false);
        onComplete?.();
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setIsDownloading(false);
      onError?.(message);
    }
  }, [buildAbsoluteUrl]);

  /**
   * Desktop/Android download path: stream bytes to disk via StreamSaver
   * with progress tracking and cancellation support.
   */
  const handleDesktopAndroidDownload = useCallback(async (options: UnifiedDownloadOptions): Promise<void> => {
    const { url, filename, onProgress, onComplete, onError, debug } = options;

    // Create abort controller for cancellation
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      if (debug) {
        console.log('[useUnifiedDownload] Desktop/Android download path');
        console.log('[useUnifiedDownload] URL:', url);
      }

      // Build absolute URL if needed
      const absoluteUrl = buildAbsoluteUrl(url);

      if (debug) {
        console.log('[useUnifiedDownload] Absolute URL:', absoluteUrl);
      }

      // Stream download to disk with progress tracking
      const result = await streamDownloadToDisk(absoluteUrl, {
        filename,
        signal: controller.signal,
        onProgress: (downloaded, total) => {
          // Update internal progress state
          const percent = total && total > 0 
            ? Math.min(100, Math.round((downloaded / total) * 100)) 
            : null;
          
          setProgress({ downloaded, total, percent });

          // Fire callback
          onProgress?.(downloaded, total);
        },
      });

      if (debug) {
        console.log('[useUnifiedDownload] Download complete:', result);
      }

      // Check if aborted
      if (controller.signal.aborted) {
        if (debug) {
          console.log('[useUnifiedDownload] Download was canceled');
        }
        return; // Don't call onComplete or set error for user cancellation
      }

      setIsDownloading(false);
      setProgress(null);
      onComplete?.();
    } catch (err) {
      // Distinguish AbortError from network errors
      if (err instanceof Error && err.name === 'AbortError') {
        if (debug) {
          console.log('[useUnifiedDownload] Download aborted by user');
        }
        setError(null); // User cancellation is not an error
      } else {
        const message = err instanceof Error ? err.message : String(err);
        if (debug) {
          console.error('[useUnifiedDownload] Download error:', message);
        }
        setError(message);
        onError?.(message);
      }
      setIsDownloading(false);
      setProgress(null);
    } finally {
      abortControllerRef.current = null;
    }
  }, [buildAbsoluteUrl]);

  /**
   * Start a download with the provided options.
   * Routes to iOS or Desktop/Android path based on platform detection.
   */
  const startDownload = useCallback(async (options: UnifiedDownloadOptions): Promise<void> => {
    if (isDownloading) {
      console.warn('[useUnifiedDownload] Download already in progress');
      return;
    }

    // Reset state
    setIsDownloading(true);
    setError(null);
    setProgress(null);
    optionsRef.current = options;

    if (options.debug) {
      console.log('[useUnifiedDownload] Starting download');
      console.log('[useUnifiedDownload] Platform:', platform);
      console.log('[useUnifiedDownload] Options:', options);
    }

    // Route to appropriate platform handler
    if (platform === 'ios') {
      await handleIOSDownload(options);
    } else {
      // Desktop or Android
      await handleDesktopAndroidDownload(options);
    }
  }, [isDownloading, platform, handleIOSDownload, handleDesktopAndroidDownload]);

  /**
   * Cancel the currently running download.
   * Only works for Desktop/Android downloads (iOS downloads are fire-and-forget).
   */
  const cancelDownload = useCallback(() => {
    if (!isDownloading) {
      return;
    }

    const controller = abortControllerRef.current;
    if (controller) {
      if (optionsRef.current?.debug) {
        console.log('[useUnifiedDownload] Canceling download');
      }
      controller.abort();
    }

    setIsDownloading(false);
    setProgress(null);
    setError(null);
  }, [isDownloading]);

  return {
    startDownload,
    cancelDownload,
    isDownloading,
    progress,
    error,
  };
}

/**
 * Detect the current platform for download strategy selection.
 * - iOS: iPad + iPhone (uses Safari native download manager)
 * - Android: Android Chrome (uses StreamSaver with SW MITM or native Blob download)
 * - Desktop: All other platforms (uses StreamSaver)
 */
function detectPlatform(): Platform {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'desktop'; // SSR fallback
  }

  // Check for iOS (iPad + iPhone)
  if (isIOS()) {
    return 'ios';
  }

  // Check for Android
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) {
    return 'android';
  }

  // Default to desktop
  return 'desktop';
}
