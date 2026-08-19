import type { Metadata } from "next";

// Fallback robuste : utilise NEXT_PUBLIC_SITE_URL si défini, sinon l'URL Vercel du projet.
// IMPORTANT: si ton domaine change, mets à jour NEXT_PUBLIC_SITE_URL dans Vercel > Settings > Env Vars.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://chillers-pi.vercel.app");

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

function smartTruncate(text: string, max: number): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const cleanCut = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return cleanCut.replace(/[,;:.!?—\-]+$/, "").trimEnd() + "…";
}

const DESCRIPTION_MAX = 175; // méta description SEO recommandée par Google (150-180 caractères)
const TITLE_MAX = 52; // + " · CHILLERS" => 63 caractères max

function buildPageTitle(title: string, year?: number | string): string {
  const t = title.trim().replace(/\s+/g, " ");
  const yearLabel = year ? ` (${year})` : "";
  const tWithYear = yearLabel && !t.endsWith(yearLabel) ? `${t}${yearLabel}` : t;
  const full = `${tWithYear} en streaming VF/VOSTFR`;
  if (full.length <= TITLE_MAX) return full;
  const cut = full.slice(0, TITLE_MAX);
  const i = cut.lastIndexOf(" ");
  return (i > 20 ? cut.slice(0, i) : cut).trimEnd() + "…";
}

export interface MediaMetaInput {
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
 * - Texte d'accroche : "Ce film est disponible sur CHILLERS. [Description TMDB]"
 * - Images HD TMDB (1280p/780p) + fallback dynamique 16:9 (/api/og)
 * - URL canonique et Twitter card optimisée
 */
export function buildMediaMetadata(input: MediaMetaInput): Metadata {
  const {
    id,
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

  // 1. Accroche textuelle conforme ("Ce film est disponible sur CHILLERS...")
  let prefix = isTV
    ? context === "season"
      ? `Cette saison de ${title} est disponible sur CHILLERS.`
      : `Cette série est disponible sur CHILLERS.`
    : `Ce film est disponible sur CHILLERS.`;

  let description: string;
  if (overview && overview.trim().length > 0) {
    const cleanOverview = overview.trim().replace(/\s+/g, " ");
    description = smartTruncate(`${prefix} ${cleanOverview}`, DESCRIPTION_MAX);
  } else {
    description = `${prefix} Regardez ${title}${yearLabel} en streaming VF et VOSTFR gratuit.`;
  }

  const pageTitle = buildPageTitle(title, year);
  const ogTitle = `${pageTitle} · CHILLERS`;
  const canonical = `${SITE_URL}${path}`;

  // 2. Images HD et bannière 16:9 dynamique /api/og
  const poster = posterPath ? `${TMDB_IMAGE}/w780${posterPath}` : undefined;
  const backdrop = backdropPath ? `${TMDB_IMAGE}/w1280${backdropPath}` : undefined;

  const ogApiParams = new URLSearchParams({
    id: id.toString(),
    title,
    type,
    ...(posterPath ? { poster: posterPath } : {}),
    ...(backdropPath ? { backdrop: backdropPath } : {}),
    ...(year ? { year: year.toString() } : {}),
    ...(rating ? { rating: rating.toString() } : {}),
    ...(overview ? { overview: smartTruncate(overview, 120) } : {}),
  });
  const dynamicOgUrl = `${SITE_URL}/api/og?${ogApiParams.toString()}`;

  const images = [
    ...(backdrop
      ? [
          {
            url: backdrop,
            secureUrl: backdrop,
            width: 1280,
            height: 720,
            alt: `${title}${yearLabel} — photo de couverture HD`,
            type: "image/jpeg",
          },
        ]
      : []),
    {
      url: dynamicOgUrl,
      secureUrl: dynamicOgUrl,
      width: 1200,
      height: 630,
      alt: `${title}${yearLabel} sur CHILLERS`,
      type: "image/png",
    },
    ...(poster
      ? [
          {
            url: poster,
            secureUrl: poster,
            width: 780,
            height: 1170,
            alt: `${title}${yearLabel} — affiche HD`,
            type: "image/jpeg",
          },
        ]
      : []),
  ];

  const ogImages = images.length > 0 ? images : [DEFAULT_OG_IMAGE];

  return {
    title: pageTitle,
    description,
    alternates: { canonical },
    keywords: [title, ...(genres ?? []), isTV ? "série" : "film", "streaming", "VF", "VOSTFR", "CHILLERS"].filter(
      Boolean
    ),
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
      creator: "@chillers",
      images: ogImages,
    },
  };
}

/**
 * Génère l'objet de données structurées Schema.org JSON-LD pour Google Search (Rich Snippets)
 */
export function buildMediaJsonLd(input: MediaMetaInput) {
  const { id, title, type, overview, posterPath, backdropPath, year, rating, path } = input;
  const isTV = type === "tv";
  const canonical = `${SITE_URL}${path}`;
  const poster = posterPath ? `${TMDB_IMAGE}/w780${posterPath}` : `${SITE_URL}/og-image.png`;
  const backdrop = backdropPath ? `${TMDB_IMAGE}/w1280${backdropPath}` : poster;

  return {
    "@context": "https://schema.org",
    "@type": isTV ? "TVSeries" : "Movie",
    name: title,
    description: overview || `${title} est disponible sur CHILLERS en streaming gratuit.`,
    url: canonical,
    image: [backdrop, poster],
    ...(year ? { dateCreated: year.toString() } : {}),
    inLanguage: "fr",
    ...(rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating,
            bestRating: "10",
            worstRating: "1",
            ratingCount: 100,
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
    },
  };
}

