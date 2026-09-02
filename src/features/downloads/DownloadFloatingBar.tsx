"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  IconX,
  IconCheck,
  IconAlertTriangle,
  IconGripVertical,
  IconDownload,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { useDownloadsStore } from "@/store/downloads";
import { streamDownloadToDisk } from "@/services/streamSaver";
import { formatBytes } from "@/lib/format";
import { useHydrated } from "@/hooks/useHydrated";
import DownloadProgressBar from "./DownloadProgressBar";

/**
 * Floating bar that appears when one or more downloads are active in the
 * background. On desktop: a small panel. On mobile: a compact bubble
 * that expands on tap. Draggable via the header grip.
 *
 * Also shows paused tasks (e.g. after page reload) with a resume button.
 */
export default function DownloadFloatingBar() {
  const hydrated = useHydrated();
  const tasks = useDownloadsStore((s) => s.tasks);
  const requestCancel = useDownloadsStore((s) => s.requestCancel);
  const getController = useDownloadsStore((s) => s.getController);
  const setController = useDownloadsStore((s) => s.setController);
  const removeController = useDownloadsStore((s) => s.removeController);
  const setStatus = useDownloadsStore((s) => s.setStatus);
  const setProgress = useDownloadsStore((s) => s.setProgress);
  const isCancelRequested = useDownloadsStore((s) => s.isCancelRequested);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Drag state
  const barRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    startPosX: 0,
    startPosY: 0,
    moved: false,
  });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: rect.left,
      startPosY: rect.top,
      moved: false,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.isDragging || !barRef.current) return;
    e.preventDefault();
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragRef.current.moved = true;
    const parentW = window.innerWidth;
    const parentH = window.innerHeight;
    const barW = barRef.current.offsetWidth;
    const barH = barRef.current.offsetHeight;
    const x = Math.min(Math.max(dragRef.current.startPosX + dx, 0), parentW - barW);
    const y = Math.min(Math.max(dragRef.current.startPosY + dy, 0), parentH - barH);
    setPosition({ x, y });
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current.isDragging = false;
  }, []);

  // Tasks: active + paused (reload) + recently done
  const active = tasks.filter(
    (t) => t.status === "downloading" || t.status === "resolving",
  );
  const paused = tasks.filter((t) => t.status === "paused");
  const recentDone = tasks.filter(
    (t) => t.status === "done" && Date.now() - t.updatedAt < 8_000,
  );
  const visible = [...active, ...paused, ...recentDone];

  if (visible.length === 0 || dismissed) return null;

  const handleCancel = (taskId: string) => {
    requestCancel(taskId);
    const ctrl = getController(taskId);
    ctrl?.abort();
  };

  const handleResume = async (t: (typeof tasks)[0]) => {
    if (!t.resolvedUrl) return;

    const ctrl = new AbortController();
    setController(t.id, ctrl);
    setStatus(t.id, "downloading");

    try {
      await streamDownloadToDisk(t.resolvedUrl, {
        filename: t.filename,
        signal: ctrl.signal,
        onProgress: (bytes, total) => {
          setProgress(t.id, {
            bytesDownloaded: bytes,
            totalBytes: total,
            percent:
              total && total > 0
                ? Math.min(100, Math.round((bytes / total) * 100))
                : null,
          });
        },
      });

      if (ctrl.signal.aborted || isCancelRequested(t.id)) {
        setStatus(t.id, "canceled");
      } else {
        setStatus(t.id, "done");
      }
    } catch (err) {
      if (ctrl.signal.aborted || isCancelRequested(t.id)) {
        setStatus(t.id, "canceled");
      } else {
        const message = err instanceof Error ? err.message : String(err);
        setStatus(t.id, "error", message);
      }
    } finally {
      removeController(t.id);
    }
  };

  const handleHeaderClick = () => {
    if (dragRef.current.moved) return;
    setExpanded((v) => !v);
  };

  const handleBubbleClick = () => {
    if (dragRef.current.moved) return;
    setExpanded(true);
  };

  // Don't render until hydrated to avoid SSR/client mismatch on isMobile state
  if (!hydrated) {
    return null;
  }

  // --- MOBILE BUBBLE ---
  if (isMobile && !expanded) {
    const bubblePos: React.CSSProperties = position
      ? { top: position.y, left: position.x, right: "auto", bottom: "auto" }
      : { bottom: 80, right: 16 };

    const doneCount = recentDone.length;
    const totalActive = active.length + paused.length;

    return (
      <div
        ref={barRef}
        className="fixed z-[9998] animate-slide-up"
        style={bubblePos}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={handleBubbleClick}
          className="relative w-12 h-12 rounded-full bg-brand-primary shadow-lg shadow-brand-primary/30 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <IconDownload className="h-5 w-5 text-white" />
          {totalActive > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-white text-[10px] font-bold text-black flex items-center justify-center">
              {totalActive}
            </span>
          )}
          {totalActive === 0 && doneCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-[10px] font-bold text-white flex items-center justify-center">
              ✓
            </span>
          )}
          {/* Mini progress ring */}
          {active.length > 0 && active[0].totalBytes != null && (
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
              <circle
                cx="24" cy="24" r="22" fill="none" stroke="white" strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 22}`}
                strokeDashoffset={`${2 * Math.PI * 22 * (1 - (active[0].bytesDownloaded / active[0].totalBytes))}`}
                strokeLinecap="round"
                className="transition-[stroke-dashoffset] duration-300"
              />
            </svg>
          )}
          {/* Close button */}
          <button
            onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors"
            aria-label="Fermer"
          >
            <IconX className="h-2.5 w-2.5 text-zinc-300" />
          </button>
        </div>
      </div>
    );
  }

  // --- DESKTOP PANEL / MOBILE EXPANDED ---
  const style: React.CSSProperties = position
    ? { top: position.y, left: position.x, right: "auto", bottom: "auto" }
    : { bottom: 16, right: 16 };

  return (
    <div
      ref={barRef}
      className="fixed z-[9998] w-72 sm:w-80 max-w-[calc(100vw-2rem)] animate-slide-up"
      style={style}
    >
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
        {/* Draggable header */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={handleHeaderClick}
          className="flex items-center justify-between px-3 py-2 border-b border-white/8 cursor-grab active:cursor-grabbing select-none touch-none"
        >
          <div className="flex items-center gap-2">
            <IconGripVertical className="h-3.5 w-3.5 text-zinc-600" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Téléchargement{active.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {isMobile && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"
                aria-label="Réduire"
              >
                <IconX className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"
              aria-label="Masquer"
            >
              <IconX className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Task list */}
        <div className="max-h-60 overflow-y-auto">
          {visible.map((t) => {
            const percent =
              t.totalBytes && t.totalBytes > 0
                ? Math.min(100, Math.round((t.bytesDownloaded / t.totalBytes) * 100))
                : null;

            return (
              <div
                key={t.id}
                className="px-3 py-2.5 border-b border-white/5 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-white truncate flex-1 min-w-0">
                    {t.title}
                    {t.episodeNumber != null && (
                      <span className="text-zinc-500 font-normal ml-1 text-[10px]">
                        S{String(t.season ?? 1).padStart(2, "0")}E{String(t.episodeNumber).padStart(2, "0")}
                      </span>
                    )}
                  </p>

                  <div className="flex items-center gap-1.5 flex-none">
                    {t.status === "done" && (
                      <IconCheck className="h-3 w-3 text-emerald-400" />
                    )}
                    {t.status === "error" && (
                      <IconAlertTriangle className="h-3 w-3 text-rose-400" />
                    )}
                    {t.status === "paused" && t.resolvedUrl && (
                      <button
                        onClick={() => handleResume(t)}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-[10px] font-bold text-brand-primary hover:text-white transition-colors"
                      >
                        <IconPlayerPlay className="h-3 w-3" /> Reprendre
                      </button>
                    )}
                    {(t.status === "downloading" || t.status === "resolving") && (
                      <button
                        onClick={() => handleCancel(t.id)}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="text-[10px] text-zinc-500 hover:text-white transition-colors"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                </div>

                <DownloadProgressBar
                  bytesDownloaded={t.bytesDownloaded}
                  totalBytes={t.totalBytes}
                  status={t.status}
                />

                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] text-zinc-500">
                    {t.status === "resolving"
                      ? "Recherche…"
                      : t.status === "downloading"
                      ? percent != null ? `${percent}%` : "…"
                      : t.status === "paused"
                      ? "Interrompu — reprendre ?"
                      : t.status === "done"
                      ? "OK"
                      : ""}
                  </span>
                  {t.status === "downloading" && t.totalBytes != null && (
                    <span className="text-[10px] text-zinc-500">
                      {formatBytes(t.bytesDownloaded)} / {formatBytes(t.totalBytes)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
