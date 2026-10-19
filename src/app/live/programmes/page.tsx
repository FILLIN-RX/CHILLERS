import type { Metadata } from "next";
import ProgramGuideContent from "./page-content";

export const metadata: Metadata = {
  title: "Programmes TV — CHILLERS",
  description: "Consultez le programme TV en direct et à venir des chaînes françaises.",
};

export default function ProgramGuidePage() {
  return <ProgramGuideContent />;
}
