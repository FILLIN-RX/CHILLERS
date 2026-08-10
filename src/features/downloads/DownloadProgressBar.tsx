"use client";

import { formatBytes } from "@/lib/format";

interface DownloadProgressBarProps {
  bytesDownloaded: number;
  totalBytes: number | null;
  status: string;
  className?: string;
}

/**
 * Reusable progress bar with status-aware styling.
 * No state of its own — pure presentation.
 */
export default function DownloadProgressBar({
  bytesDownloaded,
  totalBytes,
  status,
  className = "",
}: DownloadProgressBarProps) {
  const percent =
    totalBytes && totalBytes > 0
      ? Math.min(100, Math.round((bytesDownloaded / totalBytes) * 100))
      : null;

  const colours: Record<string, string> = {
    queued: "bg-zinc-600",
    resolving: "bg-amber-500",
    ready: "bg-amber-500",
    downloading: "bg-brand-primary",
    paused: "bg-zinc-500",
    done: "bg-emerald-500",
    error: "bg-rose-500",
    canceled: "bg-zinc-500",
  };

  const bar = colours[status] ?? "bg-zinc-600";

  return (
    <div className={`w-full ${className}`}>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        {percent != null ? (
          <div
            className={`h-full transition-[width] duration-300 ${bar}`}
            style={{ width: `${percent}%` }}
          />
        ) : (
          <div className={`h-full w-full animate-pulse ${bar} opacity-60`} />
        )}
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-zinc-400">
        <span>{formatBytes(bytesDownloaded)}</span>
        <span>
          {percent != null
            ? `${percent}%`
            : status === "downloading"
            ? "Calcul…"
            : status}
        </span>
        <span>{totalBytes ? formatBytes(totalBytes) : "—"}</span>
      </div>
    </div>
  );
}