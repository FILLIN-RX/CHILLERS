import { LRUCache } from 'lru-cache';
import { matchesService } from '../matches/matches.service';
import { getSportsMatches, resolveSportsFlux, warmupMatchChannels } from '../sports/sports.service';
import type { SportsMatch, SportsServer } from '../sports/sports.types';
import { MULTI_SERVER_ENABLED, getRegisteredChannels } from '../sports/match-channels.registry';
import type { LiveSourceMatch, ResolvedStreamResponse, StreamServer } from './streams.types';

const STREAM_CACHE = new LRUCache<string, ResolvedStreamResponse>({
  max: 200,
  ttl: 30_000,
});

function normalizeTeam(name?: string): string {
  if (!name) return '';
  let s = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/\bparis\s+saint[- ]germain\b/g, 'psg');
  s = s.replace(/\bmanchester\s+city\b/g, 'mancity');
  s = s.replace(/\bmanchester\s+united\b/g, 'manunited');
  s = s.replace(/\bman\s+utd\b/g, 'manunited');
  s = s.replace(/\bman\s+city\b/g, 'mancity');
  s = s.replace(/\batletico\s+madrid\b/g, 'atleticomadrid');
  s = s.replace(/\breal\s+madrid\b/g, 'realmadrid');
  s = s.replace(/\bbayern\s+munich\b/g, 'bayernmunich');
  s = s.replace(/\bbayern\s+münchen\b/g, 'bayernmunich');
  s = s.replace(/\bborussia\s+dortmund\b/g, 'dortmund');
  s = s.replace(/\bbvb\b/g, 'dortmund');
  s = s.replace(/\bspurs\b/g, 'tottenham');
  s = s.replace(/\bwolves\b/g, 'wolverhampton');
  s = s.replace(/\bbarca\b/g, 'barcelona');
  s = s.replace(/\binter\s+milan\b/g, 'inter');
  s = s.replace(/\bac\s+milan\b/g, 'milan');
  s = s.replace(/\bolympique\s+de\s+marseille\b/g, 'marseille');
  s = s.replace(/\bolympique\s+lyonnais\b/g, 'lyon');
  s = s.replace(/\b(fc|cf|sc|ac|as|rc|us|afc|ssc|cd|club|de|united|city|hotspur|sporting)\b/g, '');
  s = s.replace(/[^a-z0-9]/g, '');
  return s.trim();
}

function areTeamsMatching(h1?: string, a1?: string, h2?: string, a2?: string): boolean {
  const normH1 = normalizeTeam(h1);
  const normA1 = normalizeTeam(a1);
  const normH2 = normalizeTeam(h2);
  const normA2 = normalizeTeam(a2);
  if (!normH1 || !normH2) return false;

  const directMatch =
    (normH1.includes(normH2) || normH2.includes(normH1)) &&
    (!normA1 || !normA2 || normA1.includes(normA2) || normA2.includes(normA1));

  const invertedMatch =
    (normH1.includes(normA2) || normA2.includes(normH1)) &&
    (!normA1 || !normH2 || normA1.includes(normH2) || normH2.includes(normA1));

  return directMatch || invertedMatch;
}

function relayFor(server: SportsServer, fluxSource: string, fluxSourceId: string): string | undefined {
  if (server.relayUrl) return server.relayUrl;
  const type = server.type ?? 'iframe';
  const source = server.source ?? fluxSource;
  const sourceId = server.sourceId ?? fluxSourceId;
  if (server.external || type !== 'hls' || !source || !sourceId) return undefined;
  return `/api/sports/match/${source}/${encodeURIComponent(sourceId)}/hls/playlist.m3u8`;
}

function unavailable(matchId: string, homeTeam?: string, awayTeam?: string, message?: string): ResolvedStreamResponse {
  return {
    success: false,
    matchId,
    homeTeam,
    awayTeam,
    status: 'not_found',
    servers: [],
    message: message || 'Aucun flux vidéo direct disponible pour le moment (match non commencé ou non couvert)',
  };
}

export class StreamsService {
  async getLiveBallMatches(): Promise<LiveSourceMatch[]> {
    const matches = await getSportsMatches().catch(() => []);
    return matches
      .filter((m: SportsMatch) => m.status === 'live')
      .map((m: SportsMatch) => ({
        id: m.sourceId,
        status: m.status,
        home: m.home,
        away: m.away,
        homeLogo: m.homeLogo,
        awayLogo: m.awayLogo,
        score: m.score,
        startTs: m.startTs,
        league: m.league,
      }));
  }

  async resolveStreamForMatch(
    matchIdOrEspnId: string,
    homeQuery?: string,
    awayQuery?: string,
  ): Promise<ResolvedStreamResponse> {
    const cacheKey = `stream_${matchIdOrEspnId}_${homeQuery || ''}_${awayQuery || ''}`;
    const cached = STREAM_CACHE.get(cacheKey);
    if (cached) return cached;

    let homeName = homeQuery;
    let awayName = awayQuery;

    if (!homeName || !awayName) {
      try {
        const espnMatch = await matchesService.getMatchById(matchIdOrEspnId);
        if (espnMatch) {
          homeName = espnMatch.homeTeam?.name;
          awayName = espnMatch.awayTeam?.name;
        }
      } catch {}
    }

    if (!homeName || !awayName) {
      return unavailable(matchIdOrEspnId, homeName, awayName, "Impossible d'identifier les équipes pour ce match");
    }

    const sportsMatches = await getSportsMatches().catch(() => []);
    const matched = sportsMatches.find((sm) =>
      Boolean(sm.away?.trim()) && areTeamsMatching(homeName, awayName, sm.home, sm.away),
    );

    if (!matched) {
      return unavailable(matchIdOrEspnId, homeName, awayName);
    }

    const flux = await resolveSportsFlux(matched).catch(() => null);
    if (!flux) {
      return unavailable(matchIdOrEspnId, homeName, awayName);
    }

    let servers = flux.stream.servers;
    if (MULTI_SERVER_ENABLED) {
      const registered = getRegisteredChannels(matched.id);
      if (registered && registered.servers.length > servers.length) {
        servers = registered.servers;
      } else {
        warmupMatchChannels(matched);
      }
    }

    const primaryIsExternal = (servers[0] ?? flux.stream.servers[0])?.external === true;
    const relayUrl =
      flux.stream.type === 'hls' && !primaryIsExternal
        ? `/api/sports/match/${flux.source}/${encodeURIComponent(flux.sourceId)}/hls/playlist.m3u8`
        : undefined;

    const response: ResolvedStreamResponse = {
      success: true,
      matchId: matchIdOrEspnId,
      homeTeam: homeName,
      awayTeam: awayName,
      status: 'resolved',
      source: flux.source,
      sourceMatchId: flux.sourceId,
      primaryUrl: relayUrl ?? flux.stream.url,
      primaryType: flux.stream.type,
      servers: servers.map((s, i): StreamServer => {
        const type = (s.type || flux.stream.type) as 'hls' | 'iframe';
        return {
          id: `sports-${s.source ?? flux.source}-${i}`,
          name: s.name?.trim() || (s.source ?? flux.source).toUpperCase(),
          url: s.url,
          type,
          relayUrl: relayFor({ ...s, type }, flux.source, flux.sourceId),
          provider: s.external ? undefined : s.source ?? flux.source,
          referer: s.referer,
          isPrimary: i === 0,
        };
      }),
    };

    STREAM_CACHE.set(cacheKey, response);
    return response;
  }
}

export const streamsService = new StreamsService();
