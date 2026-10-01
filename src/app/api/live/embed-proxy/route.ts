import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function getOptimalReferer(hostname: string): string {
  const h = hostname.toLowerCase();
  if (h.includes("kora") || h.includes("goalakor") || h.includes("hesgoal") || h.includes("dynproclaim")) {
    return "https://goalakor.space/";
  }
  if (h.includes("yasirtv") || h.includes("kooorah") || h.includes("albaplayer") || h.includes("livekora") || h.includes("koora-tv")) {
    return "https://www.livekora.vip/";
  }
  if (h.includes("yalla") || h.includes("yallapro")) {
    return "https://to.yallapro.cfd/";
  }
  if (h.includes("streamiz") || h.includes("livetv")) {
    return "https://streamiz.lol/";
  }
  return `https://${hostname}/`;
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");

  if (!rawUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  const refererParam =
    request.nextUrl.searchParams.get("referer") || getOptimalReferer(targetUrl.hostname);

  try {
    const res = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,ar;q=0.6",
        Referer: refererParam,
        Origin: new URL(refererParam).origin,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return new NextResponse(`Upstream error: ${res.status}`, { status: res.status });
    }

    let html = await res.text();
    const baseHref = `${targetUrl.protocol}//${targetUrl.host}${targetUrl.pathname.substring(
      0,
      targetUrl.pathname.lastIndexOf("/") + 1
    )}`;

    // Strip meta headers that enforce framing restrictions
    html = html.replace(/<meta[^>]*http-equiv=["']?(x-frame-options|content-security-policy)["']?[^>]*>/gi, "");

    // Inject base tag & document.referrer spoofing script to bypass domain protections
    const spoofScript = `<script>try{Object.defineProperty(document,'referrer',{get:function(){return '${refererParam}';},configurable:true});}catch(e){}</script>`;
    const baseTag = `<base href="${baseHref}">${spoofScript}`;
    if (html.includes("<head>")) {
      html = html.replace("<head>", `<head>${baseTag}`);
    } else if (html.includes("<head ")) {
      html = html.replace(/<head[^>]*>/, `$&${baseTag}`);
    } else {
      html = `${baseTag}${html}`;
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; style-src * 'unsafe-inline' data:; font-src * data:; media-src * data: blob:; connect-src * data: blob:; img-src * data: blob:; frame-src *;",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err: any) {
    return new NextResponse(`Embed proxy error: ${err?.message || "Internal error"}`, {
      status: 502,
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
