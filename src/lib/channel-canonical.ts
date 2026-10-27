const CANONICAL_ALIASES: Record<string, string> = {
  FRANCE24FRANCAIS: "FRANCE24",
  LCP: "LCPASSEMBLEENATIONALE",
};

export function canonicalChannelKey(name: string): string {
  const key = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
  return CANONICAL_ALIASES[key] ?? key;
}

export interface ChannelPriorityInput {
  name: string;
  streamUrl?: string;
  ohaId?: string;
  source?: string;
}

export function channelPriority(channel: ChannelPriorityInput): number {
  if (channel.streamUrl && channel.source !== "oha") return 3;
  if (channel.streamUrl) return 2;
  if (channel.ohaId) return 1;
  return 0;
}
