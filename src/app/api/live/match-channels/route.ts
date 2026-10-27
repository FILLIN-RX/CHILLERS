import { NextRequest, NextResponse } from "next/server";
import { getOhaChannels } from "@/lib/oha-catalog";
import { getEpgGuide } from "@/services/epg";
import { rankChannelsForMatch } from "@/lib/match-channels";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** ISO 8601, epoch secondes ou millisecondes → millisecondes. */
function parseStart(value: string | null): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/u.test(value)) {
    const n = Number(value);
    return n < 1e12 ? n * 1000 : n;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Chaînes CHILLERS susceptibles de diffuser un match, triées : celles dont
 * l'EPG annonce la rencontre au coup d'envoi passent en premier.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const league = sp.get("league") ?? "";
  const home = sp.get("home") ?? "";
  const away = sp.get("away") ?? "";
  const sport = sp.get("sport") ?? "football";
  const startMs = parseStart(sp.get("start")) ?? Date.now();

  try {
    const guidePromise = getEpgGuide({
      from: new Date(startMs - 60 * 60_000).toISOString(),
      to: new Date(startMs + 3 * 60 * 60_000).toISOString(),
    }).catch(() => null);
    const [channels, guide] = await Promise.all([getOhaChannels(), guidePromise]);
    const programsByChannel = new Map(
      (guide?.channels ?? []).map((channel) => [channel.id, channel.programs]),
    );
    const ranked = rankChannelsForMatch(
      channels,
      { sport, league, home, away, title: `${home} ${away}`.trim() },
      startMs,
      guide
        ? (channel) => programsByChannel.get(channel.id) ?? []
        : undefined,
    );

    return NextResponse.json(
      { success: true, data: ranked },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, message: `match channels error: ${message}` },
      { status: 502 },
    );
  }
}
