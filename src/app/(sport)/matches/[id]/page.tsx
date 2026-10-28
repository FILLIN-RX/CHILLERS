import type { Metadata } from "next";
import { Suspense } from "react";
import { API_BASE_URL } from "@/lib/api-base";
import { SITE_URL, SITE_NAME, SITE_LOCALE } from "@/lib/seo";
import type { SportMatch } from "@/types/matches";
import MatchDetailContent from "../match-detail-content";

async function fetchMatch(id: string): Promise<SportMatch | null> {
  try {
    // Pas de cache : l'aperçu partagé doit refléter le statut courant (en direct,
    // terminé) au moment où le lien est déplié, pas la fiche mise en cache.
    const res = await fetch(`${API_BASE_URL}/matches/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: SportMatch };
    return body?.data ?? null;
  } catch {
    // Pas de fiche : metadata générique, la page reste servie.
    return null;
  }
}

/** « 2 - 1 » dans l'ordre domicile / extérieur, ou null si le score manque. */
function scoreLabel(match: SportMatch): string | null {
  const home = match.homeTeam?.score;
  const away = match.awayTeam?.score;
  if (home === undefined || away === undefined || home === null || away === null) return null;
  return `${home} - ${away}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const canonical = `${SITE_URL}/matches/${encodeURIComponent(id)}`;

  const match = await fetchMatch(id);
  const teamsLabel = match
    ? `${match.homeTeam?.name || "Équipe 1"} vs ${match.awayTeam?.name || "Équipe 2"}`
    : "Match de football";
  const leagueTxt = match?.league?.name || "Football";
  const score = match ? scoreLabel(match) : null;
  const finished = match?.status === "finished";
  const isLive = match?.status === "live";

  const title = finished
    ? `${teamsLabel}${score ? ` ${score}` : ""} — Terminé · CHILLERS`
    : isLive
      ? `🔴 EN DIRECT : ${teamsLabel}${score ? ` (${score})` : ""} · CHILLERS`
      : `⚽ ${teamsLabel} — ${leagueTxt} · CHILLERS`;

  const description = finished
    ? `Match terminé${score ? ` : ${teamsLabel} ${score}` : ` : ${teamsLabel}`}. Score final, statistiques et compositions sur CHILLERS.`
    : isLive
      ? `Score en direct${score ? ` : ${teamsLabel} ${score}` : ` : ${teamsLabel}`}. Statistiques, compositions et flux du match sur CHILLERS.`
      : `Suivez ${teamsLabel} (${leagueTxt}) : coup d'envoi, score en direct, statistiques et compositions sur CHILLERS.`;

  const ogParams = new URLSearchParams({
    home: match?.homeTeam?.name || "Match de football",
    away: match?.awayTeam?.name || "",
    status: match?.status || "upcoming",
    league: leagueTxt,
    ...(match?.homeTeam?.logo ? { homeLogo: match.homeTeam.logo } : {}),
    ...(match?.awayTeam?.logo ? { awayLogo: match.awayTeam.logo } : {}),
    ...(match?.startTime
      ? { startTs: String(Math.floor(new Date(match.startTime).getTime() / 1000)) }
      : {}),
    // Le score d'un match à venir est un 0–0 de remplissage : il n'apparaît
    // dans l'aperçu qu'une fois la rencontre commencée.
    ...((isLive || finished) && score ? { score } : {}),
  });
  const ogImage = `${SITE_URL}/api/og/liveball?${ogParams.toString()}`;

  return {
    // Le layout de la section ajoute déjà « · CHILLERS SPORT » : titre absolu.
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
      images: [
        {
          url: ogImage,
          secureUrl: ogImage,
          width: 1200,
          height: 630,
          alt: `${teamsLabel}${finished ? " — Terminé" : isLive ? " en direct" : " à venir"} sur CHILLERS`,
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
