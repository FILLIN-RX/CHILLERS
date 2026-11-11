"use client";

import { API_BASE_PATH, getBackendOrigin } from "@/services/http";
import { toIOSDownloadHref, triggerAttachmentDownload } from "@/services/downloads";

// Thin wrapper around StreamSaver.js that initialises the MITM polyfill lazily
// (browser-only) and exposes a single `streamDownloadToDisk` function.
//
// Why: keep StreamSaver concerns out of components and centralise the SW path.
// On the server or in tests, the functions are no-ops so callers don't crash.
//
// SSR note: `streamsaver` references `document` at module-evaluation time, so we
// must NOT import it eagerly — Next.js still evaluates client modules during SSR
// to extract metadata. We load it lazily on first browser use.

let streamSaverModule: typeof import("streamsaver") | null = null;
let _mitmReady = false;

export async function getStreamSaver() {
  if (streamSaverModule) return streamSaverModule;
  // The dynamic import is what makes this safe under SSR — webpack will still
  // bundle streamsaver into the client chunk, but the import only runs in the
  // browser because all callers guard on `typeof window !== "undefined"`.
  streamSaverModule = (await import("streamsaver")).default as unknown as typeof import("streamsaver");
  return streamSaverModule;
}

/** Ensure the mitm.html proxy is wired up. Idempotent. */
export async function ensureStreamSaverReady() {
  if (typeof window === "undefined" || _mitmReady) return;
  const ss = await getStreamSaver();
  // The mitm.html that ships with StreamSaver must live at the same origin
  // (copied to /public/mitm.html during Phase 0).
  (ss as any).mitm = "/mitm.html";
  _mitmReady = true;
}

export interface StreamDownloadOptions {
  /** Suggested filename (will be sanitised). */
  filename: string;
  /** Caller's AbortSignal — aborting cancels the in-flight stream. */
  signal: AbortSignal;
  /** Fires whenever new bytes arrive. Called at most every `throttleMs` ms. */
  onProgress?: (bytesDownloaded: number, totalBytes: number | null) => void;
  /** Minimum ms between progress emissions (default 200). */
  throttleMs?: number;
  /** Whether to accumulate and return the full Blob in memory (defaults to false to save RAM). */
  saveBlob?: boolean;
}

export function isIOS(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  // Test UA direct — toujours fiable sur iPhone/iPod et iPad < iOS 13
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  // iPadOS 13+ se présente comme un Mac dans l'UA ; on doit tester la plateforme.
  // navigator.platform est déprécié mais reste le seul signal fiable sur Safari 17.
  // "MacARM" couvre les iPad Apple Silicon, "MacIntel" les modèles Intel/A-series.
  const platform = (navigator.platform || "");
  if ((platform === "MacIntel" || platform === "MacARM" || platform === "Mac") && navigator.maxTouchPoints > 1) {
    return true;
  }
  // Fallback : userAgentData (Chrome 90+, absent sur Safari — safe à tester)
  const uaData = (navigator as any).userAgentData;
  if (uaData?.platform) {
    const p = (uaData.platform as string).toLowerCase();
    if (p === "ios" || p === "ipados") return true;
  }
  return false;
}

/**
 * Détecte Chrome sur Android mobile.
 * Sur Android, StreamSaver dépend du SW MITM — si le SW n'est pas actif
 * (PWA standalone, arrière-plan, mode économie batterie), le download
 * se "termine" sans que le fichier soit écrit sur disque.
 * On préfère alors le fallback Blob natif du navigateur.
 */
export function isAndroidMobileChrome(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Android/i.test(ua) && /Chrome\/\d/i.test(ua) && !/wv/.test(ua);
}

export interface StreamDownloadResult {
  totalBytes: number | null;
  blob?: Blob;
  /** Vrai sur iOS : le téléchargement a été délégué à Safari (fire-and-forget).
   *  On ne peut pas confirmer la fin — le statut "done" est optimiste. */
  iosTriggered?: boolean;
}

/**
 * Streams a remote URL to disk via StreamSaver on desktop / Chrome / Android,
 * and routes through native iOS Safari download manager on iPhone/iPad.
 */
