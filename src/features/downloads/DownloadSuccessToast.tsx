"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, DownloadSimple, X, ArrowRight } from "@phosphor-icons/react";
import {
  DOWNLOAD_SUCCESS_EVENT,
  type DownloadSuccessPayload,
} from "@/hooks/useDownloadToast";

const TOAST_DURATION_MS = 5000;

interface ToastItem extends DownloadSuccessPayload {
  uid: string; // unique per toast instance (task can complete multiple times)
}

/**
 * Global toast container.
 * Listens for `chillers:download:success` events and renders stacked
 * success toasts in the bottom-right corner.
 *
 * Design constraints from product:
 * - border-radius: 2px max (sharp, premium feel)
 * - auto-dismiss after 5 s with animated progress bar
 * - stacks up to 3 visible toasts, older ones fade out first
 */
export default function DownloadSuccessToast() {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((uid: string) => {
    clearTimeout(timers.current.get(uid));
    timers.current.delete(uid);
    setToasts((prev) => prev.filter((t) => t.uid !== uid));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const payload = (e as CustomEvent<DownloadSuccessPayload>).detail;
      const uid = `${payload.id}-${Date.now()}`;

      setToasts((prev) => {
        // Keep at most 3 visible toasts — drop the oldest
        const next = [...prev, { ...payload, uid }];
        if (next.length > 3) {
          const removed = next.shift()!;
          clearTimeout(timers.current.get(removed.uid));
          timers.current.delete(removed.uid);
        }
        return next;
      });

      const timer = setTimeout(() => dismiss(uid), TOAST_DURATION_MS);
      timers.current.set(uid, timer);
    };

    window.addEventListener(DOWNLOAD_SUCCESS_EVENT, handler);
    return () => window.removeEventListener(DOWNLOAD_SUCCESS_EVENT, handler);
  }, [dismiss]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed z-[10000] flex flex-col gap-2 pointer-events-none"
      style={{
        bottom: "5.5rem", // above bottom nav on mobile
        right: "1rem",
        left: "1rem",
        maxWidth: "360px",
        marginLeft: "auto",
      }}
      aria-live="polite"
      aria-label="Notifications de téléchargement"
    >
      {toasts.map((toast) => (
        <ToastCard
          key={toast.uid}
          toast={toast}
          onDismiss={() => dismiss(toast.uid)}
          onNavigate={() => {
            dismiss(toast.uid);
            router.push("/downloads");
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: () => void;
  onNavigate: () => void;
}

function ToastCard({ toast, onDismiss, onNavigate }: ToastCardProps) {
  const subtitle =
    toast.episodeNumber != null
      ? `S${String(toast.season ?? 1).padStart(2, "0")}E${String(toast.episodeNumber).padStart(2, "0")}`
      : null;

  return (
    <div
      className="pointer-events-auto w-full animate-slide-up"
      style={{ borderRadius: "2px" }}
    >
      {/* Card */}
      <div
        style={{
          borderRadius: "2px",
          background: "linear-gradient(135deg, #111111 0%, #1a1a1a 100%)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(215,4,102,0.08)",
          overflow: "hidden",
        }}
      >
        {/* Body */}
        <div className="flex items-center gap-3 px-3 py-3">
          {/* Icon */}
          <div
            style={{
              borderRadius: "2px",
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              width: 36,
              height: 36,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckCircle className="h-5 w-5 text-emerald-400" weight="fill" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p
              className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-0.5"
              style={{ letterSpacing: "0.12em" }}
            >
              Téléchargement réussi
            </p>
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {toast.title}
              {subtitle && (
                <span className="text-zinc-500 font-normal ml-1.5">{subtitle}</span>
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onNavigate}
              className="flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-[#D70466] hover:text-white hover:bg-[#D70466] transition-all"
              style={{ borderRadius: "2px" }}
              aria-label="Voir les téléchargements"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDismiss}
              className="flex items-center justify-center w-6 h-6 text-zinc-600 hover:text-white hover:bg-white/10 transition-all"
              style={{ borderRadius: "2px" }}
              aria-label="Fermer"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Progress bar — auto-dismiss indicator */}
        <div style={{ height: "2px", background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full bg-emerald-500"
            style={{
              animation: `shrink ${TOAST_DURATION_MS}ms linear forwards`,
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
