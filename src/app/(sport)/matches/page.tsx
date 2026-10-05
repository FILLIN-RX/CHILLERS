import { Metadata } from "next";
import { Suspense } from "react";
import MatchesContent from "./matches-content";

export const metadata: Metadata = {
  title: "Scores & Matchs de Sport en Direct | CHILLERS",
  description:
    "Suivez les scores en direct, calendriers et résultats des matchs de football et sport sur CHILLERS.",
  openGraph: {
    title: "Scores & Matchs de Sport en Direct | CHILLERS",
    description:
      "Scores en temps réel, calendriers et résultats des grands matchs de football et sport sur CHILLERS.",
    type: "website",
  },
};

export default function MatchesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen max-w-7xl items-center justify-center bg-black">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2C2C2E] border-t-white motion-reduce:animate-none" />
        </div>
      }
    >
      <MatchesContent />
    </Suspense>
  );
}
