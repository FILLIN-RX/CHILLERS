"use client";

import React from "react";

export type TabId = "summary" | "stats" | "lineups";

export const TABS: Array<{ id: TabId; label: string }> = [
  { id: "summary", label: "Summary" },
  { id: "stats", label: "Stats" },
  { id: "lineups", label: "Line-ups" },
];

export const CARD = "#161616";
export const DIVIDER = "#262626";
export const MUTED = "#8A8A8A";
export const ORANGE = "#FF6A00";

export function MatchTabs({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  return (
    <div role="tablist" aria-label="Match sections" className="flex border-b" style={{ borderColor: DIVIDER }}>
      {TABS.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`relative flex-1 py-3.5 text-[14px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
              active ? "font-semibold text-white" : "text-[#8A8A8A] hover:text-white"
            }`}
          >
            {t.label}
            {active && <span className="absolute inset-x-0 -bottom-px h-[2px] bg-white" />}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl px-4 py-6 text-center text-[14px]" style={{ background: CARD, color: MUTED }}>
      {children}
    </p>
  );
}
