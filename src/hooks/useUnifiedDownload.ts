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
 * Unified download hook that handles downloads across all platforms using native browser downloads.
 * 
 * **Critical iOS Fix**: This hook ALWAYS builds absolute backend URLs using 
 * `getBackendOrigin()` for relative paths. In production, relative paths like 
 * `/api/download/file?...` would resolve to the frontend domain (chillers.site) 
 * instead of the backend (chillers-production-eace.up.railway.app), causing 
 * downloads to fail. The hook ensures all URLs are absolute before triggering downloads.
 * 
 * **Platform Strategy**:
 * - **iOS**: Uses `window.location.href` to navigate in the SAME tab. This is the 
 *   only method that reliably triggers Safari's native download manager with the 
 *   correct filename from the backend's Content-Disposition header. Other methods 
 *   (window.open, <a target="_blank">) either add .html extension or open inline player.
 * - **Desktop/Android**: Uses native `<a download>` with programmatic click. 
 *   The browser's download manager handles everything and continues even if the 
 *   user closes the tab.
 * 
 * **Why not StreamSaver?**
 * StreamSaver requires the page to stay open during download. If the user navigates 
 * away or closes the tab, the download stops. Native browser downloads persist 
 * regardless of tab state, providing a much better UX.
 * 
 * @returns Hook interface with `startDownload`, `cancelDownload`, `isDownloading`, `progress`, and `error`.
 * 
 * @example
 * ```tsx
 * const { startDownload, isDownloading, error } = useUnifiedDownload();
 * 
 * const handleDownload = async () => {
 *   await startDownload({
 *     url: '/api/download/file?url=https://example.com/video.mp4',
 *     filename: 'video.mp4',
 *     onComplete: () => {
 *       console.log('Download started! Check your browser downloads.');
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
   * Native browser download for all platforms.
   * - iOS: window.location.href (navigates current tab to download URL)
   * - Desktop/Android: <a download> with programmatic click
   */
  const handleNativeDownload = useCallback(async (options: UnifiedDownloadOptions): Promise<void> => {
    const { url, filename: rawFilename, onComplete, onError, debug } = options;

    try {
      // Clean filename: remove .html extension if present (shouldn't be there for videos)
      const filename = rawFilename.replace(/\.html$/i, '');

      if (debug) {
        console.log('[useUnifiedDownload] Native download path');
        console.log('[useUnifiedDownload] Platform:', platform);
        console.log('[useUnifiedDownload] Original URL:', url);
        console.log('[useUnifiedDownload] Filename:', filename);
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

      if (platform === 'ios') {
        // iOS Safari: Navigate in the SAME tab with window.location.href
        // This is the ONLY method that works reliably on iOS Safari.
        // - window.open() adds .html extension
        // - <a target="_blank"> opens inline video player instead of download
        // - window.location.href triggers Content-Disposition: attachment correctly
        if (debug) {
          console.log('[useUnifiedDownload] iOS: navigating to download URL');
          console.log('[useUnifiedDownload] URL:', absoluteUrl);
        }
        
        window.location.href = absoluteUrl;
      } else {
        // Desktop/Android: use <a download> with programmatic click
        const a = document.createElement('a');
        a.href = absoluteUrl;
        a.download = filename;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        
        if (debug) {
          console.log('[useUnifiedDownload] Desktop/Android: triggering <a> click');
          console.log('[useUnifiedDownload] href:', a.href);
        }
        
        a.click();

        // Cleanup after a short delay
        setTimeout(() => {
          document.body.removeChild(a);
        }, 1000);
      }

      if (debug) {
        console.log('[useUnifiedDownload] Download triggered successfully');
      }

      // Native download is fire-and-forget; mark as complete optimistically
      setTimeout(() => {
        setIsDownloading(false);
        onComplete?.();
      }, 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (debug) {
        console.error('[useUnifiedDownload] Download error:', message);
      }
      setError(message);
      setIsDownloading(false);
      onError?.(message);
    }
  }, [buildAbsoluteUrl, platform]);

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

    // Route to native download handler (same for all platforms now)
    await handleNativeDownload(options);
  }, [isDownloading, platform, handleNativeDownload]);

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
