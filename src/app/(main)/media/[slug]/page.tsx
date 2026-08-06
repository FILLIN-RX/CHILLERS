import { Metadata } from "next";
import { Suspense } from "react";
import MediaPageClient from "./client-page";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const LISTING_TYPES = new Set(["movies", "series", "anime"]);

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const listingMeta: Record<string, { title: string; description: string }> = {
  movies: {
    title: "Films",
    description: "Découvrez notre sélection de films en streaming VF/VOSTFR.",
  },
  series: {
    title: "Séries",
    description: "Retrouvez vos séries préférées en streaming VF/VOSTFR.",
  },
  anime: {
    title: "Anime",
    description: "Regardez les meilleurs animes en streaming VF/VOSTFR.",
  },
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;

  if (LISTING_TYPES.has(slug)) {
    const meta = listingMeta[slug] || { title: slug, description: "" };
    return {
      title: meta.title,
      description: meta.description,
      openGraph: {
        title: `${meta.title} · CHILLERS`,
        description: meta.description,
      },
    };
  }

  const sp = await searchParams;
  const isTV = sp?.type === "tv" || sp?.type === "series";

  try {
    const endpoint = isTV ? "tv" : "movies";
    const res = await fetch(`${API_BASE}/${endpoint}/${slug}?language=fr`, {
      signal: AbortSignal.timeout(5000),
    });
    const json = await res.json();

    if (json.success && json.data) {
      const d = json.data;
      const title = d.title || d.name || slug;
      const overview = (d.overview || "").trim();
      const kind = isTV ? "cette série" : "ce film";
      const description = overview
        ? `Découvrez ${kind} sur CHILLERS — ${overview.slice(0, 155)}`
        : `Découvrez ${kind} sur CHILLERS.`;
      const posterPath = d.poster_path
        ? `https://image.tmdb.org/t/p/w500${d.poster_path}`
        : undefined;
      const backdropPath = d.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${d.backdrop_path}`
        : undefined;
      const ogType = isTV ? "video.tv_show" : "video.movie";
      const images = [
        ...(posterPath ? [{ url: posterPath, width: 500, height: 750, alt: title }] : []),
        ...(backdropPath ? [{ url: backdropPath, width: 1280, height: 720, alt: title }] : []),
      ];

      return {
        title,
        description,
        openGraph: {
          title: `${title} · CHILLERS`,
          description,
          images,
          type: ogType as any,
        },
        twitter: {
          card: "summary_large_image",
          title: `${title} · CHILLERS`,
          description,
          images: backdropPath || posterPath ? [backdropPath || posterPath!] : [],
        },
      };
    }
  } catch {}

  return {};
}

export default async function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-dark" />}>
      <MediaPageClient />
    </Suspense>
  );
}
