import { NextRequest, NextResponse } from "next/server";
import { SITE_URL } from "@/lib/seo";

const INDEXNOW_KEY = "8xu4nvspm5j7l8rmhvdsghzlhdii0en4";

// Moteurs partenaires IndexNow (Bing, Yandex, Seznam, DuckDuckGo via Bing)
const INDEXNOW_ENDPOINTS = [
  "https://api.indexnow.org/indexnow",
  "https://www.bing.com/indexnow",
  "https://yandex.com/indexnow",
];

export interface IndexNowPayload {
  urls: string[];
}

/**
 * POST /api/indexnow
 * Corps : { urls: string[] }  — liste d'URLs absolues à notifier.
 * Sécurisé par INDEXNOW_NOTIFY_SECRET (variable d'env, identique à CRON_SECRET si utilisé).
 */
export async function POST(req: NextRequest) {
  // Vérification du secret pour éviter les appels non autorisés
  const secret = req.headers.get("x-indexnow-secret");
  const expectedSecret = process.env.INDEXNOW_NOTIFY_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let urls: string[];
  try {
    const body: IndexNowPayload = await req.json();
    if (!Array.isArray(body.urls) || body.urls.length === 0) {
      return NextResponse.json({ error: "urls array required" }, { status: 400 });
    }
    // Sanitize : accepter uniquement les URLs de notre domaine
    urls = body.urls.filter((u) => {
      try {
        return new URL(u).origin === new URL(SITE_URL).origin;
      } catch {
        return false;
      }
    });
    if (urls.length === 0) {
      return NextResponse.json({ error: "No valid urls for this host" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = {
    host: new URL(SITE_URL).hostname,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };

  const results = await Promise.allSettled(
    INDEXNOW_ENDPOINTS.map((endpoint) =>
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      }).then((r) => ({ endpoint, status: r.status }))
    )
  );

  const summary = results.map((r) =>
    r.status === "fulfilled" ? r.value : { endpoint: "unknown", status: "error", reason: r.reason }
  );

  return NextResponse.json({ submitted: urls.length, urls, engines: summary });
}

/**
 * GET /api/indexnow?urls=url1,url2
 * Appel simplifié depuis un cron ou une action d'administration.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.INDEXNOW_NOTIFY_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawUrls = req.nextUrl.searchParams.get("urls") ?? "";
  const urls = rawUrls
    .split(",")
    .map((u) => u.trim())
    .filter((u) => {
      try {
        return new URL(u).origin === new URL(SITE_URL).origin;
      } catch {
        return false;
      }
    });

  if (urls.length === 0) {
    return NextResponse.json({ error: "No valid urls" }, { status: 400 });
  }

  const payload = {
    host: new URL(SITE_URL).hostname,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };

  const results = await Promise.allSettled(
    INDEXNOW_ENDPOINTS.map((endpoint) =>
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      }).then((r) => ({ endpoint, status: r.status }))
    )
  );

  const summary = results.map((r) =>
    r.status === "fulfilled" ? r.value : { endpoint: "unknown", status: "error" }
  );

  return NextResponse.json({ submitted: urls.length, urls, engines: summary });
}
