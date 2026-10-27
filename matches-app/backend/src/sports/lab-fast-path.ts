/**
 * Fast path lab en lecture : le snapshot du lab (scan + probe des 5 providers)
 * récolte déjà les HLS des rencontres du jour — quand il est frais, inutile de
 * re-scrappe le provider, on part de ces liens-là.
 *
 * Frais = moins de `SPORTS_LAB_FASTPATH_TTL_S` (2 h par défaut) : au-delà, les
 * jetons CDN (kora `token=`, kooorah `?e=`, streamiz `?cst=`…) ont tourné et le
 * snapshot ne vaut plus rien — on laisse alors la chaîne de providers
 * re-résoudre à la demande, comme avant.
 *
 * Chaque serveur est probeé à la volée au moment de la lecture (le statut
 * « playable » du snapshot n'est qu'un indice) et porte le relay du lab
 * (`/api/sports/lab/play`) : celui-ci rejoue playlist + segments avec le
 * Referer d'origine, sans dépendre de la chaîne de providers.
 */
import { LAB_ENABLED, loadSnapshot } from './lab/lab-store';
import { fixtureScore } from './utils/fixture-match';
import { SPORTS_SOURCES, type SportsMatch, type SportsServer, type SportsSourceId } from './sports.types';

const TTL_S = Number(process.env.SPORTS_LAB_FASTPATH_TTL_S ?? 6 * 3600);
const CLOSE_KICKOFF_S = 45 * 60;
const MIN_FIXTURE_SCORE = 0.9;

function asProvider(name: string): SportsSourceId | undefined {
  return (SPORTS_SOURCES as string[]).includes(name) ? (name as SportsSourceId) : undefined;
}

/** HLS probeés du snapshot pour cette rencontre, ou []. */
export function labFastPathServers(match: SportsMatch): SportsServer[] {
  if (!LAB_ENABLED || TTL_S <= 0) return [];
  try {
    const snap = loadSnapshot();
    if (Number.isNaN(Date.parse(snap.generatedAt))) return [];
    if (Date.now() - Date.parse(snap.generatedAt) > TTL_S * 1000) return [];

    const fix = snap.fixtures.find((f) => {
      if (fixtureScore({ home: f.home, away: f.away }, match) < MIN_FIXTURE_SCORE) return false;
      if (!f.startTs || match.startTs === undefined) return true;
      const labTs = Date.parse(f.startTs) / 1000;
      return Number.isFinite(labTs) && Math.abs(labTs - match.startTs) <= CLOSE_KICKOFF_S;
    });
    if (!fix) return [];

    return (snap.byId.get(fix.id) ?? [])
      .filter((ch) => ch.type === 'hls' && ch.playable && ch.confirmed)
      .map((ch) => ({
        name: ch.channelName || 'Lab',
        url: ch.url,
        type: 'hls' as const,
        referer: ch.referer,
        relayUrl: ch.relayUrl,
        source: asProvider(ch.provider),
        sourceId: ch.sourceId,
      }));
  } catch {
    // pas de report.json (prod sans lab) : le fast path est simplement absent
    return [];
  }
}
