import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url");

  if (!urlParam) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(urlParam);
  } catch {
    return new NextResponse("Invalid URL parameter", { status: 400 });
  }

  const refererParam = request.nextUrl.searchParams.get("referer");

  try {
    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      Accept: "*/*",
    };

    if (refererParam) {
      headers["Referer"] = refererParam;
    } else {
      headers["Referer"] = `${targetUrl.protocol}//${targetUrl.host}/`;
    }

    const response = await fetch(targetUrl.toString(), {
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return new NextResponse(`Upstream error: ${response.status}`, {
        status: response.status,
      });
    }

    const contentType = response.headers.get("content-type") || "";
    const isM3u8 =
      contentType.includes("mpegurl") ||
      contentType.includes("application/x-mpegURL") ||
      targetUrl.pathname.endsWith(".m3u8");

    // Si c'est une playlist M3U8, on réécrit les chemins relatifs pour qu'ils passent aussi par le proxy
    if (isM3u8) {
      const text = await response.text();
      const baseUrl = targetUrl.href.substring(0, targetUrl.href.lastIndexOf("/") + 1);

      const lines = text.split("\n");
      const rewrittenLines = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          // Gestion des URI dans les tags comme #EXT-X-KEY ou #EXT-X-MEDIA
          if (trimmed.startsWith("#EXT-X-KEY") || trimmed.startsWith("#EXT-X-MEDIA")) {
            return trimmed.replace(/URI="([^"]+)"/g, (_, uri) => {
              const absoluteUri = uri.startsWith("http") ? uri : new URL(uri, baseUrl).href;
              const proxied = `/api/live/proxy?url=${encodeURIComponent(absoluteUri)}${
                refererParam ? `&referer=${encodeURIComponent(refererParam)}` : ""
              }`;
              return `URI="${proxied}"`;
            });
          }
          return line;
        }

        // Ligne d'URL (segment .ts ou sous-playlist .m3u8)
        const absoluteUrl = trimmed.startsWith("http") ? trimmed : new URL(trimmed, baseUrl).href;
        return `/api/live/proxy?url=${encodeURIComponent(absoluteUrl)}${
          refererParam ? `&referer=${encodeURIComponent(refererParam)}` : ""
        }`;
      });

      return new NextResponse(rewrittenLines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    // Sinon (segment binaire .ts, audio, etc.), on renvoie le stream avec headers CORS
    const body = response.body;
    return new NextResponse(body as any, {
      status: 200,
      headers: {
        "Content-Type": contentType || "video/MP2T",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: any) {
    return new NextResponse(`Proxy error: ${err?.message || "Internal error"}`, {
      status: 502,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
