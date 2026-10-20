"use client";

import React, { useState } from "react";
import { Broadcast, CircleNotch, Television } from "@phosphor-icons/react";
import type { OhaChannel } from "@/types/oha";

/**
 * Sélecteur de source du direct : chaînes CHILLERS (confirmées en premier,
 * sélectionnées automatiquement par l'EPG) puis sources externes.
 */
export default function MatchChannelsRow({
  channels,
  selectedId,
  resolvingId,
  onSelect,
  onExternal,
  externalActive = false,
  label = "Source du direct",
  hint,
  confirmedIds,
  variant = "dark",
}: {
  channels: OhaChannel[];
  selectedId?: string | null;
  resolvingId?: string | null;
  onSelect: (ch: OhaChannel) => void;
  /** Affiche une puce « Autres sources » (retour au flux externe). */
  onExternal?: () => void;
  externalActive?: boolean;
  label?: string;
  hint?: string;
  /** Chaînes dont l'EPG confirme la diffusion du match. */
  confirmedIds?: string[];
  variant?: "dark" | "light";
}) {
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  if (channels.length === 0 && !onExternal) return null;

  const confirmed = new Set(confirmedIds ?? []);
  const chipBase =
    variant === "dark"
      ? "bg-black/55 border-white/12 hover:bg-white/12"
      : "bg-zinc-900/80 border-white/10 hover:bg-zinc-800";

  return (
    <div className="w-full min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
        {hint && <p className="truncate text-[10px] font-medium text-zinc-500">{hint}</p>}
      </div>

      <div className="flex items-stretch gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {channels.map((ch) => {
          const isActive = selectedId === ch.id;
          const isResolving = resolvingId === ch.id;
          const isConfirmed = confirmed.has(ch.id);
          return (
            <button
              key={ch.id}
              onClick={() => onSelect(ch)}
              disabled={Boolean(resolvingId)}
              title={`${ch.name} — regarder en direct`}
              className={`group flex shrink-0 items-center gap-2.5 rounded-xl border py-1.5 pl-1.5 pr-3.5 text-left backdrop-blur-md transition-colors disabled:opacity-60 ${
                isActive
                  ? "bg-brand-primary border-brand-primary text-white shadow-lg shadow-red-600/25"
                  : isConfirmed
                    ? "border-emerald-400/35 bg-emerald-400/5 text-zinc-100 hover:bg-emerald-400/10"
                    : `${chipBase} text-zinc-300`
              }`}
            >
              <span
                className={`flex h-8 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg ${
                  isActive ? "bg-black/25" : "bg-black/45"
                }`}
              >
                {ch.logo && !broken[ch.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ch.logo}
                    alt=""
                    onError={() => setBroken((prev) => ({ ...prev, [ch.id]: true }))}
                    className="h-5 w-9 object-contain"
                    loading="lazy"
                  />
                ) : (
                  <Television className="h-4 w-4 text-zinc-400" />
                )}
              </span>

              <span className="flex min-w-0 flex-col leading-tight">
                <span className="max-w-[9rem] truncate text-[11px] font-bold uppercase tracking-wide">
                  {ch.name}
                </span>
                <span
                  className={`mt-0.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider ${
                    isActive
                      ? "text-white/80"
                      : isConfirmed
                        ? "text-emerald-300"
                        : "text-zinc-500"
                  }`}
                >
                  {isConfirmed && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                  {isResolving ? "Connexion…" : isConfirmed ? "En direct" : "Possible"}
                </span>
              </span>

              {isResolving && (
                <CircleNotch
                  className={`h-3.5 w-3.5 shrink-0 animate-spin ${isActive ? "text-white" : "text-zinc-400"}`}
                />
              )}
            </button>
          );
        })}

        {onExternal && (
          <button
            onClick={onExternal}
            className={`flex shrink-0 items-center gap-2.5 rounded-xl border py-1.5 pl-2 pr-3.5 text-left backdrop-blur-md transition-colors ${
              externalActive
                ? "bg-brand-primary border-brand-primary text-white"
                : `${chipBase} text-zinc-300`
            }`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                externalActive ? "bg-black/25" : "bg-black/45"
              }`}
            >
              <Broadcast className="h-4 w-4" />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="max-w-[9rem] truncate text-[11px] font-bold uppercase tracking-wide">
                Autres sources
              </span>
              <span
                className={`mt-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                  externalActive ? "text-white/80" : "text-zinc-500"
                }`}
              >
                Flux web
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
