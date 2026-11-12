import type { Metadata } from "next";
import { Suspense } from "react";
import { API_BASE_URL } from "@/lib/api-base";
import { SITE_NAME, SITE_LOCALE, SITE_URL } from "@/lib/seo";
import type { SportMatch } from "@/types/matches";
import ChannelsPageContent from "./channels-content";

async function fetchMatch(id: string): Promise<SportMatch | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/matches/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: SportMatch };
    return body?.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const match = await fetchMatch(id);
  const teams = match
    ? `${match.homeTeam?.name || "Équipe 1"} vs ${match.awayTeam?.name || "Équipe 2"}`
    : "Match";
  const canonical = `${SITE_URL}/matches/${encodeURIComponent(id)}/channels`;
  const title = `Chaînes & flux · ${teams} · CHILLERS`;
  const description = `Toutes les chaînes et serveurs disponibles pour ${teams} en direct sur CHILLERS.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      title,
      description,
      url: canonical,
    },
    twitter: { card: "summary", title, description },
  };
}

export default function MatchChannelsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#111]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2C2C2E] border-t-white" />
        </div>
      }
    >
      <ChannelsPageContent />
    </Suspense>
  );
}
