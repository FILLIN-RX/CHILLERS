import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AUTH_TOKEN = "s8B8CYQrUKMFsHFhMU";
const KALTURA_PARTNER_ID = "513551";

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url");
  const idParam = request.nextUrl.searchParams.get("id");

  if (!urlParam && !idParam) {
    return NextResponse.json(
      { error: "Provide either ?url=... or ?id=... parameter" },
      { status: 400 }
    );
  }

  let videoId = idParam;

  try {
    if (urlParam) {
      // Direct AfrolandTV URL provided: extract data-ottera-id or node ID
      const pageRes = await fetch(urlParam, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!pageRes.ok) {
        return NextResponse.json(
          { error: `Failed to fetch page HTML: ${pageRes.status}` },
          { status: 400 }
        );
      }

      const html = await pageRes.text();
      const otteraMatch =
        html.match(/data-ottera-id=["'](\d+)["']/) ||
        html.match(/node-type-video--(\d+)/) ||
        html.match(/node\/(\d+)/);

      if (otteraMatch) {
        videoId = otteraMatch[1];
      } else {
        return NextResponse.json(
          { error: "Could not locate AfrolandTV video ID in page HTML" },
          { status: 422 }
        );
      }
    }

    if (!videoId) {
      return NextResponse.json(
        { error: "Invalid or missing video ID" },
        { status: 400 }
      );
    }

    // Query Ottera embeddedVideoPlayer endpoint to resolve Kaltura entry_id
    const embedApiUrl = `https://api-ott.afrolandtv.com/embeddedVideoPlayer?auth_token=${AUTH_TOKEN}&id=${videoId}&div_id=video_player&image_width=1280`;

    const embedRes = await fetch(embedApiUrl, {
      signal: AbortSignal.timeout(10000),
    });

    if (!embedRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch player embed: ${embedRes.status}` },
        { status: 502 }
      );
    }

    const embedJs = await embedRes.text();

    const entryMatch =
      embedJs.match(/'entry_id'\s*:\s*'([^']+)'/) ||
      embedJs.match(/"entry_id"\s*:\s*"([^"]+)"/);

    if (!entryMatch) {
      return NextResponse.json(
        { error: "Could not find Kaltura entry_id for this video" },
        { status: 422 }
      );
    }

    const entryId = entryMatch[1];

    // Build standard Kaltura HLS Master Playlist URL
    const streamUrl = `https://cdnapisec.kaltura.com/p/${KALTURA_PARTNER_ID}/sp/${KALTURA_PARTNER_ID}00/playManifest/entryId/${entryId}/format/applehttp/protocol/https/a.m3u8`;

    // Proxied URL for CORS and client-side player compatibility
    const proxiedStreamUrl = `/api/live/proxy?url=${encodeURIComponent(streamUrl)}`;

    return NextResponse.json(
      {
        success: true,
        videoId,
        entryId,
        partnerId: KALTURA_PARTNER_ID,
        streamUrl,
        proxiedStreamUrl,
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=1800",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
