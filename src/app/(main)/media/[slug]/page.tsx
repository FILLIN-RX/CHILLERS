import { Metadata } from "next";
import { Suspense } from "react";
import { API_BASE } from "@/lib/server-api";
import { buildMediaMetadata, SITE_LOCALE } from "@/lib/seo";
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
      },
      twitter: {
        card: "summary_large_image",
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

export default async function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-dark" />}>
      <MediaPageClient />
    </Suspense>
  );
}
