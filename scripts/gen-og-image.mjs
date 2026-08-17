// Génère public/og-image.png (1200x630) avec le design CHILLERS.
// Usage : node scripts/gen-og-image.mjs
import React from "react";
import { ImageResponse } from "@vercel/og";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const e = (type, props, ...children) => React.createElement(type, props, ...children);

const element = e(
  "div",
  {
    style: {
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
    },
  },
  e(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        marginBottom: "24px",
      },
    },
    e(
      "div",
      {
        style: {
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
        },
      },
      "C"
    ),
    e("div", { style: { fontSize: "72px", fontWeight: 900, color: "#ffffff", letterSpacing: "2px" } }, "CHILLERS")
  ),
  e(
    "div",
    { style: { fontSize: "30px", fontWeight: 600, color: "#d4d4d8", textAlign: "center", padding: "0 40px" } },
    "Films, séries et anime en streaming gratuit"
  ),
  e(
    "div",
    { style: { fontSize: "22px", color: "#71717a", marginTop: "20px" } },
    "Regardez en illimité — VF & VOSTFR"
  )
);

const response = new ImageResponse(element, { width: 1200, height: 630 });
const buffer = Buffer.from(await response.arrayBuffer());
const out = join(__dirname, "../public/og-image.png");
writeFileSync(out, buffer);
console.log(`OK: ${out} (${buffer.length} bytes)`);