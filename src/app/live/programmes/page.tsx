import type { Metadata } from "next";
import ProgramGuideContent from "./page-content";

export const metadata: Metadata = {
  title: "Programmes TV — CHILLERS",
  description: "Consultez la grille TV complète des chaînes françaises, jour par jour.",
};

export default function ProgramGuidePage() {
  return <ProgramGuideContent />;
}
