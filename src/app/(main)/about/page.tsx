import { Metadata } from "next";
import PageContent from "./page-content";

export const metadata: Metadata = {
  title: "À propos",
  description:
    "Découvrez qui est derrière CHILLERS, la plateforme de streaming de films et séries.",
  openGraph: {
    title: "À propos · CHILLERS",
    description:
      "Découvrez qui est derrière CHILLERS, la plateforme de streaming de films et séries.",
  },
  twitter: {
    card: "summary_large_image",
    title: "À propos · CHILLERS",
    description:
      "Découvrez qui est derrière CHILLERS, la plateforme de streaming de films et séries.",
  },
};

export default function Page() {
  return <PageContent />;
}
