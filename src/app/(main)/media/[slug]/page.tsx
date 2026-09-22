import { Metadata } from "next";
import { Suspense } from "react";
import { buildMediaMetadata, buildMediaJsonLd, SITE_LOCALE, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { getMediaDetails, getPopularTV, getPopularMovies } from "@/services/media";
import MediaPageClient from "./client-page";

import MediaListingSkeleton from "@/components/MediaListingSkeleton";

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
  const isTV = sp?.type === "tv" || sp?.type === "series";

  try {
    const d = await getMediaDetails(slug, isTV);
    if (d) {
      return buildMediaMetadata({
        id: slug,
        title: d.title,
        type: isTV ? "tv" : "movie",
        overview: d.synopsis || d.description,
        posterPath: d.posterUrl,
        backdropPath: d.backdropUrl,
        year: d.year,
        rating: d.rating,
        genres: d.genres,
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
      <Suspense fallback={<MediaListingSkeleton />}>
        <MediaPageClient />
      </Suspense>
    );
  }

  const sp = await searchParams;
  const isTV = sp?.type === "tv" || sp?.type === "series";
  
  const [item, similarList] = await Promise.all([
    getMediaDetails(slug, isTV).catch(() => null),
    (isTV ? getPopularTV(1) : getPopularMovies(1)).catch(() => [])
  ]);

  let similar: any[] = [];
  if (item && item.similar && item.similar.length > 0) {
    similar = item.similar;
  } else if (similarList && similarList.length > 0) {
    similar = similarList.filter((m: any) => String(m.id) !== slug).slice(0, 14);
  }

  let jsonLd = null;
  if (item) {
    jsonLd = buildMediaJsonLd({
      id: slug,
      title: item.title,
      type: isTV ? "tv" : "movie",
      overview: item.synopsis || item.description,
      posterPath: item.posterUrl,
      backdropPath: item.backdropUrl,
      year: item.year,
      rating: item.rating,
      genres: item.genres,
      path: `/media/${slug}?type=${isTV ? "tv" : "movie"}`,
    });
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-dark" />}>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <MediaPageClient initialItem={item} initialSimilar={similar} />
    </Suspense>
  );
}
