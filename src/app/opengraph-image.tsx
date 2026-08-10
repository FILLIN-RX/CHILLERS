import { ImageResponse } from "next/og";

export const alt = "CHILLERS — Films et séries en streaming gratuit";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0b",
          backgroundImage:
            "radial-gradient(circle at 30% 20%, rgba(215,4,102,0.35) 0%, transparent 45%), radial-gradient(circle at 75% 80%, rgba(124,58,237,0.3) 0%, transparent 45%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "18px",
              backgroundColor: "#d70466",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: "40px",
              color: "#fff",
            }}
          >
            C
          </div>
          <div style={{ fontSize: "72px", fontWeight: 900, color: "#ffffff", letterSpacing: "2px" }}>
            CHILLERS
          </div>
        </div>
        <div style={{ fontSize: "30px", fontWeight: 600, color: "#d4d4d8", textAlign: "center", padding: "0 40px" }}>
          Films, séries et anime en streaming gratuit
        </div>
        <div style={{ fontSize: "22px", color: "#71717a", marginTop: "20px" }}>
          Regardez en illimité — VF &amp; VOSTFR
        </div>
      </div>
    ),
    { ...size }
  );
}
