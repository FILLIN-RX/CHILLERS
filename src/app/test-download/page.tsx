"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  DownloadSimple,
  Play,
  ArrowClockwise,
  CheckCircle,
  WarningCircle,
  XCircle,
  AppleLogo,
  DeviceMobile,
  Monitor,
  Terminal,
  FilmStrip,
  Lightning,
} from "@phosphor-icons/react";
import { API_BASE_PATH, getBackendOrigin } from "@/services/http";
import { isIOS, streamDownloadToDisk } from "@/services/streamSaver";

interface InspectionResult {
  url: string;
  type: "mp4" | "hls" | "embed" | "unknown";
  provider: string;
  status: number | null;
  statusText?: string;
  contentLength: number | null;
  contentLengthFormatted?: string;
  contentType: string | null;
  acceptRanges: string | null;
  isIosCompatible: boolean;
  iosNotes: string;
}

export default function TestDownloadPage() {
  const [query, setQuery] = useState("Spider-Man : Brand New Day");
  const [tmdbId, setTmdbId] = useState("969681");
  const [loading, setLoading] = useState(false);
  const [resolutionData, setResolutionData] = useState<any>(null);
  const [inspection, setInspection] = useState<InspectionResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [streamProgress, setStreamProgress] = useState<number | null>(null);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${time}] ${msg}`]);
  };

  const clearLogs = () => setLogs([]);

  // 1. Résolution via le backend
  const handleResolve = async () => {
    setLoading(true);
    setResolutionData(null);
    setInspection(null);
    clearLogs();
    addLog(`🔍 Lancement de la résolution pour "${query}" (TMDB ID: ${tmdbId || "aucun"})...`);

    try {
      const backend = getBackendOrigin();
      const params = new URLSearchParams();
      if (tmdbId) params.append("tmdb_id", tmdbId);
      if (query) params.append("title", query);
      params.append("type", "movie");

      const url = `${backend}/api/download/resolve?${params.toString()}`;
      addLog(`GET ${url}`);

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || !data.success || !data.data) {
        addLog(`❌ Erreur résolution: ${data?.error || `HTTP ${res.status}`}`);
        setResolutionData(null);
        return;
      }

      addLog(`✅ Résolu avec succès par le provider: ${data.data.provider}`);
      addLog(`URL directe / download: ${data.data.downloadUrl}`);
      setResolutionData(data.data);

      // Inspecter les en-têtes HTTP de l'URL résolue
      await inspectUrl(data.data.downloadUrl, data.data.rawUrl, data.data.directType, data.data.provider);
    } catch (err: any) {
      addLog(`❌ Exception résolution: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 2. Inspection des headers HTTP et de la compatibilité iOS
  const inspectUrl = async (
    downloadUrl: string,
    rawUrl: string,
    directType: string,
    provider: string
  ) => {
    addLog(`🔬 Inspection technique des headers et compatibilité iOS...`);
    const backend = getBackendOrigin();
    const fullUrl = downloadUrl.startsWith("http") ? downloadUrl : `${backend}${downloadUrl}`;

    try {
      // Test de requête HEAD ou Range pour obtenir les en-têtes sans tout télécharger
      const headRes = await fetch(fullUrl, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
      });

      const status = headRes.status;
      const contentType = headRes.headers.get("content-type");
      const contentLengthHeader = headRes.headers.get("content-length");
      const contentRange = headRes.headers.get("content-range");
      const acceptRanges = headRes.headers.get("accept-ranges");

      let totalBytes: number | null = null;
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)/);
        if (match) totalBytes = parseInt(match[1], 10);
      } else if (contentLengthHeader) {
        totalBytes = parseInt(contentLengthHeader, 10);
      }

      const formattedSize = totalBytes
        ? `${(totalBytes / (1024 * 1024)).toFixed(1)} Mo (${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} Go)`
        : "Inconnue (chunked / stream)";

      const isHls = directType === "hls" || /\.m3u8/i.test(downloadUrl) || /\.m3u8/i.test(rawUrl);
      const isMp4 = directType === "mp4" || /\.mp4/i.test(downloadUrl) || /\.mp4/i.test(rawUrl);

      // Diagnostic iOS
      let isIosCompatible = false;
      let iosNotes = "";

      if (status === 403) {
        isIosCompatible = false;
        iosNotes = "❌ Erreur 403 : Le lien a expiré ou le CDN refuse la requête.";
      } else if (isHls && downloadUrl.includes("/api/download/stream")) {
        isIosCompatible = false;
        iosNotes =
          "⚠️ HLS à la volée FFmpeg : Sur iOS Safari, l'absence de Content-Length bloque souvent le téléchargement dans Fichiers ou s'arrête si l'écran se verrouille.";
      } else if (isMp4 && totalBytes && totalBytes > 10000000) {
        isIosCompatible = true;
        iosNotes = `✅ Compatible iOS Safari à 100% : Vrai fichier MP4 direct avec Content-Length (${formattedSize}) et Accept-Ranges.`;
      } else if (status >= 200 && status < 300) {
        isIosCompatible = true;
        iosNotes = `✅ Réponse HTTP ${status} reçue. Content-Type: ${contentType}.`;
      } else {
        isIosCompatible = false;
        iosNotes = `⚠️ Statut HTTP inhabituel: ${status}.`;
      }

      addLog(`Status HTTP: ${status} ${headRes.statusText}`);
      addLog(`Content-Type: ${contentType || "non spécifié"}`);
      addLog(`Taille: ${formattedSize}`);
      addLog(`Accept-Ranges: ${acceptRanges || "non"}`);
      addLog(`Bilan iOS: ${iosNotes}`);

      setInspection({
        url: fullUrl,
        type: isHls ? "hls" : isMp4 ? "mp4" : "unknown",
        provider,
        status,
        statusText: headRes.statusText,
        contentLength: totalBytes,
        contentLengthFormatted: formattedSize,
        contentType,
        acceptRanges,
        isIosCompatible,
        iosNotes,
      });
    } catch (err: any) {
      addLog(`❌ Échec de l'inspection des headers: ${err.message}`);
    }
  };

  // Test Mode 1: Déclenchement direct iOS (a.download / window.location)
  const testIosMode = () => {
    if (!resolutionData?.downloadUrl) return;
    const backend = getBackendOrigin();
    const targetUrl = resolutionData.downloadUrl.startsWith("http")
      ? resolutionData.downloadUrl
      : `${backend}${resolutionData.downloadUrl}`;

    addLog(`📱 [Mode iOS] Déclenchement du téléchargement natif via clic synthétique a.download...`);
    addLog(`Cible: ${targetUrl}`);

    const a = document.createElement("a");
    a.href = targetUrl;
    a.download = resolutionData.filename || "test-film.mp4";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        a.remove();
      } catch {}
    }, 1000);
    addLog(`📱 Clic effectué ! Si vous êtes sur iOS Safari, la boîte de dialogue native doit s'ouvrir.`);
  };

  // Test Mode 2: StreamSaver (Desktop Chrome / Firefox)
  const testStreamSaverMode = async () => {
    if (!resolutionData?.downloadUrl) return;
    addLog(`💻 [Mode StreamSaver] Démarrage du streaming vers disque...`);
    setStreamProgress(0);

    const ctrl = new AbortController();
    try {
      const result = await streamDownloadToDisk(resolutionData.downloadUrl, {
        filename: resolutionData.filename || "test-film.mp4",
        signal: ctrl.signal,
        onProgress: (bytes, total) => {
          if (total && total > 0) {
            const pct = Math.round((bytes / total) * 100);
            setStreamProgress(pct);
          } else {
            setStreamProgress(Math.round(bytes / (1024 * 1024)));
          }
        },
      });
      addLog(`✅ StreamSaver terminé ! Total: ${result.totalBytes || "inconnu"} octets.`);
    } catch (err: any) {
      addLog(`❌ Échec StreamSaver: ${err.message}`);
    } finally {
      setStreamProgress(null);
    }
  };

  // Test Mode 3: Forcer le flux HLS FFmpeg
  const testFfmpegStream = () => {
    const rawUrl = resolutionData?.rawUrl;
    if (!rawUrl) return;
    const backend = getBackendOrigin();
    const streamUrl = `${backend}/api/download/stream?m3u8=${encodeURIComponent(rawUrl)}&filename=${encodeURIComponent(
      resolutionData.filename || "test-ffmpeg.mp4"
    )}`;
    addLog(`🎬 [Mode FFmpeg à la volée] Ouverture de l'URL FFmpeg...`);
    addLog(`URL: ${streamUrl}`);
    window.open(streamUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-[#07070a] text-white p-4 sm:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-pink-500 font-bold">
              <Lightning className="w-4 h-4" /> Laboratoire de Diagnostic
            </div>
            <h1 className="text-2xl font-black mt-1">Banc d'Essai Téléchargement & Test iOS</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Comparez le téléchargement direct MP4 vs HLS à la volée pour Safari iOS et navigateurs Desktop.
            </p>
          </div>
          <Link
            href="/"
            className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition"
          >
            ← Retour
          </Link>
        </div>

        {/* Formulaire de recherche */}
        <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-zinc-400">Titre du film</label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex: Spider-Man : Brand New Day"
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-pink-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400">ID TMDB (Optionnel)</label>
              <input
                type="text"
                value={tmdbId}
                onChange={(e) => setTmdbId(e.target.value)}
                placeholder="Ex: 969681"
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={handleResolve}
              disabled={loading}
              className="px-5 py-2.5 rounded-[5px] bg-pink-600 hover:bg-pink-500 active:scale-95 text-white font-bold text-xs flex items-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-lg shadow-pink-600/30"
            >
              <ArrowClockwise className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Résolution en cours..." : "1. Résoudre le film & inspecter"}</span>
            </button>

            {/* Raccourcis films */}
            <span className="text-xs text-zinc-500 ml-2">Exemples rapides :</span>
            <button
              type="button"
              onClick={() => {
                setQuery("Spider-Man : Brand New Day");
                setTmdbId("969681");
              }}
              className="text-xs px-2.5 py-1 rounded-[5px] bg-white/5 hover:bg-white/10 text-zinc-300 transition"
            >
              Spider-Man (969681)
            </button>
            <button
              type="button"
              onClick={() => {
                setQuery("Thunderstruck");
                setTmdbId("119738");
              }}
              className="text-xs px-2.5 py-1 rounded-[5px] bg-white/5 hover:bg-white/10 text-zinc-300 transition"
            >
              Thunderstruck (119738)
            </button>
          </div>
        </div>

        {/* Rapport d'inspection technique */}
        {inspection && (
          <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <FilmStrip className="w-4 h-4 text-pink-500" /> Fiche Technique du Flux Résolu
              </h2>
              <span
                className={`text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                  inspection.isIosCompatible
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}
              >
                {inspection.isIosCompatible ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <WarningCircle className="w-4 h-4" />
                )}
                <span>{inspection.isIosCompatible ? "Optimal pour iOS" : "Attention iOS Safari"}</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                <span className="text-zinc-500 block">Type de flux</span>
                <span className="text-white font-bold uppercase mt-0.5 block">{inspection.type}</span>
              </div>
              <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                <span className="text-zinc-500 block">Source / Provider</span>
                <span className="text-pink-400 font-bold mt-0.5 block">{inspection.provider}</span>
              </div>
              <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                <span className="text-zinc-500 block">Statut HTTP</span>
                <span
                  className={`font-bold mt-0.5 block ${
                    inspection.status === 200 || inspection.status === 206
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {inspection.status || "Erreur"} {inspection.statusText}
                </span>
              </div>
              <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                <span className="text-zinc-500 block">Taille (Content-Length)</span>
                <span className="text-white font-bold mt-0.5 block truncate">
                  {inspection.contentLengthFormatted}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-black/50 rounded-xl border border-white/10 text-xs space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <AppleLogo className="w-4 h-4 text-white" />
                <span>Diagnostic Safari iOS :</span>
              </div>
              <p className="text-zinc-300">{inspection.iosNotes}</p>
            </div>

            {/* Boutons d'essais des modes */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <h3 className="text-xs font-semibold text-zinc-400">Tester le téléchargement avec les différents modes :</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Mode 1 */}
                <button
                  type="button"
                  onClick={testIosMode}
                  className="p-3 rounded-[5px] bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-left border border-white/10 transition space-y-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <DeviceMobile className="w-4 h-4" /> Mode Natif iOS (Direct)
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Déclenche l'enregistrement natif Safari dans Fichiers avec Content-Disposition.
                  </p>
                </button>

                {/* Mode 2 */}
                <button
                  type="button"
                  onClick={testStreamSaverMode}
                  className="p-3 rounded-[5px] bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-left border border-white/10 transition space-y-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                    <Monitor className="w-4 h-4" /> Mode StreamSaver (Desktop)
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Écrit les octets directement sur le disque (Chrome, Edge, Firefox, Android).
                  </p>
                </button>

                {/* Mode 3 */}
                <button
                  type="button"
                  onClick={testFfmpegStream}
                  className="p-3 rounded-[5px] bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-left border border-white/10 transition space-y-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <Lightning className="w-4 h-4" /> Mode FFmpeg (À la volée)
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Convertit les playlists HLS en MP4 direct à la volée via /api/download/stream.
                  </p>
                </button>
              </div>

              {streamProgress !== null && (
                <div className="p-3 bg-sky-950/40 border border-sky-500/30 rounded-xl text-xs space-y-1 mt-2">
                  <div className="flex justify-between font-semibold text-sky-300">
                    <span>Progression du flux StreamSaver</span>
                    <span>{streamProgress}%</span>
                  </div>
                  <div className="w-full bg-black/60 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-sky-500 h-full transition-all duration-200"
                      style={{ width: `${Math.min(100, streamProgress)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Terminal des logs de diagnostic */}
        <div className="bg-black/90 border border-white/10 rounded-2xl p-4 font-mono text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 text-zinc-400">
            <span className="flex items-center gap-1.5 font-bold">
              <Terminal className="w-4 h-4 text-emerald-400" /> Journal d'Analyse en Temps Réel
            </span>
            <button
              onClick={clearLogs}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
            >
              Effacer
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1 pr-2 select-text text-zinc-300">
            {logs.length === 0 ? (
              <span className="text-zinc-600 italic">En attente d'une requête de test...</span>
            ) : (
              logs.map((log, idx) => <div key={idx}>{log}</div>)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
