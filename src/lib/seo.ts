import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chillers.vercel.app";

export const SITE_URL = siteUrl.replace(/\/$/, "");
export const SITE_NAME = "CHILLERS";
export const SITE_LOCALE = "fr_FR";

export const TMDB_IMAGE = "https://image.tmdb.org/t/p";

function truncate(text: string, max: number): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
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
    ? truncate(`${withMeta} ${overview}`, 200)
    : withMeta;

  const poster = posterPath ? `${TMDB_IMAGE}/w500${posterPath}` : undefined;
  const backdrop = backdropPath ? `${TMDB_IMAGE}/w1280${backdropPath}` : undefined;
  const ogTitle = `${title}${yearLabel} · CHILLERS`;
  const canonical = `${SITE_URL}${path}`;

  const images = [
    ...(backdrop
      ? [{ url: backdrop, width: 1280, height: 720, alt: `${title} — backdrop` }]
      : []),
    ...(poster
      ? [{ url: poster, width: 500, height: 750, alt: `${title} — affiche` }]
      : []),
  ];

  return {
    title,
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
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      site: "@chillers",
      images: images.length > 0 ? images : undefined,
    },
  };
}
