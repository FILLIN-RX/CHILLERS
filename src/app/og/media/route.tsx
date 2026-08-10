import { ImageResponse } from "next/og";

export const runtime = "edge";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

const HEADLINE_MAX = 44;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawTitle = (searchParams.get("title") || "").trim();
  const title = rawTitle.length > 80 ? rawTitle.slice(0, 79).trimEnd() + "…" : rawTitle || "CHILLERS";
  const year = searchParams.get("year") || "";
  const type = searchParams.get("type") === "tv" ? "Série" : "Film";
  const rating = searchParams.get("rating") || "";

  const headline = title.length > HEADLINE_MAX ? title.slice(0, HEADLINE_MAX - 1).trimEnd() + "…" : title;

  const res = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "64px 88px",
          backgroundColor: "#0a0a0b",
          backgroundImage:
            "radial-gradient(circle at 30% 20%, rgba(215,4,102,0.4) 0%, transparent 45%), radial-gradient(circle at 75% 80%, rgba(124,58,237,0.35) 0%, transparent 45%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "14px",
                backgroundColor: "#d70466",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: "30px",
                color: "#ffffff",
              }}
            >
              C
            </div>
            <div style={{ fontSize: "40px", fontWeight: 900, color: "#ffffff", letterSpacing: "2px" }}>CHILLERS</div>
          </div>
          <div
            style={{
              fontSize: "20px",
              color: "#a1a1aa",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: "9999px",
              padding: "10px 22px",
            }}
          >
            STREAMING GRATUIT
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingLeft: "8px",
            paddingRight: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "22px" }}>
            <div
              style={{
                fontSize: "24px",
                fontWeight: 700,
                color: "#d4d4d8",
                backgroundColor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: "9999px",
                padding: "8px 20px",
              }}
            >
              {type}
            </div>
            {year && <div style={{ fontSize: "24px", color: "#71717a" }}>{year}</div>}
            {rating && <div style={{ fontSize: "24px", fontWeight: 700, color: "#d70466" }}>Note {rating}/10</div>}
          </div>

          <div
            style={{
              fontSize: "76px",
              fontWeight: 900,
              color: "#ffffff",
              lineHeight: 1.08,
              maxWidth: "980px",
            }}
          >
            {headline}
          </div>

          <div style={{ marginTop: "38px", display: "flex" }}>
            <div
              style={{
                backgroundColor: "#d70466",
                color: "#ffffff",
                fontSize: "30px",
                fontWeight: 700,
                borderRadius: "9999px",
                padding: "18px 44px",
              }}
            >
              Regarder gratuitement
            </div>
          </div>
        </div>

        <div style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "22px", color: "#71717a" }}>Films, séries et anime — VF &amp; VOSTFR</div>
          <div style={{ fontSize: "22px", color: "#71717a" }}>Gratuit &amp; illimité</div>
        </div>
      </div>
    ),
    { ...size }
  );

  res.headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800");
  return res;
}