import type { Metadata } from "next";
import { API_BASE, getServerApiHeaders } from "@/lib/server-api";
import { SITE_URL, SITE_NAME, SITE_LOCALE } from "@/lib/seo";
import LiveChannelContent from "./page-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  let channel: { name: string; slug: string; logo?: string } | null = null;
  try {
    const res = await fetch(`${API_BASE}/live/channels/${encodeURIComponent(slug)}`, {
      headers: getServerApiHeaders(),
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (json?.success && json.data) channel = json.data;
  } catch {
    channel = null;
  }

  if (!channel) {
    return { title: "Chaîne introuvable" };
  }

  const canonical = `${SITE_URL}/live/${channel.slug}`;
  const description = `Regardez ${channel.name} en direct, gratuitement et légalement sur CHILLERS.`;
  const ogTitle = `${channel.name} en direct · CHILLERS`;
  const images = channel.logo
    ? [{ url: channel.logo, width: 512, height: 512, alt: channel.name }]
    : [];

  return {
    title: channel.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      title: ogTitle,
      description,
      url: canonical,
      images,
    },
    twitter: {
      card: "summary_large_image",
      site: "@chillers",
      title: ogTitle,
      description,
      images,
    },
  };
}

export default function LiveChannelPage() {
  return <LiveChannelContent />;
}
