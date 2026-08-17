import type { Metadata } from "next";
import { SITE_URL, SITE_NAME, SITE_LOCALE, DEFAULT_OG_IMAGE } from "@/lib/seo";
import QueryProvider from "@/components/QueryProvider";
import LiveShell from "./LiveShell";

export const metadata: Metadata = {
  title: "Chaînes TV en direct",
  description:
    "Regardez les chaînes TV gratuites et publiques en direct sur CHILLERS : France 24, LCP, Public Sénat et l'actualité internationale (Al Jazeera, DW, Sky News…).",
  alternates: {
    canonical: `${SITE_URL}/live`,
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    title: "Chaînes TV en direct · CHILLERS",
    description:
      "Regardez les chaînes TV gratuites et publiques en direct sur CHILLERS : France 24, LCP, Public Sénat et l'actualité internationale.",
    url: `${SITE_URL}/live`,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    site: "@chillers",
    title: "Chaînes TV en direct · CHILLERS",
    description:
      "Regardez les chaînes TV gratuites et publiques en direct sur CHILLERS.",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <LiveShell>{children}</LiveShell>
    </QueryProvider>
  );
}
