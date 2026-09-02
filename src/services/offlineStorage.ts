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
