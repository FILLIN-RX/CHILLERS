import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/api-base";

const BACKEND_URL = API_BASE_URL;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const authHeader = req.headers.get("authorization");

    const response = await fetch(`${BACKEND_URL}/requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Erreur serveur proxy" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const { searchParams } = new URL(req.url);

    const response = await fetch(`${BACKEND_URL}/requests/me?${searchParams.toString()}`, {
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Erreur serveur proxy" },
      { status: 500 }
    );
  }
}
