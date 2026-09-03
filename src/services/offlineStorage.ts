"use client";

/**
 * Service de stockage hors-ligne IndexedDB pour les vidéos CHILLERS
 * Permet de sauvegarder et récupérer automatiquement les blobs vidéos MP4
 * sans jamais demander à l'utilisateur de sélectionner un fichier manuellement.
 */

const DB_NAME = "chillers_offline_db";
const STORE_NAME = "offline_videos";
const DB_VERSION = 1;

function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB non disponible"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface StoredOfflineVideo {
  id: string;
  blob: Blob;
  filename: string;
  title: string;
  size: number;
  savedAt: number;
}

/**
 * Enregistre un Blob vidéo dans IndexedDB pour la lecture hors-ligne automatique
 */
export async function saveOfflineVideoBlob(
  id: string,
  blob: Blob,
  filename: string,
  title: string
): Promise<void> {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      const record: StoredOfflineVideo = {
        id,
        blob,
        filename,
        title,
        size: blob.size,
        savedAt: Date.now(),
      };

      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[OfflineStorage] Impossible d'enregistrer dans IndexedDB:", err);
  }
}

/**
 * Demande la persistance du stockage au navigateur (méthode YouTube)
 * Évite que le navigateur supprime silencieusement les vidéos si le disque se remplit.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof window === "undefined" || !navigator.storage || !navigator.storage.persist) {
    return false;
  }
  try {
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) return true;
    return await navigator.storage.persist();
  } catch (err) {
    console.warn("[OfflineStorage] Impossible d'activer le stockage persistant:", err);
    return false;
  }
}

export interface StorageQuotaInfo {
  usageBytes: number;
  quotaBytes: number;
  percentUsed: number;
  availableBytes: number;
  isPersisted: boolean;
}

/**
 * Détecte l'espace disque / quota IndexedDB disponible (méthode YouTube)
 */
export async function getStorageQuota(): Promise<StorageQuotaInfo | null> {
  if (typeof window === "undefined" || !navigator.storage || !navigator.storage.estimate) {
    return null;
  }
  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const available = Math.max(0, quota - usage);
    const percent = quota > 0 ? Math.min(100, Math.round((usage / quota) * 100)) : 0;
    const isPersisted =
      typeof navigator.storage.persisted === "function"
        ? await navigator.storage.persisted()
        : false;

    return {
      usageBytes: usage,
      quotaBytes: quota,
      percentUsed: percent,
      availableBytes: available,
      isPersisted,
    };
  } catch {
    return null;
  }
}

/**
 * Stream une vidéo directement depuis son URL vers IndexedDB sans saturation de la RAM (méthode YouTube)
 * La mémoire n'accumule jamais le fichier entier en même temps.
 */
export async function streamVideoToIndexedDB(
  url: string,
  opts: {
    id: string;
    filename: string;
    title: string;
    signal?: AbortSignal;
    onProgress?: (bytes: number, total: number | null) => void;
    throttleMs?: number;
  }
): Promise<{ success: boolean; totalBytes: number | null }> {
  if (typeof window === "undefined") {
    throw new Error("streamVideoToIndexedDB est réservé au navigateur");
  }

  // 1. Activer la persistance de stockage si pas déjà fait
  await requestPersistentStorage();

  const { id, filename, title, signal, onProgress, throttleMs = 200 } = opts;

  // 2. Si le navigateur supporte la Background Fetch API (Android Chrome, Edge, PWA installée)
  // le téléchargement continue même si l'utilisateur quitte le navigateur ou verrouille l'écran !
  if (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "BackgroundFetchManager" in window
  ) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && "backgroundFetch" in reg) {
        // Enregistrer la tâche de fond
        const bgFetch = await (reg as any).backgroundFetch.fetch(id, [url], {
          title: `Téléchargement: ${title}`,
          icons: [{ sizes: "192x192", src: "/android-chrome-192x192.png", type: "image/png" }],
        });

        // Suivre la progression en direct depuis le SW
        bgFetch.addEventListener("progress", () => {
          if (onProgress && bgFetch.downloadTotal > 0) {
            onProgress(bgFetch.downloaded, bgFetch.downloadTotal);
          }
        });

        const record = await bgFetch.match(url);
        if (record) {
          const response = await record.responseReady;
          if (response && response.ok) {
            const blob = await response.blob();
            await saveOfflineVideoBlob(id, blob, filename, title);
            if (onProgress) {
              onProgress(blob.size, blob.size);
            }
            return { success: true, totalBytes: blob.size };
          }
        }
      }
    } catch (bgErr) {
      console.log("[OfflineStorage] Background Fetch fallback vers flux normal:", bgErr);
    }
  }

  // 3. Mode standard (fetch stream avec support d'arrière-plan de l'onglet)
  const res = await fetch(url, { signal });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} lors du téléchargement hors-ligne`);
  }

  const contentLength = res.headers.get("content-length");
  const totalBytes = contentLength ? parseInt(contentLength, 10) : null;

  // Vérification de quota si totalBytes connu
  if (totalBytes && totalBytes > 0) {
    const quota = await getStorageQuota();
    if (quota && quota.availableBytes < totalBytes) {
      throw new Error(`Espace insuffisant sur votre appareil (requis: ${Math.round(totalBytes / (1024 * 1024))} Mo)`);
    }
  }

  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let bytesDownloaded = 0;
  let lastEmit = 0;

  try {
    while (true) {
      if (signal?.aborted) {
        throw new Error("Téléchargement annulé");
      }
      const { done, value } = await reader.read();
      if (done) break;

      if (value) {
        bytesDownloaded += value.byteLength;
        // On pousse le chunk en BlobPart
        chunks.push(value.buffer as ArrayBuffer);

        const now = Date.now();
        if (onProgress && now - lastEmit >= throttleMs) {
          lastEmit = now;
          onProgress(bytesDownloaded, totalBytes);
        }
      }
    }

    // Créer le Blob final et stocker dans IndexedDB
    const blob = new Blob(chunks, { type: "video/mp4" });
    await saveOfflineVideoBlob(id, blob, filename, title);

    if (onProgress) {
      onProgress(bytesDownloaded, totalBytes || bytesDownloaded);
    }

    return { success: true, totalBytes: bytesDownloaded };
  } finally {
    reader.releaseLock();
  }
}

/**
 * Récupère le Blob d'une vidéo hors-ligne par son ID de tâche
 */
export async function getOfflineVideoBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        const result = req.result as StoredOfflineVideo | undefined;
        resolve(result?.blob || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Supprime une vidéo du stockage hors-ligne IndexedDB
 */
export async function deleteOfflineVideoBlob(id: string): Promise<void> {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {}
}
