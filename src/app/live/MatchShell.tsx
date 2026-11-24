"use client";

import dynamic from "next/dynamic";

function MatchLoading() {
  return (
    <div className="fixed inset-0 z-40 flex h-dvh w-screen flex-col items-center justify-center gap-3 overflow-hidden bg-black">
      <div className="h-12 w-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
        Chargement du match...
      </p>
    </div>
  );
}

const SportsMatchContent = dynamic(
  () => import("@/app/live/sp/[matchId]/page-content"),
  { ssr: false, loading: MatchLoading },
);

const LiveBallMatchContent = dynamic(
  () => import("@/app/live/lb/[matchId]/page-content"),
  { ssr: false, loading: MatchLoading },
);

export default function MatchShell({ variant }: { variant: "sp" | "lb" }) {
  return variant === "sp" ? <SportsMatchContent /> : <LiveBallMatchContent />;
}
