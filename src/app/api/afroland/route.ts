import { NextRequest, NextResponse } from "next/server";
import { AfrolandProvider } from "@/lib/providers/afroland";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url");
  const idParam = request.nextUrl.searchParams.get("id");

  if (!urlParam && !idParam) {
    return NextResponse.json(
      { error: "Provide either ?url=... or ?id=... parameter" },
      { status: 400 }
    );
  }

  const queryTarget = urlParam || idParam || "";
  const result = await AfrolandProvider.resolveStream(queryTarget);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to resolve stream" },
      { status: 422 }
    );
  }

  // Attempt metadata enrichment if videoId present
  let metadata = null;
  if (result.videoId) {
    metadata = await AfrolandProvider.getMetadata(result.videoId);
  }

  return NextResponse.json(
    {
      ...result,
      metadata,
    },
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=1800",
      },
    }
  );
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
