import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chillers.vercel.app";

export const SITE_URL = siteUrl.replace(/\/$/, "");
export const SITE_NAME = "CHILLERS";
export const SITE_LOCALE = "fr_FR";

export const TMDB_IMAGE = "https://image.tmdb.org/t/p";

export const DEFAULT_OG_IMAGE = {
  url: `${SITE_URL}/og-image.png`,
  width: 1200,
  height: 630,
  alt: "CHILLERS — Films et séries en streaming gratuit",
};

function truncate(text: string, max: number): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}

const DESCRIPTION_MAX = 120; // méta description et cartes sociales (~125 affichés)
const TITLE_MAX = 49; // + " · CHILLERS" (11) => 60 caractères max

function buildPageTitle(title: string, year?: number | string): string {
  const t = title.trim().replace(/\s+/g, " ");
  const yearLabel = year ? ` (${year})` : "";
  // Évite le doublon quand le titre TMDB contient déjà l'année ("Supergirl (2026)")
  const tWithYear = yearLabel && !t.endsWith(yearLabel) ? `${t}${yearLabel}` : t;
  const full = `${tWithYear} en streaming VF/VOSTFR`;
  if (full.length <= TITLE_MAX) return full;
  const cut = full.slice(0, TITLE_MAX);
  const i = cut.lastIndexOf(" ");
  return (i > 20 ? cut.slice(0, i) : cut).trimEnd() + "…";
}

interface MediaMetaInput {
  id: string;
  title: string;
  type: "movie" | "tv";
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  year?: number | string;
  rating?: number;
  genres?: string[];
  path: string; // canonical path, e.g. /media/123?type=tv
  seasonLabel?: string;
  context?: "detail" | "watch" | "season";
}

/**
 * Construit une metadata complète et "sur mesure" pour une fiche film/série :
 * titre, description enrichie (année, note, genres, synopsis), poster + backdrop
 * pour l'OG (backdrop en premier, c'est le format 16:9 que les réseaux sociaux
 * préfèrent), URL canonique, locale et card Twitter optimisée.
 */
export function buildMediaMetadata(input: MediaMetaInput): Metadata {
  const {
    title,
    type,
    overview,
    posterPath,
    backdropPath,
    year,
    rating,
    genres,
    path,
    seasonLabel,
    context = "detail",
  } = input;

  const isTV = type === "tv";
  const yearLabel = year ? ` (${year})` : "";
  const genresLabel = genres && genres.length > 0 ? ` ${genres.slice(0, 3).join(", ")}` : "";
  const ratingLabel = rating ? ` Note : ${rating}/10.` : "";

  const verb = context === "watch" ? "Regardez" : context === "season" ? "Retrouvez" : "Découvrez";
  const kind =
    context === "season"
      ? `${seasonLabel || "cette saison"} de la série`
      : isTV
        ? "cette série"
        : "ce film";

  const base = `${verb} ${kind} ${title}${yearLabel} en streaming VF/VOSTFR sur CHILLERS.`;
  const withMeta = `${base}${genresLabel}.${ratingLabel}`;
  const description = overview
    ? truncate(`${withMeta} ${overview}`, DESCRIPTION_MAX)
    : withMeta;

  const pageTitle = buildPageTitle(title, year);
  const ogTitle = `${pageTitle} · CHILLERS`;
  const canonical = `${SITE_URL}${path}`;

  const poster = posterPath ? `${TMDB_IMAGE}/w500${posterPath}` : undefined;
  const backdrop = backdropPath ? `${TMDB_IMAGE}/w1280${backdropPath}` : undefined;
  const images = [
    ...(backdrop
      ? [{ url: backdrop, width: 1280, height: 720, alt: `${title}${yearLabel} — photo de couverture` }]
      : []),
    ...(poster
      ? [{ url: poster, width: 500, height: 750, alt: `${title}${yearLabel} — affiche` }]
      : []),
  ];
  const ogImages = images.length > 0 ? images : [DEFAULT_OG_IMAGE];

  return {
    title: pageTitle,
    description,
    alternates: { canonical },
    keywords: [title, ...(genres ?? []), isTV ? "série" : "film", "streaming", "VF", "VOSTFR"].filter(Boolean),
    openGraph: {
      type: isTV ? "video.tv_show" : "video.movie",
      siteName: SITE_NAME,
      title: ogTitle,
      description,
      url: canonical,
      locale: SITE_LOCALE,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      site: "@chillers",
      images: ogImages,
    },
  };
}
