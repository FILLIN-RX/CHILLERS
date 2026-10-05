"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getMatches, getMatchStream } from "@/services/matches";
import { getSportsMatches, getSportsStream } from "@/services/sports";
import type { SportMatch } from "@/types/matches";
import type { SportsMatch } from "@/types/sports";
import LivePlayer from "@/components/LivePlayer";
import type { LiveChannel } from "@/types/live";
import {
  ArrowsClockwise,
  ArrowSquareOut,
  CheckCircle,
  Play,
  Warning,
  XCircle,
  MagnifyingGlass,
} from "@phosphor-icons/react";

const PRIMARY = "#FF6A00";

export default function MatchStreamTestPage() {
  const [espnMatches, setEspnMatches] = useState<SportMatch[]>([]);
  const [scraperMatches, setScraperMatches] = useState<SportsMatch[]>([]);
  const [selectedEspnId, setSelectedEspnId] = useState<string>("");
  const [manualId, setManualId] = useState<string>("");
  const [isLoadingLists, setIsLoadingLists] = useState(true);

  // Données de résolution de flux
  const [streamData, setStreamData] = useState<any>(null);
  const [isResolvingStream, setIsResolvingStream] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Mode de test iframe
  const [useProxy, setUseProxy] = useState<boolean>(true);
  const [activeServerIdx, setActiveServerIdx] = useState<number>(0);

  // 1. Charger les matchs du jour et les flux des scrapers
  const loadMatches = async () => {
    setIsLoadingLists(true);
    setResolveError(null);
    try {
      const today = new Date().toISOString().split("T")[0];
      const [espn, scrapers] = await Promise.allSettled([
        getMatches({ date: today, sport: "football" }),
        getSportsMatches(),
      ]);

      if (espn.status === "fulfilled" && Array.isArray(espn.value)) {
        setEspnMatches(espn.value);
        if (espn.value.length > 0 && !selectedEspnId) {
          const liveOrFirst = espn.value.find((m) => m.status === "live") || espn.value[0];
          setSelectedEspnId(String(liveOrFirst.id));
        }
      }

      if (scrapers.status === "fulfilled" && Array.isArray(scrapers.value)) {
        setScraperMatches(scrapers.value);
      }
    } catch (err: any) {
      console.error("Erreur chargement des matchs:", err);
    } finally {
      setIsLoadingLists(false);
    }
  };

  useEffect(() => {
    loadMatches();
  }, []);

  // 2. Résoudre le flux pour le match sélectionné
  const testStreamResolution = async (id: string) => {
    if (!id) return;
    setIsResolvingStream(true);
    setResolveError(null);
    setStreamData(null);
    setActiveServerIdx(0);

    try {
      const data = await getMatchStream(id);
      if (!data) {
        setResolveError("Aucun flux trouvé pour ce match (pas de correspondance chez les scrapers ou match hors ligne).");
      } else {
        setStreamData(data);
      }
    } catch (err: any) {
      setResolveError(`Erreur lors de la résolution: ${err.message || String(err)}`);
    } finally {
      setIsResolvingStream(false);
    }
  };

  // Dès qu'un match ESPN est sélectionné, tester la résolution
  useEffect(() => {
    if (selectedEspnId) {
      testStreamResolution(selectedEspnId);
    }
  }, [selectedEspnId]);

  const selectedMatch = espnMatches.find((m) => String(m.id) === String(selectedEspnId));
  const activeServer = streamData?.servers?.[activeServerIdx] || (streamData?.url ? streamData : null);

  const rawUrl = activeServer?.url || streamData?.url || "";
  const isHls = (activeServer?.type || streamData?.type) === "hls";
  const proxyEmbedUrl = rawUrl ? `/api/live/embed-proxy?url=${encodeURIComponent(rawUrl)}` : "";
  const finalIframeUrl = useProxy ? proxyEmbedUrl : rawUrl;

  const liveChannel: LiveChannel | null = isHls && rawUrl
    ? {
        _id: `test-${selectedEspnId}`,
        name: selectedMatch ? `${selectedMatch.homeTeam.name} vs ${selectedMatch.awayTeam.name}` : "Test Match",
        slug: `test-${selectedEspnId}`,
        categories: ["sports"],
        type: "hls",
        streamUrl: activeServer?.relayUrl || rawUrl,
        enabled: true,
        order: 0,
        isOnline: true,
      }
    : null;

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-2xl font-bold tracking-tight">Laboratoire de Test des Flux Sport</h1>
            </div>
            <p className="text-sm text-zinc-400 mt-1">
              Diagnostic en temps réel : matching ESPN ↔ Scrapers, résolution HLS/Iframe et validation de lecture.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadMatches}
              disabled={isLoadingLists}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold transition"
            >
              <ArrowsClockwise className={`h-4 w-4 ${isLoadingLists ? "animate-spin" : ""}`} />
              Actualiser les sources
            </button>
            <Link
              href="/matches"
              className="px-4 py-2 rounded-xl bg-[#1f1f1f] hover:bg-[#2a2a2a] text-sm font-medium transition"
            >
              Retour aux matchs
            </Link>
          </div>
        </div>

        {/* Grille principale */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Colonne Gauche : Sélection du match & Matchers (4 colonnes) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Boîte de recherche manuelle */}
            <div className="bg-[#161616] p-4 rounded-2xl border border-white/10">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
                Tester par ID ESPN direct
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: 708020"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  className="flex-1 bg-[#222] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FF6A00]"
                />
                <button
                  onClick={() => {
                    if (manualId.trim()) {
                      setSelectedEspnId(manualId.trim());
                    }
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-black"
                  style={{ background: PRIMARY }}
                >
                  Tester
                </button>
              </div>
            </div>

            {/* Liste des matchs ESPN */}
            <div className="bg-[#161616] p-4 rounded-2xl border border-white/10 max-h-[420px] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Matchs ESPN du Jour ({espnMatches.length})
                </h2>
                <span className="text-[11px] text-zinc-500">
                  {espnMatches.filter((m) => m.status === "live").length} en direct
                </span>
              </div>

              {isLoadingLists ? (
                <div className="space-y-2 py-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : espnMatches.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">Aucun match ESPN disponible.</p>
              ) : (
                <div className="space-y-2">
                  {espnMatches.map((m) => {
                    const isSelected = String(m.id) === String(selectedEspnId);
                    const isLive = m.status === "live";
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedEspnId(String(m.id))}
                        className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between ${
                          isSelected
                            ? "bg-[#252525] border-[#FF6A00]"
                            : "bg-[#1c1c1c] border-white/5 hover:bg-[#222]"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-semibold truncate text-white">
                            {m.homeTeam.name} vs {m.awayTeam.name}
                          </p>
                          <p className="text-[10px] text-zinc-400 truncate">
                            ID: {m.id} · {m.league.name}
                          </p>
                        </div>
                        {isLive ? (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF6A00] text-white">
                            {m.minute || "LIVE"}
                          </span>
                        ) : (
                          <span className="shrink-0 text-[11px] text-zinc-500 font-mono">
                            {m.homeTeam.score ?? 0} - {m.awayTeam.score ?? 0}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Liste des flux scrapers actifs */}
            <div className="bg-[#161616] p-4 rounded-2xl border border-white/10 max-h-[320px] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Flux Scrapers Détectés ({scraperMatches.length})
                </h2>
                <span className="text-[11px] text-emerald-400">
                  {scraperMatches.filter((s) => s.status === "live").length} Live
                </span>
              </div>
              {scraperMatches.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">Aucun flux scraper détecté actuellement.</p>
              ) : (
                <div className="space-y-1.5">
                  {scraperMatches.map((s, idx) => (
                    <div
                      key={`${s.source}-${s.sourceId}-${idx}`}
                      className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2">
                        <span className="font-bold text-zinc-300">
                          {s.home} vs {s.away}
                        </span>
                        <p className="text-[10px] text-zinc-500 font-mono">
                          [{s.source}] {s.sourceId}
                        </p>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          s.status === "live" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-zinc-400"
                        }`}
                      >
                        {s.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Colonne Droite : Lecteur vidéo & Diagnostics (8 colonnes) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Carte de lecture vidéo */}
            <div className="bg-[#161616] p-5 rounded-2xl border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Play weight="fill" className="h-4 w-4" style={{ color: PRIMARY }} />
                    {selectedMatch
                      ? `${selectedMatch.homeTeam.name} vs ${selectedMatch.awayTeam.name}`
                      : `Match ID: ${selectedEspnId || "Aucun"}`}
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Source résolue :{" "}
                    <span className="font-mono text-zinc-200">
                      {streamData?.source ? `${streamData.source} (${streamData.sourceId})` : "En attente"}
                    </span>
                  </p>
                </div>

                {/* Switcher proxy */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useProxy}
                      onChange={(e) => setUseProxy(e.target.checked)}
                      className="rounded accent-[#FF6A00]"
                    />
                    <span>Utiliser /api/live/embed-proxy</span>
                  </label>
                  <button
                    onClick={() => testStreamResolution(selectedEspnId)}
                    disabled={isResolvingStream}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300"
                    title="Rafraîchir ce flux"
                  >
                    <ArrowsClockwise className={`h-4 w-4 ${isResolvingStream ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Écran du Player */}
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-white/10 flex items-center justify-center">
                {isResolvingStream ? (
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="h-10 w-10 animate-spin rounded-full border-3 border-t-transparent"
                      style={{ borderColor: `${PRIMARY} transparent transparent transparent` }}
                    />
                    <p className="text-xs text-zinc-400">Résolution du flux en direct...</p>
                  </div>
                ) : resolveError ? (
                  <div className="flex flex-col items-center gap-2 p-6 text-center max-w-md">
                    <XCircle className="h-8 w-8 text-rose-500" />
                    <p className="text-sm font-semibold text-rose-400">Flux non disponible</p>
                    <p className="text-xs text-zinc-400">{resolveError}</p>
                  </div>
                ) : isHls && liveChannel ? (
                  <div className="h-full w-full">
                    <LivePlayer channel={liveChannel} onBack={() => {}} fill />
                  </div>
                ) : rawUrl ? (
                  <iframe
                    key={`${finalIframeUrl}-${useProxy}`}
                    src={finalIframeUrl}
                    title="Flux de test"
                    className="h-full w-full border-0"
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <div className="text-zinc-600 text-xs">Sélectionnez un match pour tester son flux</div>
                )}
              </div>

              {/* Sélecteur de serveurs si multiple */}
              {streamData?.servers && streamData.servers.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="text-xs text-zinc-400 font-semibold mr-1">Serveurs :</span>
                  {streamData.servers.map((s: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setActiveServerIdx(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        activeServerIdx === idx
                          ? "bg-[#FF6A00] text-white"
                          : "bg-white/10 hover:bg-white/15 text-zinc-300"
                      }`}
                    >
                      {s.name || `Serveur ${idx + 1}`} ({s.type || "iframe"})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Diagnostic technique & Données JSON */}
            <div className="bg-[#161616] p-5 rounded-2xl border border-white/10 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                Diagnostic & Données Techniques
              </h3>

              {streamData ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                      <p className="text-[11px] text-zinc-500 uppercase font-semibold">Fournisseur</p>
                      <p className="text-sm font-bold text-emerald-400 capitalize">{streamData.source}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                      <p className="text-[11px] text-zinc-500 uppercase font-semibold">Type de Flux</p>
                      <p className="text-sm font-bold text-sky-400 uppercase">{activeServer?.type || streamData.type}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                      <p className="text-[11px] text-zinc-500 uppercase font-semibold">Serveurs Disponibles</p>
                      <p className="text-sm font-bold text-amber-400">{streamData.servers?.length || 1}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-black/60 border border-white/5 space-y-2 font-mono text-xs">
                    <div>
                      <span className="text-zinc-500">URL directe source : </span>
                      <a
                        href={rawUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-400 underline break-all inline-flex items-center gap-1"
                      >
                        {rawUrl}
                        <ArrowSquareOut className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                    {proxyEmbedUrl && (
                      <div>
                        <span className="text-zinc-500">URL avec proxy : </span>
                        <span className="text-sky-300 break-all">{proxyEmbedUrl}</span>
                      </div>
                    )}
                    {activeServer?.relayUrl && (
                      <div>
                        <span className="text-zinc-500">URL Relais HLS Backend : </span>
                        <span className="text-emerald-300 break-all">{activeServer.relayUrl}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic">
                  Aucune donnée de stream à afficher pour le moment.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
