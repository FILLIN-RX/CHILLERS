import { NextResponse } from "next/server";
import { getOhaChannels } from "@/lib/oha-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const channels = await getOhaChannels();
    return NextResponse.json(
      { success: true, data: channels },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, message: `oha catalog error: ${message}` },
      { status: 502 },
    );
  }
}
