import { Metadata } from "next";
import { Suspense } from "react";
import { API_BASE } from "@/lib/server-api";
import { buildMediaMetadata, buildMediaJsonLd, SITE_LOCALE, DEFAULT_OG_IMAGE } from "@/lib/seo";
import MediaPageClient from "./client-page";

const LISTING_TYPES = new Set(["movies", "series", "anime"]);

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const listingMeta: Record<string, { title: string; description: string }> = {
  movies: {
    title: "Films en streaming gratuit",
    description:
      "Regardez les meilleurs films en streaming gratuit VF/VOSTFR sur CHILLERS : blockbusters, nouveautés et grands classiques.",
  },
  series: {
    title: "Séries en streaming gratuit",
    description:
      "Retrouvez vos séries préférées en streaming gratuit VF/VOSTFR sur CHILLERS : toutes les saisons et tous les épisodes.",
  },
  anime: {
    title: "Anime en streaming gratuit",
    description:
      "Regardez les meilleurs animes en streaming gratuit VF/VOSTFR sur CHILLERS : action, aventure, fantastique et plus encore.",
  },
};

async function fetchMediaData(slug: string, isTV: boolean) {
  let d = null;
  const tmdbToken = process.env.TMDB_TOKEN || process.env.NEXT_PUBLIC_TMDB_TOKEN;
  if (tmdbToken) {
    try {
      const tmdbRes = await fetch(`https://api.themoviedb.org/3/${isTV ? "tv" : "movie"}/${slug}?language=fr-FR`, {
        headers: { Authorization: `Bearer ${tmdbToken}` },
        signal: AbortSignal.timeout(5000),
      });
      const json = await tmdbRes.json();
      if (json && !json.status_code) {
        d = json;
      }
    } catch (err) {
      console.warn("TMDB fetch failed for metadata, falling back to backend...", err);
    }
  }

  if (!d) {
    const endpoint = isTV ? "tv" : "movies";
    const res = await fetch(`${API_BASE}/${endpoint}/${slug}?language=fr`, {
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    if (json.success && json.data) {
      d = json.data;
    }
  }
  return d;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;

  if (LISTING_TYPES.has(slug)) {
    const meta = listingMeta[slug] || { title: slug, description: "" };
    return {
      title: meta.title,
      description: meta.description,
      alternates: { canonical: `/media/${slug}` },
      openGraph: {
        type: "website",
        siteName: "CHILLERS",
        title: `${meta.title} · CHILLERS`,
        description: meta.description,
        url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://chillers.vercel.app"}/media/${slug}`,
        locale: SITE_LOCALE,
        images: [DEFAULT_OG_IMAGE],
      },
      twitter: {
        card: "summary_large_image",
        title: `${meta.title} · CHILLERS`,
        description: meta.description,
        images: [DEFAULT_OG_IMAGE],
      },
    };
  }

  const sp = await searchParams;
  const isTV = sp?.type === "tv" || sp?.type === "series" || sp?.type === "anime";

  try {
    const d = await fetchMediaData(slug, isTV);
    if (d) {
      const title = d.title || d.name || slug;
      const year = d.release_date
        ? new Date(d.release_date).getFullYear()
        : d.first_air_date
          ? new Date(d.first_air_date).getFullYear()
          : undefined;
      const rating = typeof d.vote_average === "number" ? Math.round(d.vote_average * 10) / 10 : undefined;
      const genres = Array.isArray(d.genres) ? d.genres.map((g: any) => g.name) : [];

      return buildMediaMetadata({
        id: slug,
        title,
        type: isTV ? "tv" : "movie",
        overview: d.overview,
        posterPath: d.poster_path,
        backdropPath: d.backdrop_path,
        year,
        rating,
        genres,
        path: `/media/${slug}?type=${isTV ? "tv" : "movie"}`,
      });
    }
  } catch {}

  return {};
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  if (LISTING_TYPES.has(slug)) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-brand-dark" />}>
        <MediaPageClient />
      </Suspense>
    );
  }

  const sp = await searchParams;
  const isTV = sp?.type === "tv" || sp?.type === "series" || sp?.type === "anime";
  let jsonLd = null;

  try {
    const d = await fetchMediaData(slug, isTV);
    if (d) {
      const title = d.title || d.name || slug;
      const year = d.release_date
        ? new Date(d.release_date).getFullYear()
        : d.first_air_date
          ? new Date(d.first_air_date).getFullYear()
          : undefined;
      const rating = typeof d.vote_average === "number" ? Math.round(d.vote_average * 10) / 10 : undefined;
      const genres = Array.isArray(d.genres) ? d.genres.map((g: any) => g.name) : [];

      jsonLd = buildMediaJsonLd({
        id: slug,
        title,
        type: isTV ? "tv" : "movie",
        overview: d.overview,
        posterPath: d.poster_path,
        backdropPath: d.backdrop_path,
        year,
        rating,
        genres,
        path: `/media/${slug}?type=${isTV ? "tv" : "movie"}`,
      });
    }
  } catch {}

  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-dark" />}>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <MediaPageClient />
    </Suspense>
  );
}
