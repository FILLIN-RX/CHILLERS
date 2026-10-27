import type { ParsedXmltv } from "./xmltv";
import { normalizeEpgKey } from "./xmltv";

export interface EpgMappingInput {
  channelKey: string;
  name: string;
  tvg?: string;
}

export type EpgMatchMethod = "tvg" | "name" | "alias";

export interface EpgMapping {
  channelKey: string;
  sourceId: string;
  method: EpgMatchMethod;
  programCount: number;
}

export interface EpgAmbiguousMatch {
  channel: EpgMappingInput;
  candidates: string[];
}

export interface EpgMappingResult {
  mappings: Map<string, EpgMapping>;
  unmatched: EpgMappingInput[];
  ambiguous: EpgAmbiguousMatch[];
}

/**
 * Alias volontairement conservateurs. On ne mappe jamais une chaîne vers un
 * flux différent : Warner ≠ Warner TV, Canal+ Sport 1 ≠ Canal+ Sport.
 */
const NAME_ALIASES: Record<string, string[]> = {
  mtvfrance: ["MTV"],
  cineplusfamiz: ["Ciné+ Family", "Cine+ Family"],
  tf1seriesfilm: ["TF1 Séries Films", "TF1 Series Films"],
};

function displayNames(parsed: ParsedXmltv, id: string): string[] {
  return parsed.channels.get(id) ?? [];
}

function programCount(parsed: ParsedXmltv, id: string): number {
  return parsed.programs.get(id)?.length ?? 0;
}

function pickCandidate(
  parsed: ParsedXmltv,
  candidates: string[],
  targetName: string,
): string | null {
  const withPrograms = candidates.filter((id) => programCount(parsed, id) > 0);
  if (withPrograms.length === 0) return null;
  if (withPrograms.length === 1) return withPrograms[0];

  const target = normalizeEpgKey(targetName);
  const exact = withPrograms.filter((id) =>
    displayNames(parsed, id).some((name) => normalizeEpgKey(name) === target),
  );
  if (exact.length === 1) return exact[0];

  // Plusieurs identifiants portent le même nom : ce sont des doublons de flux.
  const signatures = withPrograms.map((id) => {
    const names = new Set(displayNames(parsed, id).map(normalizeEpgKey).filter(Boolean));
    return names.size === 1 ? [...names][0] : null;
  });
  const first = signatures[0];
  if (first && signatures.every((signature) => signature === first)) {
    return withPrograms.reduce((best, id) =>
      programCount(parsed, id) > programCount(parsed, best) ? id : best,
    );
  }

  return null;
}

export function buildEpgMapping(
  channels: EpgMappingInput[],
  parsed: ParsedXmltv,
): EpgMappingResult {
  const byKey = new Map<string, Set<string>>();

  const addKey = (key: string, id: string) => {
    if (!key) return;
    const current = byKey.get(key);
    if (current) current.add(id);
    else byKey.set(key, new Set([id]));
  };

  for (const [id, names] of parsed.channels) {
    if (programCount(parsed, id) === 0) continue;
    addKey(normalizeEpgKey(id), id);
    for (const name of names) addKey(normalizeEpgKey(name), id);
  }

  const mappings = new Map<string, EpgMapping>();
  const unmatched: EpgMappingInput[] = [];
  const ambiguous: EpgAmbiguousMatch[] = [];

  for (const channel of channels) {
    const attempts: { method: EpgMatchMethod; keys: string[] }[] = [];
    if (channel.tvg) attempts.push({ method: "tvg", keys: [normalizeEpgKey(channel.tvg)] });
    attempts.push({ method: "name", keys: [normalizeEpgKey(channel.name)] });

    const aliases = NAME_ALIASES[normalizeEpgKey(channel.name)] ?? [];
    if (aliases.length > 0) {
      attempts.push({ method: "alias", keys: aliases.map(normalizeEpgKey) });
    }

    let mapped: EpgMapping | undefined;
    for (const attempt of attempts) {
      for (const key of attempt.keys) {
        const candidates = [...(byKey.get(key) ?? [])];
        if (candidates.length === 0) continue;
        const sourceId = pickCandidate(parsed, candidates, channel.name);
        if (!sourceId) {
          ambiguous.push({
            channel,
            candidates: candidates.flatMap((id) => displayNames(parsed, id)),
          });
          continue;
        }
        mapped = {
          channelKey: channel.channelKey,
          sourceId,
          method: attempt.method,
          programCount: programCount(parsed, sourceId),
        };
        break;
      }
      if (mapped) break;
    }

    if (mapped) mappings.set(channel.channelKey, mapped);
    else unmatched.push(channel);
  }

  return { mappings, unmatched, ambiguous };
}
