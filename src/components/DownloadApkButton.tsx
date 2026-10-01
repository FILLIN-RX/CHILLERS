"use client";

import React from "react";
import { DownloadSimple } from "@phosphor-icons/react";

interface DownloadApkButtonProps {
  className?: string;
  variant?: "primary" | "compact" | "card";
}

export default function DownloadApkButton({
  className = "",
  variant = "primary",
}: DownloadApkButtonProps) {
  const downloadUrl =
    "https://github.com/FILLIN-RX/CHILLERS/releases/latest/download/app-release.apk";

  if (variant === "compact") {
    return (
      <a
        href={downloadUrl}
        download="Chillers.apk"
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 hover:border-brand-primary/50 text-white text-xs font-semibold transition-all duration-200 shadow-md active:scale-95 group ${className}`}
      >
        <svg
          className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9994.4482.9994.9993 0 .5511-.4483.9997-.9994.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5896 8.3585 13.8568 8 12 8s-3.5896.3585-5.1368.9507L4.8409 5.4477a.416.416 0 00-.5676-.1521.416.416 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
        </svg>
        <span>Télécharger l{"'"}APK</span>
        <DownloadSimple className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white group-hover:translate-y-0.5 transition-transform" />
      </a>
    );
  }

  if (variant === "card") {
    return (
      <div className={`p-4 rounded-2xl bg-zinc-900/80 border border-white/10 hover:border-brand-primary/40 transition-all ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9994.4482.9994.9993 0 .5511-.4483.9997-.9994.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5896 8.3585 13.8568 8 12 8s-3.5896.3585-5.1368.9507L4.8409 5.4477a.416.416 0 00-.5676-.1521.416.416 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white tracking-tight">Application Android</div>
            <div className="text-xs text-zinc-400 truncate">Version APK directe sans Store</div>
          </div>
        </div>
        <a
          href={downloadUrl}
          download="Chillers.apk"
          className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white text-xs font-bold transition shadow-lg shadow-brand-primary/20 active:scale-95"
        >
          <DownloadSimple className="w-4 h-4" />
          <span>Télécharger gratuitement</span>
        </a>
      </div>
    );
  }

  return (
    <a
      href={downloadUrl}
      download="Chillers.apk"
      className={`inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-zinc-900/95 border border-white/10 hover:border-brand-primary/50 text-white font-medium transition-all duration-300 shadow-xl hover:shadow-brand-primary/10 active:scale-95 group ${className}`}
    >
      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
        <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9994.4482.9994.9993 0 .5511-.4483.9997-.9994.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5896 8.3585 13.8568 8 12 8s-3.5896.3585-5.1368.9507L4.8409 5.4477a.416.416 0 00-.5676-.1521.416.416 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
        </svg>
      </div>
      <div className="text-left leading-tight">
        <div className="text-[11px] font-medium text-zinc-400">Application Android</div>
        <div className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
          <span>Télécharger l{"'"}APK</span>
          <DownloadSimple className="w-3.5 h-3.5 text-zinc-400 group-hover:text-brand-primary group-hover:translate-y-0.5 transition-all" />
        </div>
      </div>
    </a>
  );
}
