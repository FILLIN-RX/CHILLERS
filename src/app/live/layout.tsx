import type { Metadata } from "next";
import { SITE_URL, SITE_NAME, SITE_LOCALE, DEFAULT_OG_IMAGE } from "@/lib/seo";
import QueryProvider from "@/components/QueryProvider";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Chaînes TV en direct",
  description:
    "Regardez les chaînes TV gratuites et de sport en direct sur CHILLERS : beIN SPORTS, sport, actualités et chaînes internationales.",
  alternates: {
    canonical: `${SITE_URL}/live`,
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    title: "Chaînes TV en direct · CHILLERS",
    description:
      "Regardez les chaînes TV de sport et en direct sur CHILLERS : beIN SPORTS, Eurosport, actualités et internationales.",
    url: `${SITE_URL}/live`,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    site: "@chillers",
    title: "Chaînes TV en direct · CHILLERS",
    description:
      "Regardez les chaînes TV de sport et en direct sur CHILLERS.",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AppShell>{children}</AppShell>
    </QueryProvider>
  );
}
