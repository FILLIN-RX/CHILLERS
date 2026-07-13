"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { MovieOrShow, MOCK_MEDIA } from "@/app/mockData";
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  XMarkIcon,
  ListBulletIcon,
  ForwardIcon,
  BackwardIcon,
  Cog6ToothIcon,
  ChevronRightIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/solid";

interface VideoPlayerProps {
  item: MovieOrShow;
  onBack: () => void;
  onOpenDetails: (item: MovieOrShow) => void;
}

export default function VideoPlayer({ item, onBack, onOpenDetails }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    console.log("VideoPlayer - URL set to:", item.videoUrl);
  }, [item.videoUrl]);

  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Custom Player States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [quality, setQuality] = useState("1080p");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isEpisodeDrawerOpen, setIsEpisodeDrawerOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Active Episode (if series or anime)
  const [activeEpisodeIndex, setActiveEpisodeIndex] = useState(0);
  const hasEpisodes = item.episodes && item.episodes.length > 0;
  const currentEpisode = hasEpisodes && item.episodes ? item.episodes[activeEpisodeIndex] : null;

  // ─── EFFECTS ────────────────────────────────────────────────────────────────  // Auto-hide controls logic
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying && !isEpisodeDrawerOpen && !showSettings) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying, isEpisodeDrawerOpen, showSettings]);

  useEffect(() => {
    const handleMouseMove = () => resetControlsTimeout();
    window.addEventListener("mousemove", handleMouseMove);
    resetControlsTimeout();
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControlsTimeout]);

  // Load progress
  useEffect(() => {
    const key = `chiller_progress_${item.id}`;
    const saved = localStorage.getItem(key);
    if (saved && videoRef.current) {
      const parsed = JSON.parse(saved);
      const handleMetadata = () => {
        if (videoRef.current) videoRef.current.currentTime = parsed.time;
      };
      videoRef.current.addEventListener("loadedmetadata", handleMetadata);
      return () => videoRef.current?.removeEventListener("loadedmetadata", handleMetadata);
    }
  }, [item.id]);

  // Save progress
  useEffect(() => {
    if (currentTime > 0 && duration > 0) {
      const progressPercent = Math.min((currentTime / duration) * 100, 100);
      localStorage.setItem(`chiller_progress_${item.id}`, JSON.stringify({
        id: item.id,
        time: currentTime,
        duration: duration,
        progress: progressPercent,
        remaining: `${Math.round((duration - currentTime) / 60)}m left`,
        episodeName: currentEpisode ? `S1:E${currentEpisode.number}` : undefined,
        updatedAt: Date.now(),
      }));
    }
  }, [currentTime, duration, item.id, currentEpisode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case "Space":
          e.preventDefault();
          handlePlayPause();
          break;
        case "ArrowLeft":
          handleSkip(-10);
          break;
        case "ArrowRight":
          handleSkip(10);
          break;
        case "KeyF":
          toggleFullscreen();
          break;
        case "KeyM":
          toggleMute();
          break;
        case "Escape":
          if (isEpisodeDrawerOpen) setIsEpisodeDrawerOpen(false);
          else if (showSettings) setShowSettings(false);
          else onBack();
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, isEpisodeDrawerOpen, showSettings]);

  // ─── HANDLERS ───────────────────────────────────────────────────────────────

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play().catch(console.error);
      setIsPlaying(!isPlaying);
    }
  };

  const handleSkip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(Math.max(videoRef.current.currentTime + seconds, 0), duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const next = !isMuted;
      setIsMuted(next);
      videoRef.current.muted = next;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return `${h > 0 ? h + ":" : ""}${m < 10 && h > 0 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const isIframe = item.videoUrl?.includes("youtube.com") || item.videoUrl?.includes("embed");

  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { startDownload, triggerDownload } = await import('@/app/api');
      const type = item.type === 'series' && currentEpisode ? 'series' : 'movie';
      const title = item.title;
      const m3u8 = await startDownload(
        String(item.id),
        type,
        title,
        undefined,
        currentEpisode?.number
      );
      if (m3u8) {
        triggerDownload(m3u8, `${title || 'video'}.mp4`);
      } else {
        alert('Aucune source de téléchargement trouvée');
      }
    } catch (err) {
      console.error('Download failed:', err);
      alert('Erreur lors du téléchargement');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`w-full relative z-[9999] bg-black rounded-lg overflow-hidden transition-opacity duration-500 ${showControls ? "cursor-default" : "cursor-none"}`}
    >
      {/* ─── VIDEO / CONTENT ─────────────────────────────────────────────── */}
      {isIframe ? (
        <iframe
          src={`${item.videoUrl}?autoplay=1&controls=1&rel=0&modestbranding=1`}
          className="w-full aspect-video border-none"
          allow="autoplay; encrypted-media; fullscreen"
          title={item.title}
        />
      ) : item.videoUrl ? (
        <video
          ref={videoRef}
          src={item.videoUrl}
          className="w-full h-full object-contain"
          autoPlay
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
          onClick={handlePlayPause}
        />
      ) : (
        <div className="text-zinc-500 font-medium">Flux indisponible</div>
      )}

      {/* ─── HUD OVERLAYS (Only for Native Video) ────────────────────────── */}
      {!isIframe && (
        <>
          {/* Gradient Shadows */}
          <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 pointer-events-none transition-opacity duration-500 ${showControls || !isPlaying ? "opacity-100" : "opacity-0"}`} />

          {/* TOP BAR */}
          <div className={`absolute top-0 inset-x-0 p-6 flex items-start justify-between transition-all duration-500 transform ${showControls || !isPlaying ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"}`}>
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <span className="text-[#D70466] font-black tracking-tighter text-xl">CHILLERS+</span>
                <div className="h-4 w-[1px] bg-white/20" />
                <h1 className="text-white font-bold text-lg flex items-center gap-2">
                  {item.title}
                  {currentEpisode && (
                    <>
                      <ChevronRightIcon className="h-4 w-4 text-white/40" />
                      <span className="text-white/80">S1:E{currentEpisode.number} - {currentEpisode.title}</span>
                    </>
                  )}
                </h1>
              </div>
              <p className="text-white/50 text-xs font-medium mt-1 uppercase tracking-widest">
                {item.genres.join(" • ")}
              </p>
            </div>

            <div className="flex items-center gap-6">
              {/* Volume */}
              <div className="flex items-center gap-3 group/vol">
                <button onClick={toggleMute} className="text-white hover:text-[#D70466] transition-colors">
                  {isMuted || volume === 0 ? <SpeakerXMarkIcon className="h-6 w-6" /> : <SpeakerWaveIcon className="h-6 w-6" />}
                </button>
                <input 
                  type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setVolume(v);
                    if (videoRef.current) videoRef.current.volume = v;
                    setIsMuted(v === 0);
                  }}
                  className="w-0 group-hover/vol:w-24 transition-all duration-300 h-1 bg-white/20 appearance-none rounded-full accent-[#D70466]"
                />
              </div>

              {/* Exit */}
              <button 
                onClick={onBack}
                className="p-2 rounded-full hover:bg-white/10 text-white transition-all transform hover:rotate-90"
              >
                <XMarkIcon className="h-7 w-7" />
              </button>
            </div>
          </div>

          {/* BOTTOM BAR */}
          <div className={`absolute bottom-0 inset-x-0 transition-all duration-500 transform ${showControls || !isPlaying ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
            
            {/* Timeline */}
            <div className="px-6 group/timeline relative">
              <input 
                type="range" min="0" max={duration || 100} value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 group-hover/timeline:h-2 bg-white/20 appearance-none cursor-pointer rounded-full accent-[#D70466] transition-all"
              />
              <div className="flex justify-between mt-2 text-[10px] font-bold text-white/60 uppercase tracking-widest">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="p-6 pt-2 flex items-center justify-between">
              <div className="flex items-center gap-8">
                <button onClick={() => handleSkip(-10)} className="text-white/70 hover:text-white transition-colors">
                  <BackwardIcon className="h-7 w-7" />
                </button>
                <button onClick={handlePlayPause} className="bg-white text-black p-4 rounded-full hover:scale-110 transition-transform shadow-xl">
                  {isPlaying ? <PauseIcon className="h-8 w-8" /> : <PlayIcon className="h-8 w-8 translate-x-0.5" />}
                </button>
                <button onClick={() => handleSkip(10)} className="text-white/70 hover:text-white transition-colors">
                  <ForwardIcon className="h-7 w-7" />
                </button>
              </div>

              <div className="flex items-center gap-6">
                {hasEpisodes && (
                  <button 
                    onClick={() => setIsEpisodeDrawerOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 text-white text-sm font-bold hover:bg-white/10 transition-all"
                  >
                    <ListBulletIcon className="h-5 w-5" /> Episodes
                  </button>
                )}
                <button 
                  onClick={handleDownload}
                  disabled={downloading}
                  className={`text-white transition-colors ${downloading ? "opacity-50 animate-pulse" : "hover:text-[#D70466]"}`}
                >
                  <ArrowDownTrayIcon className="h-6 w-6" />
                </button>
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className={`text-white transition-colors ${showSettings ? "text-[#D70466]" : "hover:text-[#D70466]"}`}
                >
                  <Cog6ToothIcon className="h-6 w-6" />
                </button>
                <button onClick={toggleFullscreen} className="text-white hover:text-[#D70466] transition-colors">
                  {isFullscreen ? <ArrowsPointingInIcon className="h-6 w-6" /> : <ArrowsPointingOutIcon className="h-6 w-6" />}
                </button>
              </div>
            </div>
          </div>

          {/* ─── FLOATING MENUS ────────────────────────────────────────────── */}

          {/* Episode Drawer */}
          {isEpisodeDrawerOpen && (
            <div className="absolute inset-y-0 right-0 w-full sm:w-96 bg-black/95 backdrop-blur-xl border-l border-white/10 z-[100] p-8 animate-in slide-in-from-right duration-300">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-white">Episodes</h2>
                <button onClick={() => setIsEpisodeDrawerOpen(false)} className="text-white/50 hover:text-white">
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <div className="space-y-4 overflow-y-auto h-[calc(100%-80px)] pr-2 custom-scrollbar">
                {item.episodes?.map((ep, idx) => (
                  <div 
                    key={ep.id}
                    onClick={() => {
                      setActiveEpisodeIndex(idx);
                      if (videoRef.current) {
                        videoRef.current.src = item.videoUrl || '';
                        videoRef.current.load();
                        videoRef.current.play();
                      }
                      setIsEpisodeDrawerOpen(false);
                    }}
                    className={`group flex gap-4 p-3 rounded-2xl cursor-pointer transition-all ${activeEpisodeIndex === idx ? "bg-[#D70466]/20 border border-[#D70466]/30" : "hover:bg-white/5 border border-transparent"}`}
                  >
                    <div className="relative w-32 aspect-video rounded-lg overflow-hidden bg-zinc-900 flex-none shadow-lg">
                      <img src={ep.thumbnail} alt={ep.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <PlayIcon className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <div className="flex flex-col justify-center min-w-0">
                      <span className="text-[#D70466] text-[10px] font-black uppercase tracking-tighter">Episode {ep.number}</span>
                      <h3 className="text-white font-bold text-sm truncate">{ep.title}</h3>
                      <span className="text-white/40 text-[10px] font-medium">{ep.duration}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings Menu */}
          {showSettings && (
            <div className="absolute bottom-24 right-6 w-64 bg-black/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 z-[100] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-6">
                <div>
                  <label className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-3 block">Playback Speed</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[0.5, 1, 1.5, 2].map((s) => (
                      <button 
                        key={s} onClick={() => {
                          setPlaybackSpeed(s);
                          if (videoRef.current) videoRef.current.playbackRate = s;
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${playbackSpeed === s ? "bg-[#D70466] text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-3 block">Quality</label>
                  <div className="flex flex-col gap-2">
                    {["1080p", "720p", "Auto"].map((q) => (
                      <button 
                        key={q} onClick={() => setQuality(q)}
                        className={`w-full text-left px-4 py-2 rounded-xl text-xs font-bold transition-all ${quality === q ? "bg-[#D70466]/20 text-[#D70466]" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
