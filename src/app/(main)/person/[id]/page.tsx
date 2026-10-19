import { Metadata } from "next";
import { Suspense } from "react";
import { getPersonDetails } from "@/services/media";
import { SITE_URL, SITE_NAME, SITE_LOCALE, DEFAULT_OG_IMAGE } from "@/lib/seo";
import PersonClient from "./person-client";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function smartTruncate(text: string, max: number): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const cleanCut = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return cleanCut.replace(/[,;:.!?—\-]+$/, "").trimEnd() + "…";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const person = await getPersonDetails(id);
    if (!person) return {};
    const path = `/person/${id}`;
    const canonical = `${SITE_URL}${path}`;

    const prefix =
      person.knownForDepartment === "Directing"
        ? `La filmographie de réalisation de ${person.name} est disponible sur CHILLERS.`
        : `La filmographie de ${person.name} est disponible sur CHILLERS.`;

    const description = person.biography
      ? smartTruncate(`${prefix} ${person.biography.trim().replace(/\s+/g, " ")}`, 175)
      : `${prefix} Retrouvez ses films et séries en streaming VF/VOSTFR gratuit.`;

    const pageTitle = `${person.name} — Filmographie`;
    const ogTitle = `${person.name} · CHILLERS`;
    const profile = person.profileUrl ? person.profileUrl.replace("/original", "/w780") : undefined;
    const ogImages = profile
      ? [{ url: profile, secureUrl: profile, width: 780, height: 1170, alt: `${person.name} — photo`, type: "image/jpeg" }]
      : [DEFAULT_OG_IMAGE];

    return {
      title: pageTitle,
      description,
      alternates: { canonical },
      keywords: [
        person.name,
        person.knownForDepartment,
        "filmographie",
        "acteur",
        "streaming",
        "VF",
        "VOSTFR",
        "CHILLERS",
      ].filter(Boolean),
      openGraph: {
        type: "profile",
        siteName: SITE_NAME,
        title: ogTitle,
        description,
        url: canonical,
        locale: SITE_LOCALE,
        images: ogImages,
      },
      twitter: {
        card: "summary_large_image",
        title: ogTitle,
        description,
        site: "@chillers",
        creator: "@chillers",
        images: ogImages,
      },
    };
  } catch {
    return {};
  }
}

export default async function PersonPage({ params }: Props) {
  const { id } = await params;
  const person = await getPersonDetails(id).catch(() => null);

  const jsonLd = person
    ? {
        "@context": "https://schema.org",
        "@type": "Person",
        name: person.name,
        description: person.biography
          ? smartTruncate(person.biography, 300)
          : `${person.name} — filmographie complète sur CHILLERS.`,
        url: `${SITE_URL}/person/${id}`,
        ...(person.profileUrl ? { image: person.profileUrl } : {}),
        ...(person.birthday ? { birthDate: person.birthday } : {}),
        ...(person.deathday ? { deathDate: person.deathday } : {}),
        ...(person.placeOfBirth ? { birthPlace: person.placeOfBirth } : {}),
        ...(person.knownForDepartment ? { jobTitle: person.knownForDepartment } : {}),
        ...(person.alsoKnownAs.length > 0 ? { alternateName: person.alsoKnownAs } : {}),
      }
    : null;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1F1F1F] text-white select-none pb-24">
          <div className="w-full h-[55vh] bg-gradient-to-b from-zinc-800 to-[#09090B]" />
          <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 py-10 space-y-6">
            <div className="h-10 w-64 rounded-xl skeleton-loading" />
            <div className="h-4 w-96 max-w-full rounded-lg skeleton-loading" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-2xl skeleton-loading" />
              ))}
            </div>
          </div>
        </div>
      }
    >
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <PersonClient id={id} initialPerson={person} />
    </Suspense>
  );
}
