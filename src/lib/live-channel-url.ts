import type { LiveChannel } from "@/types/live";

/** Identifiant stable utilisable dans `/live?ch=…` et par le lecteur. */
export function liveChannelRef(channel: LiveChannel): string {
  if (channel.ohaId) return `oha-${channel.ohaId}`;
  return channel._id || channel.slug;
}

export function matchesLiveChannelRef(channel: LiveChannel, ref: string): boolean {
  if (!ref) return false;
  return (
    channel._id === ref ||
    channel.slug === ref ||
    (channel.ohaId != null && (channel.ohaId === ref || `oha-${channel.ohaId}` === ref))
  );
}

export function liveChannelShareUrl(channel: LiveChannel): string {
  const ref = liveChannelRef(channel);
  if (typeof window === "undefined") return `/live?ch=${encodeURIComponent(ref)}`;
  const url = new URL("/live", window.location.origin);
  url.searchParams.set("ch", ref);
  return url.toString();
}
