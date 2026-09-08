import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const BRAND = "#D70466";

function initials(name: string): string {
  const parts = name.replace(/\s*\(.*\)$/, "").split(/[\s-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

async function loadDataUri(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return `data:${res.headers.get("content-type") || "image/png"};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

function formatStart(ts?: string): string {
  if (!ts) return "";
  try {
    const d = new Date(Number(ts) * 1000);
    const parts = d.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).split(" ");
    parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return `${parts.join(" ")} · ${time}`;
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const home = searchParams.get("home") || "Match LiveBall";
    const away = searchParams.get("away") || "";
    const homeLogo = searchParams.get("homeLogo") || "";
    const awayLogo = searchParams.get("awayLogo") || "";
    const status = searchParams.get("status") || "live";
    const league = searchParams.get("league") || "";
    const startTs = searchParams.get("startTs") || "";
    const score = searchParams.get("score") || "";

    const isLive = status === "live";
    const [hLogo, aLogo] = await Promise.all([
      loadDataUri(homeLogo),
      loadDataUri(awayLogo),
    ]);

    const nameStyle = { fontSize: 40, fontWeight: 800, color: "#ffffff", lineHeight: 1.15, textAlign: "center" as const, maxWidth: 400, whiteSpace: "pre-wrap" as const };
    const longName = { ...nameStyle, fontSize: 34 };

    const Team = ({ name, logo }: { name: string; logo: string | null }) => (
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            width: 132,
            height: 132,
            borderRadius: "50%",
            backgroundColor: "#ffffff",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            boxShadow: "0 18px 40px rgba(0,0,0,0.55), 0 0 0 3px rgba(255,255,255,0.12)",
          }}
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={name} style={{ width: 96, height: 96, objectFit: "contain" }} />
          ) : (
            <div
              style={{
                fontSize: 40,
                fontWeight: 900,
                color: "#18181b",
                display: "flex",
              }}
            >
              {initials(name)}
            </div>
          )}
        </div>
        <div style={name.length > 16 ? longName : nameStyle}>{name}</div>
      </div>
    );

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#09090b",
            color: "#ffffff",
            fontFamily: "sans-serif",
            position: "relative",
            overflow: "hidden",
            gap: 34,
          }}
        >
          {/* Halos décoratifs */}
          <div
            style={{
              position: "absolute",
              top: -220,
              right: -160,
              width: 560,
              height: 560,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(215,4,102,0.35), transparent 70%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -240,
              left: -180,
              width: 560,
              height: 560,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(215,4,102,0.22), transparent 70%)",
            }}
          />

          {/* Badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
            <div
              style={{
                backgroundColor: BRAND,
                color: "#ffffff",
                fontWeight: 900,
                fontSize: 20,
                padding: "10px 22px",
                borderRadius: 999,
                letterSpacing: 2,
              }}
            >
              CHILLERS
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                backgroundColor: isLive ? "rgba(225,29,72,0.2)" : "rgba(255,255,255,0.08)",
                border: isLive ? "2px solid #e11d48" : "2px solid rgba(255,255,255,0.18)",
                color: isLive ? "#fda4af" : "#e4e4e7",
                fontWeight: 800,
                fontSize: 18,
                padding: "10px 22px",
                borderRadius: 999,
                letterSpacing: 1,
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  backgroundColor: isLive ? "#ef4444" : "#52525b",
                }}
              />
              {isLive ? "EN DIRECT" : "À VENIR"}
            </div>
            {league && (
              <div
                style={{
                  backgroundColor: "rgba(255,255,255,0.08)",
                  border: "2px solid rgba(255,255,255,0.14)",
                  color: "#a1a1aa",
                  fontWeight: 700,
                  fontSize: 18,
                  padding: "10px 22px",
                  borderRadius: 999,
                  letterSpacing: 1,
                }}
              >
                {league}
              </div>
            )}
          </div>

          {/* Teams */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              padding: "0 56px",
              gap: 24,
              position: "relative",
            }}
          >
            <Team name={home} logo={hLogo} />
            <div
              style={{
                display: "flex",
                width: 92,
                height: 92,
                borderRadius: "50%",
                backgroundColor: "rgba(215,4,102,0.16)",
                border: "3px solid rgba(215,4,102,0.6)",
                alignItems: "center",
                justifyContent: "center",
                color: BRAND,
                fontSize: 30,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              VS
            </div>
            <Team name={away} logo={aLogo} />
          </div>

          {/* Date / score */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              position: "relative",
            }}
          >
            {isLive && score ? (
              <div style={{ fontSize: 34, fontWeight: 900, color: "#ffffff" }}>{score}</div>
            ) : (
              <div style={{ fontSize: 26, fontWeight: 700, color: "#d4d4d8" }}>
                {formatStart(startTs)}
              </div>
            )}
          </div>

          {/* Encart bas */}
          <div
            style={{
              position: "absolute",
              bottom: 34,
              left: 0,
              right: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              fontSize: 18,
              fontWeight: 600,
              color: "#71717a",
              letterSpacing: 1,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: BRAND }} />
            FOOTBALL EN DIRECT · GRATUIT SUR CHILLERS
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
        },
      }
    );
  } catch (err) {
    console.error("Erreur image OG liveball:", err);
    return new Response("Erreur lors de la génération d'image OG", { status: 500 });
  }
}