'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Spinner, SkipForward, ArrowsClockwise } from '@phosphor-icons/react';
import HilltopAd, { HILLTOP_ZONE_ORDER, getHilltopZoneForSlot } from '@/components/HilltopAd';
import { AD_INTERVAL_SECONDS, useMidrollVastAd } from '@/hooks/useMidrollVastAd';

/** Échantillon local de 5 min (généré via ffmpeg) : déclenche 2 ruptures (120 s, 240 s). */
const DEFAULT_SRC = '/test-sample-300s.mp4';

function isHls(src: string): boolean {
  return /\.m3u8(\?|$)/i.test(src);
}

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function TestPlayerPage() {
  const [src, setSrc] = useState(DEFAULT_SRC);
  const [inputValue, setInputValue] = useState(DEFAULT_SRC);
  const [isStarted, setIsStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [nextBreakTime, setNextBreakTime] = useState(AD_INTERVAL_SECONDS);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const gestureDoneRef = useRef(false);

  const mediaKey = useMemo(() => src, [src]);

  const {
    adContainerRef,
    adVideoRef,
    midrollState,
    remainingSeconds,
    skipSeconds,
    canSkip,
    skipAd,
    onContentTimeUpdate,
    onContentSeeked,
    initializeFromUserGesture,
    cancelMidrollForUserControl,
    nextBreakRef,
    intervalSeconds,
    isConfigured,
  } = useMidrollVastAd(videoRef, mediaKey, { intervalSeconds: AD_INTERVAL_SECONDS });

  const pushLog = useCallback((message: string) => {
    const stamp = new Date().toLocaleTimeString('fr-FR');
    setLog((prev) => [`[${stamp}] ${message}`, ...prev].slice(0, 12));
  }, []);

  /* ─── Chargement source (MP4 natif ou HLS via hls.js) ─── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setIsStarted(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setNextBreakTime(AD_INTERVAL_SECONDS);
    pushLog(`Source chargée : ${src.slice(0, 80)}`);

    if (!isHls(src)) {
      video.src = src;
      return () => {
        video.removeAttribute('src');
        video.load();
      };
    }

    if (!Hls.isSupported()) {
      video.src = src;
      return () => {
        video.removeAttribute('src');
        video.load();
      };
    }

    const hls = new Hls({ enableWorker: true });
    hlsRef.current = hls;
    hls.loadSource(src);
    hls.attachMedia(video);
    return () => {
      hls.destroy();
      hlsRef.current = null;
    };
  }, [src, pushLog]);

  /* ─── État de la pub → journal de test ─── */
  useEffect(() => {
    const entry =
      midrollState === 'loading'
        ? 'PUB : chargement de la création VAST…'
        : midrollState === 'playing'
          ? 'PUB : lecture en cours (contenu en pause)'
          : 'PUB : terminée, reprise du contenu';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    pushLog(entry);
  }, [midrollState, pushLog]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) setCurrentTime(video.currentTime);
    onContentTimeUpdate();
    // Lecture du ref en callback (interdite pendant le rendu).
    setNextBreakTime(nextBreakRef.current || AD_INTERVAL_SECONDS);
  }, [nextBreakRef, onContentTimeUpdate]);

  const handleLoadedMetadata = useCallback(() => {
    setDuration(videoRef.current?.duration ?? 0);
  }, []);

  const startPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    gestureDoneRef.current = true;
    initializeFromUserGesture();
    video.muted = false;
    video.play().catch(() => {
      // Blocage autoplay : on retente en muet.
      video.muted = true;
      video.play().catch(() => undefined);
    });
    setIsStarted(true);
    setIsPlaying(true);
  }, [initializeFromUserGesture]);

  const handlePlay = useCallback(() => {
    if (!gestureDoneRef.current) initializeFromUserGesture();
    setIsPlaying(true);
    setIsStarted(true);
  }, [initializeFromUserGesture]);

  const handlePause = useCallback(() => {
    // Une pub en cours gère elle-même la reprise du contenu.
    if (midrollState === 'idle') setIsPlaying(false);
  }, [midrollState]);

  const handleContainerPointer = useCallback(() => {
    initializeFromUserGesture();
  }, [initializeFromUserGesture]);

  const seekTo = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video) return;
      const target = Math.max(0, Math.min(duration || video.duration || 0, time));
      video.currentTime = target;
      setCurrentTime(target);
      onContentSeeked(target);
      cancelMidrollForUserControl();
      video.play().catch(() => undefined);
      setIsPlaying(true);
      setIsStarted(true);
      pushLog(`Saut vers ${formatTime(target)}`);
    },
    [cancelMidrollForUserControl, duration, onContentSeeked, pushLog],
  );

  /** Saut 10 s avant la prochaine rupture pour vérifier le déclenchement. */
  const jumpToNextAd = useCallback(() => {
    const next = nextBreakRef.current;
    seekTo(Math.max(0, next - 10));
    pushLog(`Test : prochaine pub prévue à ${formatTime(next)} (saut à ${formatTime(Math.max(0, next - 10))})`);
  }, [nextBreakRef, pushLog, seekTo]);

  const reloadSource = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    setCurrentTime(0);
    onContentSeeked(0);
    video.play().catch(() => undefined);
    pushLog('Lecture relancée depuis le début');
  }, [onContentSeeked, pushLog]);

  const applySource = useCallback(() => {
    const next = inputValue.trim();
    if (!next) return;
    setSrc(next);
  }, [inputValue]);

  const secondsToNextAd = Math.max(0, nextBreakTime - currentTime);

  return (
    <div className="min-h-screen bg-[#060608] text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
        {/* ─── En-tête ─── */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Test Player — Lecteur + publicités</h1>
            <p className="text-sm text-zinc-400">
              Bannières Hilltop sur le lecteur · pub vidéo VAST toutes les{' '}
              <span className="font-semibold text-white">{AD_INTERVAL_SECONDS / 60} minutes</span>
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-[#141416] px-3 py-1.5 text-xs font-semibold text-zinc-300">
            {isConfigured ? 'VAST Hilltop : configuré' : 'VAST Hilltop : non configuré'}
          </span>
        </div>

        {/* ─── Lecteur ─── */}
        <div
          onPointerDownCapture={handleContainerPointer}
          className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[#222222] bg-black"
        >
          <video
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full bg-black"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeeked={() => onContentSeeked(videoRef.current?.currentTime ?? 0)}
          />

          {/* Bannière pub SUR le lecteur (haut gauche) */}
          <div className="pointer-events-auto absolute left-3 top-3 z-30 max-w-[min(70%,420px)] rounded-lg border border-white/15 bg-black/70 p-1 backdrop-blur-sm">
            <HilltopAd
              zone={getHilltopZoneForSlot(1)}
              label="Publicité sur le lecteur (haut)"
              className="flex w-full items-center justify-center overflow-hidden"
            />
          </div>

          {/* Compteur : prochaine pub vidéo */}
          <div className="pointer-events-none absolute right-3 top-3 z-30 rounded-lg border border-white/15 bg-black/70 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm">
            {midrollState === 'idle' || midrollState === undefined ? (
              <>
                Prochaine pub vidéo dans{' '}
                <span className="font-mono text-brand-primary">{formatTime(secondsToNextAd)}</span>
              </>
            ) : (
              <span className="text-brand-primary">Publicité en cours…</span>
            )}
          </div>

          {/* Bouton de lancement */}
          {!isStarted && (
            <button
              type="button"
              onClick={startPlayback}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/50 transition-colors hover:bg-black/40"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary shadow-[0_0_30px_rgba(215,4,102,0.5)]">
                <Play size={34} weight="fill" className="ml-1 text-white" />
              </span>
              <span className="text-sm font-semibold text-white">Lancer la lecture</span>
            </button>
          )}

          {/* Voile pub vidéo (mirror du VideoPlayer) */}
          {isConfigured && (
            <div
              ref={adContainerRef}
              aria-live="polite"
              className={`absolute inset-0 z-40 bg-black transition-opacity duration-200 ${
                midrollState === 'idle' ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100'
              }`}
            >
              <video ref={adVideoRef} className="absolute inset-0 -z-10 h-full w-full object-contain" playsInline />
              {midrollState === 'loading' && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/90 text-white">
                  <Spinner className="h-8 w-8 animate-spin" />
                  <p className="text-sm text-white/80">La publicité démarre automatiquement…</p>
                  <p className="text-xs text-white/55">Vous pourrez reprendre la vidéo après.</p>
                </div>
              )}
              {midrollState === 'playing' && (
                <>
                  <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-md bg-black/70 px-3 py-2 text-xs text-white/90">
                    Publicité{remainingSeconds !== null ? ` · ${remainingSeconds} s` : ' en cours'}
                  </div>
                  <button
                    type="button"
                    onClick={skipAd}
                    disabled={!canSkip}
                    className={`absolute bottom-4 right-4 z-20 rounded-[5px] border px-3 py-2 text-xs font-semibold transition-colors ${
                      canSkip
                        ? 'cursor-pointer border-white/40 bg-black/70 text-white hover:bg-black/90'
                        : 'cursor-not-allowed border-white/15 bg-black/50 text-white/50'
                    }`}
                  >
                    {canSkip ? 'Passer la pub' : `Passer dans ${skipSeconds} s`}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ─── Contrôles de test ─── */}
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#141416] p-2">
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applySource();
              }}
              spellCheck={false}
              aria-label="URL de la vidéo"
              className="min-w-0 flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-zinc-600"
              placeholder="URL .mp4 ou .m3u8…"
            />
            <button
              type="button"
              onClick={applySource}
              className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/20"
            >
              Charger
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={jumpToNextAd}
              className="flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-xs font-bold text-white shadow-[0_0_20px_rgba(215,4,102,0.4)] transition-all hover:bg-[#E91E63]"
            >
              <SkipForward size={15} weight="bold" />
              Aller à la pub suivante
            </button>
            <button
              type="button"
              onClick={reloadSource}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#141416] px-4 py-2.5 text-xs font-bold text-zinc-200 transition-colors hover:bg-white/10"
            >
              <ArrowsClockwise size={15} weight="bold" />
              Recommencer
            </button>
          </div>
        </div>

        {/* ─── Barre d'état + bannière secondaire ─── */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-[#141416] p-4 text-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">État du lecteur</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  midrollState === 'idle'
                    ? 'bg-white/10 text-zinc-300'
                    : 'bg-brand-primary text-white'
                }`}
              >
                {midrollState === 'idle' ? 'Contenu' : midrollState === 'loading' ? 'Pub : chargement' : 'Pub : lecture'}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-xs text-zinc-400">
              <dt>Position</dt>
              <dd className="text-right font-mono text-white">{formatTime(currentTime)}</dd>
              <dt>Durée</dt>
              <dd className="text-right font-mono text-white">{formatTime(duration)}</dd>
              <dt>Intervalle pub</dt>
              <dd className="text-right font-mono text-white">{intervalSeconds ? `${intervalSeconds} s` : '—'}</dd>
              <dt>Prochaine rupture</dt>
              <dd className="text-right font-mono text-white">{formatTime(nextBreakTime || 0)}</dd>
              <dt>Lecture</dt>
              <dd className="text-right text-white">{isPlaying ? 'en cours' : 'pause'}</dd>
            </dl>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#141416] p-4">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Journal des pubs</span>
            <ul className="mt-3 space-y-1.5 font-mono text-[11px] leading-relaxed text-zinc-400">
              {log.length === 0 && <li className="text-zinc-600">En attente de lecture…</li>}
              {log.map((entry, index) => (
                <li key={`${entry}-${index}`} className={index === 0 ? 'text-white' : ''}>
                  {entry}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ─── Bannières Hilltop : slots disponibles (zones) ─── */}
        <div className="mt-6 rounded-xl border border-white/10 bg-[#141416] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Bannières Hilltop (zones injectées)
            </span>
            <span className="text-[11px] text-zinc-500">{HILLTOP_ZONE_ORDER.length} zones disponibles</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {HILLTOP_ZONE_ORDER.map((zone, index) => (
              <div key={zone} className="rounded-lg border border-white/10 bg-black/40 p-2">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                  slot {index + 1} — {getHilltopZoneForSlot(index + 1)}
                </p>
                <HilltopAd zone={zone} label={`Publicité zone ${index + 1}`} className="flex w-full items-center justify-center overflow-hidden" />
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-zinc-600">
          Défile la vidéo (ou utilise « Aller à la pub suivante ») : la pub VAST Hilltop démarre automatiquement{' '}
          {AD_INTERVAL_SECONDS} s après le début puis toutes les {AD_INTERVAL_SECONDS} s.
        </p>
      </div>
    </div>
  );
}