export async function streamDownloadToDisk(
  url: string,
  opts: StreamDownloadOptions,
): Promise<StreamDownloadResult> {
  if (typeof window === "undefined") {
    throw new Error("streamDownloadToDisk is browser-only");
  }

  const { filename, signal, onProgress, throttleMs = 200, saveBlob = false } = opts;

  if (isIOS()) {
    // iOS Safari ne supporte pas WritableStream / StreamSaver MITM iframe, et
    // ignore l'attribut `download` cross-origin. Seul un serveur qui répond
    // `Content-Disposition: attachment` déclenche la boîte native de téléchargement.
    //
    // → window.open() ouvre un onglet qui se ferme automatiquement après 2s.
    //   Content-Disposition: attachment déclenche le téléchargement Safari natif.
    //   Le navigateur gère la progression et la persistance même après fermeture de l'onglet.
    // → toIOSDownloadHref proxifie toute URL tierce via /api/download/file
    //   (headers safari-safe : attachment + video/mp4 + Accept-Ranges).
    console.log('[download] iOS detected - using native Safari download');
    const backendOrigin = getBackendOrigin();
    const relative = toIOSDownloadHref(url, filename || "video.mp4");
    const href = relative.startsWith("http") ? relative : `${backendOrigin}${relative}`;
    console.log('[download] Backend origin:', backendOrigin);
    console.log('[download] Download href:', href);
    console.log('[download] Triggering attachment download...');

    triggerAttachmentDownload(href);
    console.log('[download] iOS download triggered, returning optimistic result');
    // Safari gère le téléchargement nativement — on ne peut pas détecter la fin.
    // On retourne immédiatement avec iosTriggered=true pour que l'appelant
    // affiche un message adapté ("Vérifiez vos téléchargements Safari").
    return { totalBytes: null, iosTriggered: true };
  }

  // Android mobile Chrome : StreamSaver dépend du SW MITM.
  // Si le SW n'est pas actif (PWA standalone, arrière-plan, économie batterie),
  // le stream se "termine" sans écrire le fichier sur disque — le statut passe à
  // "done" mais rien n'apparaît dans les téléchargements du navigateur.
  // On détecte ce cas et on bascule sur le téléchargement natif via Blob + <a>.
  const useNativeAndroidDownload = isAndroidMobileChrome() && !(
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    navigator.serviceWorker.controller !== null
  );

  if (useNativeAndroidDownload) {
    // Fallback Android : téléchargement via fetch → Blob → <a download>
    // Le navigateur gère lui-même la progression et l'enregistrement dans ses téléchargements natifs.
    console.log('[download] Android Chrome without SW - using native Blob download');
    const fetchUrl =
      url.startsWith("/api/") || url.startsWith(API_BASE_PATH)
        ? url
        : `${API_BASE_PATH}/download/file?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;

    const res = await fetch(fetchUrl, { signal });
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status} lors du téléchargement`);
    }

    const totalBytes = parseContentLength(res.headers.get("content-length"));

    // Lire les chunks avec progression
    const reader = res.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let received = 0;
    let lastEmit = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value as Uint8Array<ArrayBuffer>);
      received += value.byteLength;
      const now = Date.now();
      if (onProgress && now - lastEmit >= throttleMs) {
        lastEmit = now;
        onProgress(received, totalBytes);
      }
    }

    // Assembler le Blob et déclencher le téléchargement natif
    const contentType = res.headers.get("content-type") || "video/mp4";
    const blob = new Blob(chunks as BlobPart[], { type: contentType });
    console.log('[download] Blob created, triggering native download:', filename, 'Size:', received, 'bytes');
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Révoquer l'URL après un délai pour laisser le temps au navigateur de démarrer le DL
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);

    return { totalBytes: received };
  }

  // Combine the caller's signal with an internal timeout so a stuck server
  // doesn't hang the download forever.
  const timeoutCtrl = new AbortController();
  const timeoutTimer = setTimeout(() => timeoutCtrl.abort(), 30 * 60_000); // 30 min

  const onExternalAbort = () => timeoutCtrl.abort(signal.reason);
  signal.addEventListener("abort", onExternalAbort, { once: true });

  try {
    // Passer par le proxy backend pour éviter CORS et bénéficier des bons headers.
    // Si l'URL est déjà proxifiée (/api/...) on ne double-proxifie pas.
    const fetchUrl =
      url.startsWith("/api/") || url.startsWith(API_BASE_PATH)
        ? url
        : `${API_BASE_PATH}/download/file?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;

    const res = await fetch(fetchUrl, { signal: timeoutCtrl.signal });
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status} while downloading`);
    }

    const totalBytes = parseContentLength(res.headers.get("content-length"));

    await ensureStreamSaverReady();
    const ss = await getStreamSaver();

    // Fournir la taille totale exacte (size & Content-Length) pour que le gestionnaire de téléchargement
    // du navigateur (Chrome / Edge / Firefox) affiche la barre de progression native au lieu de "Resuming..."
    const fileStream = (ss as any).createWriteStream(filename, {
      size: totalBytes || undefined,
      headers: totalBytes ? { 'Content-Length': String(totalBytes) } : undefined,
    });
    const writer = fileStream.getWriter();

    // Throttled progress reporting & chunk accumulation if saveBlob requested
    let lastEmit = 0;
    let bytes = 0;
    const chunks: Uint8Array[] = [];

    const pipe = new WritableStream<Uint8Array>({
      async write(chunk) {
        bytes += chunk.byteLength;
        if (saveBlob) {
          chunks.push(chunk);
        }
        const now = Date.now();
        if (onProgress && now - lastEmit >= throttleMs) {
          lastEmit = now;
          onProgress(bytes, totalBytes);
        }
        await writer.write(chunk);
      },
      abort(reason) {
        try {
          writer.abort(reason);
        } catch {}
      },
    });

    await res.body.pipeTo(pipe, { signal: timeoutCtrl.signal });

    try {
      await writer.close();
    } catch (closeErr) {
      // writer.close() échoue si StreamSaver n'a pas pu finaliser l'écriture
      // (SW MITM inactif, onglet suspendu, espace disque insuffisant).
      // On remonte l'erreur pour que useDownload passe en "error" au lieu de "done".
      throw new Error(
        `Le fichier n'a pas pu être enregistré sur votre appareil. ` +
        `Vérifiez que vous avez suffisamment d'espace disque et réessayez.`
      );
    }

    const fullBlob = saveBlob ? new Blob(chunks as BlobPart[], { type: "video/mp4" }) : undefined;
    return { totalBytes, blob: fullBlob };
  } finally {
    clearTimeout(timeoutTimer);
    signal.removeEventListener("abort", onExternalAbort);
  }
}

function parseContentLength(value: string | null): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
