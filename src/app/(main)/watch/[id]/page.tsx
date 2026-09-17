import { Metadata } from "next";
import { Suspense } from "react";
import { API_BASE, getServerApiHeaders } from "@/lib/server-api";
import { buildMediaMetadata, buildMediaJsonLd } from "@/lib/seo";
import { getMediaDetails, getSeasonDetails, getStreamUrl } from "@/services/media";
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
    const d = await getMediaDetails(id, isTV);
    if (d) {
      return buildMediaMetadata({
        id,
        title: d.title,
        type: isTV ? "tv" : "movie",
        overview: d.synopsis || d.description,
        posterPath: d.posterUrl,
        backdropPath: d.backdropUrl,
        year: d.year,
        rating: d.rating,
        genres: d.genres,
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
  const seasonParam = parseInt((sp?.season as string) || "1", 10);
  const episodeParam = parseInt((sp?.episode as string) || "1", 10);
  
  let jsonLd = null;
  let item = null;
  let seasonData = null;
  let streamData = null;
  let streamUnavailable = false;

  try {
    item = await getMediaDetails(id, isTV).catch(() => null);
    
    if (item) {
      jsonLd = buildMediaJsonLd({
        id,
        title: item.title,
        type: isTV ? "tv" : "movie",
        overview: item.synopsis || item.description,
        posterPath: item.posterUrl,
        backdropPath: item.backdropUrl,
        year: item.year,
        rating: item.rating,
        genres: item.genres,
        path: `/watch/${id}?type=${isTV ? "tv" : "movie"}`,
        context: "watch",
      });

      if (isTV) {
        const [seasonRes, streamRes] = await Promise.all([
          getSeasonDetails(id, String(seasonParam)).catch(() => null),
          getStreamUrl(id, "series", seasonParam, episodeParam, item.title).catch(() => null)
        ]);
        seasonData = seasonRes;
        
        // Retry with S1E1 if current season/ep is unavailable and not already requesting S1
        if (!streamRes && seasonParam !== 1) {
          const fallbackStream = await getStreamUrl(id, "series", 1, 1, item.title).catch(() => null);
          if (fallbackStream) {
            streamData = fallbackStream.embedUrl;
          } else {
            streamUnavailable = true;
          }
        } else if (streamRes) {
          streamData = streamRes.embedUrl;
        } else {
          streamUnavailable = true;
        }
      } else {
        const streamRes = await getStreamUrl(id, "movie", undefined, undefined, item.title).catch(() => null);
        if (streamRes) {
          streamData = streamRes.embedUrl;
        } else {
          streamUnavailable = true;
        }
      }
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
      <WatchContent 
        initialItem={item} 
        initialSeasonData={seasonData} 
        initialStreamUrl={streamData} 
        initialStreamUnavailable={streamUnavailable} 
      />
    </Suspense>
  );
}
