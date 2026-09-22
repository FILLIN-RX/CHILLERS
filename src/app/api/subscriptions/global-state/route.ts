import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// In-memory fallback state for Next.js server instance
let globalSubscriptionState = true;

const BACKEND_API =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://chillers.onrender.com/api"
    : "http://localhost:4000/api");

export async function GET() {
  try {
    // Attempt to sync from backend API if available
    const backendRes = await fetch(`${BACKEND_API}/admin/subscriptions/global-state`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    }).catch(() => null);

    if (backendRes && backendRes.ok) {
      const data = await backendRes.json();
      if (data?.success && typeof data.globalSubscriptionEnabled === "boolean") {
        globalSubscriptionState = data.globalSubscriptionEnabled;
      }
    }
  } catch {
    // Fallback to in-memory state
  }

  return NextResponse.json(
    {
      success: true,
      globalSubscriptionEnabled: globalSubscriptionState,
    },
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.enabled === "boolean") {
      globalSubscriptionState = body.enabled;
    }

    return NextResponse.json(
      {
        success: true,
        globalSubscriptionEnabled: globalSubscriptionState,
        message: `Global subscription state updated to ${globalSubscriptionState}`,
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update state" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
