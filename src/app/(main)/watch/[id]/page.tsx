import { Metadata } from "next";
import { Suspense } from "react";
import { API_BASE } from "@/lib/server-api";
import { buildMediaMetadata } from "@/lib/seo";
import WatchContent from "./watch-content";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const sp = await searchParams;
  const isTV = sp?.type === "tv" || sp?.type === "series" || sp?.type === "anime";

  try {
    const endpoint = isTV ? "tv" : "movies";
    const res = await fetch(`${API_BASE}/${endpoint}/${id}?language=fr`, {
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json();

    if (json.success && json.data) {
      const d = json.data;
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

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
          <div className="h-12 w-12 border-4 border-zinc-700 border-t-brand-primary rounded-full animate-spin" />
        </div>
      }
    >
      <WatchContent />
    </Suspense>
  );
}
