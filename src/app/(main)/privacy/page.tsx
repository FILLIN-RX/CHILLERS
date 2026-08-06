import { Metadata } from "next";
import PageContent from "./page-content";

export const metadata: Metadata = {
  title: "Confidentialité",
  description: "Politique de confidentialité de CHILLERS, la plateforme de streaming de films et séries.",
  openGraph: {
    title: "Confidentialité · CHILLERS",
    description: "Politique de confidentialité de CHILLERS.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Confidentialité · CHILLERS",
    description: "Politique de confidentialité de CHILLERS.",
  },
};

export default function Page() {
  return <PageContent />;
}
