import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get("title") || "Films & Séries en Streaming";
    const type = searchParams.get("type") || "movie";
    const poster = searchParams.get("poster");
    const backdrop = searchParams.get("backdrop");
    const year = searchParams.get("year");
    const rating = searchParams.get("rating");
    const overview = searchParams.get("overview");

    const tmdbBase = "https://image.tmdb.org/t/p";
    const posterUrl = poster ? `${tmdbBase}/w500${poster}` : null;
    const backdropUrl = backdrop ? `${tmdbBase}/w1280${backdrop}` : posterUrl;

    const isTV = type === "tv";
    const mediaTypeLabel = isTV ? "SÉRIE" : "FILM";
    const availabilityText = isTV ? "Disponible sur CHILLERS" : "Ce film est disponible sur CHILLERS";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#09090b",
            color: "#ffffff",
            fontFamily: "sans-serif",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Backdrop avec flou et transparence */}
          {backdropUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={backdropUrl}
              alt=""
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.25,
                filter: "blur(12px)",
              }}
            />
          )}

          {/* Dégradé sombre par-dessus */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background:
                "linear-gradient(90deg, #09090b 25%, rgba(9, 9, 11, 0.85) 65%, rgba(9, 9, 11, 0.45) 100%)",
            }}
          />

          {/* Contenu principal */}
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              width: "100%",
              height: "100%",
              padding: "48px 56px",
              gap: "48px",
            }}
          >
            {/* Affiche du film (Poster) */}
            {posterUrl ? (
              <div
                style={{
                  display: "flex",
                  borderRadius: "16px",
                  overflow: "hidden",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.8), 0 0 0 2px rgba(255,255,255,0.15)",
                  flexShrink: 0,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={posterUrl}
                  alt={title}
                  style={{
                    width: "240px",
                    height: "360px",
                    objectFit: "cover",
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  width: "240px",
                  height: "360px",
                  borderRadius: "16px",
                  backgroundColor: "#18181b",
                  border: "2px solid #27272a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "32px",
                  fontWeight: 700,
                  color: "#e50914",
                  flexShrink: 0,
                }}
              >
                CHILLERS
              </div>
            )}

            {/* Colonne d'informations */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                flex: 1,
                gap: "16px",
              }}
            >
              {/* Badges d'en-tête */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#e50914",
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: "14px",
                    padding: "6px 14px",
                    borderRadius: "20px",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                  }}
                >
                  CHILLERS
                </div>
                <div
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.12)",
                    color: "#e4e4e7",
                    fontSize: "13px",
                    fontWeight: 600,
                    padding: "6px 12px",
                    borderRadius: "20px",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                  }}
                >
                  {mediaTypeLabel}
                </div>
                {year && (
                  <div
                    style={{
                      color: "#a1a1aa",
                      fontSize: "15px",
                      fontWeight: 600,
                    }}
                  >
                    {year}
                  </div>
                )}
                {rating && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      color: "#f59e0b",
                      fontSize: "15px",
                      fontWeight: 700,
                      gap: "4px",
                    }}
                  >
                    ★ {rating}/10
                  </div>
                )}
              </div>

              {/* Titre du film */}
              <div
                style={{
                  fontSize: title.length > 30 ? "36px" : "44px",
                  fontWeight: 800,
                  color: "#ffffff",
                  lineHeight: 1.15,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {title}
              </div>

              {/* Slogan d'accès */}
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>🍿</span> {availabilityText}
              </div>

              {/* Synopsis TMDB */}
              {overview && (
                <div
                  style={{
                    fontSize: "16px",
                    color: "#a1a1aa",
                    lineHeight: 1.45,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {overview}
                </div>
              )}
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (err) {
    console.error("Erreur lors de la génération de l'image OG:", err);
    return new Response("Erreur lors de la génération d'image OG", { status: 500 });
  }
}
