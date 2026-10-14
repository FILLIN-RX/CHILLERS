import { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { buildMediaMetadata, buildMediaJsonLd, SITE_LOCALE, SITE_URL, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { getMediaDetails, getSimilarTitles } from "@/services/media";
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
        url: `${SITE_URL}/media/${slug}`,
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

  // ?type=tv est une ancienne forme d'URL : la fiche série vit sous /tv/{id}.
  // Le canonical pointe déjà vers la vraie URL, la page redirige en dessous.
  if (isTV) {
    return { alternates: { canonical: `/tv/${slug}` } };
  }

  try {
    const d = await getMediaDetails(slug, false);
    if (d) {
      return buildMediaMetadata({
        id: slug,
        title: d.title,
        type: "movie",
        overview: d.synopsis || d.description,
        posterPath: d.posterUrl,
        backdropPath: d.backdropUrl,
        year: d.year,
        rating: d.rating,
        genres: d.genres,
        path: `/media/${slug}`,
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
  // Redirection serveur plutôt que celle du client : Google ne voit plus une coquille vide
  // qui se réoriente après coup, et on évite une requête de détails doublonnée.
  if (isTV) redirect(`/tv/${slug}`);

  const item = await getMediaDetails(slug, false).catch(() => null);
  const similar = await getSimilarTitles(slug, false, item);

  let jsonLd = null;
  if (item) {
    jsonLd = buildMediaJsonLd({
      id: slug,
      title: item.title,
      type: "movie",
      overview: item.synopsis || item.description,
      posterPath: item.posterUrl,
      backdropPath: item.backdropUrl,
      year: item.year,
      rating: item.rating,
      genres: item.genres,
      path: `/media/${slug}`,
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
