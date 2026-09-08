import type { Metadata } from "next";
import { SITE_URL, SITE_NAME, SITE_LOCALE } from "@/lib/seo";
import LiveBallMatchContent from "./page-content";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "production" ? "https://chillers.onrender.com/api" : "http://localhost:4000/api");

interface MatchInfo {
  id: string;
  status: "live" | "upcoming";
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  score?: string;
  startTs?: number;
  league?: string;
}

async function fetchMatch(matchId: string): Promise<MatchInfo | null> {
  const sources = ["/liveball/matches", "/liveball/league/champions-league/matches"];
  for (const path of sources) {
    try {
      const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 60 } });
      if (!res.ok) continue;
      const body = await res.json();
      const match = (body?.data || []).find((m: MatchInfo) => m.id === matchId);
      if (match) return match;
    } catch {
      // ignore : repli sur metadata générique
    }
  }
  return null;
}

function leagueLabel(slug?: string): string {
  const map: Record<string, string> = {
    "champions-league": "Champions League",
    "europa-league": "Europa League",
    "conference-league": "Conference League",
  };
  return map[slug || ""] || "Football";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ matchId: string }>;
}): Promise<Metadata> {
  const { matchId } = await params;
  const canonical = `${SITE_URL}/live/lb/${matchId}`;

  const match = await fetchMatch(matchId);
  const isLive = match?.status === "live";
  const statusLabel = isLive ? "EN DIRECT" : "À VENIR";

  const teamsLabel = match ? `${match.home} vs ${match.away}` : "Match de football";
  const title = match ? `${teamsLabel} – ${statusLabel} · CHILLERS` : "Match en direct · CHILLERS";
  const description = match
    ? isLive
      ? `${teamsLabel} : regardez ce match de football en direct et gratuitement sur CHILLERS.`
      : `${teamsLabel} – diffusion programmée. Regardez ce match de football gratuitement dès le coup d'envoi sur CHILLERS.`
    : "Regardez ce match de football en direct et gratuitement sur CHILLERS.";

  const ogParams = new URLSearchParams({
    home: match?.home || "Match LiveBall",
    away: match?.away || "",
    status: match?.status || "upcoming",
    league: match ? leagueLabel(match.league) : "",
    ...(match?.homeLogo ? { homeLogo: match.homeLogo } : {}),
    ...(match?.awayLogo ? { awayLogo: match.awayLogo } : {}),
    ...(match?.startTs ? { startTs: String(match.startTs) } : {}),
    ...(match?.score ? { score: match.score } : {}),
  });
  const ogImage = `${SITE_URL}/api/og/liveball?${ogParams.toString()}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "video.other",
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      title,
      description,
      url: canonical,
      images: [
        {
          url: ogImage,
          secureUrl: ogImage,
          width: 1200,
          height: 630,
          alt: `${teamsLabel}${isLive ? " en direct" : " à venir"} sur CHILLERS`,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@chillers",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function LiveBallMatchPage() {
  return <LiveBallMatchContent />;
}