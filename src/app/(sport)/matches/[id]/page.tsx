import { Metadata } from "next";
import { Suspense } from "react";
import MatchDetailContent from "../match-detail-content";

export const metadata: Metadata = {
  title: "Détail du match | CHILLERS",
  description:
    "Score en direct, événements, statistiques et compositions du match sur CHILLERS.",
  openGraph: {
    title: "Détail du match | CHILLERS",
    description: "Score en direct, événements, statistiques et compositions du match.",
    type: "website",
  },
};

export default function MatchDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2C2C2E] border-t-white motion-reduce:animate-none" />
        </div>
      }
    >
      <MatchDetailContent />
    </Suspense>
  );
}
