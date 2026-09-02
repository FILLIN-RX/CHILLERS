import { Metadata } from "next";
import { Suspense } from "react";
import { API_BASE, getServerApiHeaders } from "@/lib/server-api";
import { buildMediaMetadata, buildMediaJsonLd } from "@/lib/seo";
import WatchContent from "./watch-content";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function fetchMediaData(id: string, isTV: boolean) {
  let d = null;
  const tmdbToken = process.env.TMDB_TOKEN || process.env.NEXT_PUBLIC_TMDB_TOKEN;
  if (tmdbToken) {
    try {
      const tmdbRes = await fetch(`https://api.themoviedb.org/3/${isTV ? "tv" : "movie"}/${id}?language=fr-FR`, {
        headers: { Authorization: `Bearer ${tmdbToken}` },
        signal: AbortSignal.timeout(5000),
      });
      const json = await tmdbRes.json();
      if (json && !json.status_code) {
        d = json;
      }
    } catch (err) {
      console.warn("TMDB fetch failed for watch metadata, falling back to backend...", err);
    }
  }

  if (!d) {
    const endpoint = isTV ? "tv" : "movies";
    const res = await fetch(`${API_BASE}/${endpoint}/${id}?language=fr`, {
      headers: getServerApiHeaders(),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json().catch(() => null);
    if (json && json.success && json.data) {
      d = json.data;
    }
  }
  return d;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const sp = await searchParams;
  const isTV = sp?.type === "tv" || sp?.type === "series" || sp?.type === "anime";

  try {
    const d = await fetchMediaData(id, isTV);
    if (d) {
      const title = d.title || d.name || id;
      const year = d.release_date
        ? new Date(d.release_date).getFullYear()
        : d.first_air_date
          ? new Date(d.first_air_date).getFullYear()
          : undefined;
      const rating = typeof d.vote_average === "number" ? Math.round(d.vote_average * 10) / 10 : undefined;
      const genres = Array.isArray(d.genres) ? d.genres.map((g: any) => g.name) : [];

      return buildMediaMetadata({
        id,
        title,
        type: isTV ? "tv" : "movie",
        overview: d.overview,
        posterPath: d.poster_path,
        backdropPath: d.backdrop_path,
        year,
        rating,
        genres,
        path: `/watch/${id}?type=${isTV ? "tv" : "movie"}`,
        context: "watch",
      });
    }
  } catch {}

  return {};
}

export default async function WatchPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const isTV = sp?.type === "tv" || sp?.type === "series" || sp?.type === "anime";
  let jsonLd = null;

  try {
    const d = await fetchMediaData(id, isTV);
    if (d) {
      const title = d.title || d.name || id;
      const year = d.release_date
        ? new Date(d.release_date).getFullYear()
        : d.first_air_date
          ? new Date(d.first_air_date).getFullYear()
          : undefined;
      const rating = typeof d.vote_average === "number" ? Math.round(d.vote_average * 10) / 10 : undefined;
      const genres = Array.isArray(d.genres) ? d.genres.map((g: any) => g.name) : [];

      jsonLd = buildMediaJsonLd({
        id,
        title,
        type: isTV ? "tv" : "movie",
        overview: d.overview,
        posterPath: d.poster_path,
        backdropPath: d.backdrop_path,
        year,
        rating,
        genres,
        path: `/watch/${id}?type=${isTV ? "tv" : "movie"}`,
        context: "watch",
      });
    }
  } catch {}

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
          <div className="h-12 w-12 border-4 border-zinc-700 border-t-brand-primary rounded-full animate-spin" />
        </div>
      }
    >
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <WatchContent />
    </Suspense>
  );
}

