import { LRUCache } from 'lru-cache';
import { EspnClient } from '../espn/espn.client';
import { getLeagueByIdConfig } from '../config/leagues.config';
import {
  MatchTeam,
  MatchStatus,
  MatchLeague,
  TeamBoxscore,
  TeamRoster,
  MatchKeyEvent,
  MatchPlayer,
} from './matches.types';
import {
  DetailedMatchAnalysis,
  MatchOdds,
  WinProbabilityPoint,
  HeadToHeadMatch,
  TeamRecentForm,
  MatchCommentaryItem,
} from './analysis.types';

const ANALYSIS_CACHE = new LRUCache<string, DetailedMatchAnalysis>({
  max: 150,
  ttl: 15_000, // 15 secondes pour les matchs en direct
});

export class AnalysisService {
  /**
   * Calcule les probabilités de victoire implicites à partir des cotes Moneyline (format US ou décimal)
   */
  private calculateImpliedProbabilities(
    homeML?: number,
    awayML?: number,
    drawML?: number
  ): { home: number; draw: number; away: number } | undefined {
    if (homeML === undefined || awayML === undefined) return undefined;

    const toProb = (ml: number): number => {
      if (ml > 100) return 100 / (ml + 100); // cote US positive
      if (ml > 1 && ml < 100) return 1 / ml; // cote décimale
      return Math.abs(ml) / (Math.abs(ml) + 100); // cote US négative
    };

    const homeRaw = toProb(homeML);
    const awayRaw = toProb(awayML);
    const drawRaw = drawML !== undefined ? toProb(drawML) : 0;
    const total = homeRaw + awayRaw + drawRaw;

    if (total === 0) return undefined;

    return {
      home: Math.round((homeRaw / total) * 100),
      draw: Math.round((drawRaw / total) * 100),
      away: Math.round((awayRaw / total) * 100),
    };
  }

  private calculateImpliedFromDecimal(
    homeDec?: number,
    awayDec?: number,
    drawDec?: number
  ): { home: number; draw: number; away: number } | undefined {
    if (!homeDec || !awayDec || homeDec <= 1 || awayDec <= 1) return undefined;

    const homeRaw = 1 / homeDec;
    const awayRaw = 1 / awayDec;
    const drawRaw = drawDec && drawDec > 1 ? 1 / drawDec : 0;
    const total = homeRaw + awayRaw + drawRaw;

    if (total === 0) return undefined;

    return {
      home: Math.round((homeRaw / total) * 100),
      draw: Math.round((drawRaw / total) * 100),
      away: Math.round((awayRaw / total) * 100),
    };
  }

  /**
   * Récupère l'analyse complète d'un match (Boxscore, Win Probability, Chronologie, Cotes, H2H, Forme)
   */
  async getMatchAnalysis(eventId: string, leagueId?: string): Promise<DetailedMatchAnalysis | null> {
    const cacheKey = `analysis_${eventId}_${leagueId || 'all'}`;
    if (ANALYSIS_CACHE.has(cacheKey)) {
      return ANALYSIS_CACHE.get(cacheKey)!;
    }

    let sport = 'soccer';
    let espnLeague = 'all';

    if (leagueId && leagueId !== 'all') {
      const config = getLeagueByIdConfig(leagueId);
      if (config) {
        espnLeague = config.espnLeague;
        sport = config.sport === 'basketball' ? 'basketball' : 'soccer';
      } else {
        espnLeague = leagueId;
      }
    }

    let rawData = await EspnClient.fetchJson<any>(
      `/apis/site/v2/sports/${sport}/${espnLeague}/summary?event=${eventId}`
    );

    // Fallback si 404 sur ligue spécifique
    if (!rawData && espnLeague !== 'all') {
      rawData = await EspnClient.fetchJson<any>(
        `/apis/site/v2/sports/${sport}/all/summary?event=${eventId}`
      );
    }

    // Fallback basketball si non trouvé en soccer
    if (!rawData && sport === 'soccer') {
      rawData = await EspnClient.fetchJson<any>(
        `/apis/site/v2/sports/basketball/nba/summary?event=${eventId}`
      );
      if (rawData) sport = 'basketball';
    }

    if (!rawData) return null;

    try {
      const header = rawData.header || {};
      const competition = header.competitions?.[0] || {};
      const competitors = competition.competitors || [];
      const homeComp = competitors.find((c: any) => c.homeAway === 'home') || competitors[0] || {};
      const awayComp = competitors.find((c: any) => c.homeAway === 'away') || competitors[1] || {};

      const homeTeam: MatchTeam = {
        id: String(homeComp.id || homeComp.team?.id || 'home'),
        name: homeComp.team?.displayName || homeComp.team?.name || 'Équipe 1',
        shortName: homeComp.team?.shortDisplayName || homeComp.team?.name,
        abbreviation: homeComp.team?.abbreviation,
        logo: homeComp.team?.logo || homeComp.team?.logos?.[0]?.href,
        score: homeComp.score !== undefined ? parseInt(homeComp.score, 10) : undefined,
        isWinner: Boolean(homeComp.winner),
      };

      const awayTeam: MatchTeam = {
        id: String(awayComp.id || awayComp.team?.id || 'away'),
        name: awayComp.team?.displayName || awayComp.team?.name || 'Équipe 2',
        shortName: awayComp.team?.shortDisplayName || awayComp.team?.name,
        abbreviation: awayComp.team?.abbreviation,
        logo: awayComp.team?.logo || awayComp.team?.logos?.[0]?.href,
        score: awayComp.score !== undefined ? parseInt(awayComp.score, 10) : undefined,
        isWinner: Boolean(awayComp.winner),
      };

      const state = competition.status?.type?.state || 'pre';
      let status: MatchStatus = 'upcoming';
      if (state === 'in') status = 'live';
      else if (state === 'post') status = 'finished';
      else if (competition.status?.type?.name?.includes('POSTPONED')) status = 'postponed';
      else if (competition.status?.type?.name?.includes('CANCELLED')) status = 'cancelled';

      const leagueInfo: MatchLeague = {
        id: header.league?.id || espnLeague,
        name: header.league?.name || 'Football',
        slug: header.league?.slug || espnLeague,
        logo: header.league?.logos?.[0]?.href || 'https://a.espncdn.com/i/leaguelogos/soccer/500/2.png',
        country: header.league?.country || 'International',
      };

      // Lieu, arbitre et affluence
      const venue = rawData.gameInfo?.venue
        ? {
            name: rawData.gameInfo.venue.fullName,
            city: rawData.gameInfo.venue.address?.city,
            attendance: rawData.gameInfo.attendance,
          }
        : undefined;

      const referee = rawData.gameInfo?.officials?.[0]?.displayName;

      // Boxscore
      const boxscoreTeams = rawData.boxscore?.teams || [];
      const boxscore: TeamBoxscore[] = boxscoreTeams.map((t: any) => ({
        team: {
          id: String(t.team?.id || ''),
          name: t.team?.displayName || t.team?.name || '',
          abbreviation: t.team?.abbreviation,
          logo: t.team?.logo || t.team?.logos?.[0]?.href,
        },
        statistics: (t.statistics || []).map((s: any) => ({
          name: s.name,
          label: s.label || s.displayName || s.name,
          displayValue: String(s.displayValue ?? s.value ?? ''),
        })),
      }));

      // Rosters & Compositions
      const rostersData = rawData.rosters || [];
      const rosters: TeamRoster[] = rostersData.map((r: any) => {
        const allPlayers = r.roster || [];
        const extractAthletePhoto = (ath: any): string | undefined => {
          if (!ath) return undefined;
          if (typeof ath.headshot === 'string' && ath.headshot.trim()) return ath.headshot;
          if (ath.headshot?.href && typeof ath.headshot.href === 'string') return ath.headshot.href;
          if (ath.images && Array.isArray(ath.images) && ath.images[0]?.href) return ath.images[0].href;
          return undefined;
        };

        const mapPlayer = (p: any, isStarter: boolean): MatchPlayer => ({
          id: String(p.athlete?.id || p.id || ''),
          name: p.athlete?.displayName || p.athlete?.fullName || p.name || 'Joueur',
          shortName: p.athlete?.shortName || p.shortName,
          jersey: p.jersey || p.athlete?.jersey || (p.formationPlace ? String(p.formationPlace) : undefined),
          position: p.position?.abbreviation || p.position?.displayName || p.athlete?.position?.abbreviation,
          formationPlace: p.formationPlace,
          starter: isStarter,
          subbedIn: Boolean(p.subbedIn),
          subbedOut: Boolean(p.subbedOut),
          photo: extractAthletePhoto(p.athlete || p),
        });

        const starters = allPlayers.filter((p: any) => p.starter === true).map((p: any) => mapPlayer(p, true));
        const bench = allPlayers.filter((p: any) => p.starter === false).map((p: any) => mapPlayer(p, false));

        return {
          team: {
            id: String(r.team?.id || ''),
            name: r.team?.displayName || r.team?.name || '',
            abbreviation: r.team?.abbreviation,
            logo: r.team?.logo || r.team?.logos?.[0]?.href,
          },
          formation: r.formation,
          starters,
          bench,
        };
      });

      // Key Events (Buts, Cartons, Remplacements)
      const rawEvents = rawData.keyEvents || [];
      const keyEvents: MatchKeyEvent[] = rawEvents.map((ev: any) => ({
        id: String(ev.id || ''),
        type: ev.type?.text || ev.type?.type || 'Event',
        clock: ev.clock?.displayValue || (ev.clock?.value ? `${Math.floor(ev.clock.value / 60)}'` : undefined),
        period: ev.period?.number,
        text: ev.text || ev.shortText || '',
        shortText: ev.shortText,
        scoringPlay: Boolean(ev.scoringPlay),
        teamId: ev.team?.id ? String(ev.team.id) : undefined,
        teamName: ev.team?.displayName || ev.team?.name,
        participants: (ev.participants || []).map((part: any) => ({
          id: String(part.athlete?.id || ''),
          name: part.athlete?.displayName || part.athlete?.name || '',
        })),
      }));

      // Cotes de paris (Odds / Pickcenter)
      let odds: MatchOdds | undefined;
      const pickcenterItem = rawData.pickcenter?.[0] || rawData.odds?.[0];
      if (pickcenterItem) {
        const homeML = pickcenterItem.homeTeamOdds?.moneyLine;
        const awayML = pickcenterItem.awayTeamOdds?.moneyLine;
        const drawML = pickcenterItem.drawOdds?.moneyLine;

        // ESPN expose parfois des cotes décimales (soccer hors gros championnats)
        const homeDec = pickcenterItem.homeTeamOdds?.odds?.value;
        const awayDec = pickcenterItem.awayTeamOdds?.odds?.value;
        const drawDec = pickcenterItem.drawOdds?.odds?.value ?? pickcenterItem.drawOdds?.value;

        const implied =
          this.calculateImpliedProbabilities(homeML, awayML, drawML) ||
          this.calculateImpliedFromDecimal(homeDec, awayDec, drawDec);

        odds = {
          provider: pickcenterItem.provider?.name || 'ESPN',
          details: pickcenterItem.details,
          overUnder: pickcenterItem.overUnder,
          spread: pickcenterItem.spread,
          homeMoneyLine: homeML,
          awayMoneyLine: awayML,
          drawMoneyLine: drawML,
          homeDecimalOdds: homeDec,
          drawDecimalOdds: drawDec,
          awayDecimalOdds: awayDec,
          homeWinProbability: implied?.home,
          drawProbability: implied?.draw,
          awayWinProbability: implied?.away,
        };
      }

      // Win Probability Timeline
      const winProbabilityTimeline: WinProbabilityPoint[] = [];
      const playsMap = new Map<string, any>();
      if (Array.isArray(rawData.plays)) {
        for (const p of rawData.plays) {
          if (p.id) playsMap.set(String(p.id), p);
        }
      }

      if (Array.isArray(rawData.winprobability)) {
        for (const wp of rawData.winprobability) {
          const homePct = Math.round(Number(wp.homeWinPercentage || 0) * 100);
          const tiePct = Math.round(Number(wp.tiePercentage || 0) * 100);
          const awayPct = Math.max(0, 100 - homePct - tiePct);

          const matchedPlay = wp.playId ? playsMap.get(String(wp.playId)) : undefined;

          winProbabilityTimeline.push({
            playId: wp.playId,
            clock: matchedPlay?.clock?.displayValue,
            period: matchedPlay?.period?.number,
            text: matchedPlay?.text,
            homeWinPercentage: homePct,
            tiePercentage: tiePct,
            awayWinPercentage: awayPct,
          });
        }
      }

      // Probabilité de victoire actuelle
      let currentWinProbability: { home: number; draw: number; away: number } | undefined;
      if (winProbabilityTimeline.length > 0) {
        const last = winProbabilityTimeline[winProbabilityTimeline.length - 1];
        currentWinProbability = {
          home: last.homeWinPercentage,
          draw: last.tiePercentage,
          away: last.awayWinPercentage,
        };
      } else if (odds?.homeWinProbability !== undefined) {
        currentWinProbability = {
          home: odds.homeWinProbability,
          draw: odds.drawProbability || 0,
          away: odds.awayWinProbability || 0,
        };
      }

      // Forme récente (Last Five Games)
      const recentForm: TeamRecentForm[] = [];
      if (Array.isArray(rawData.lastFiveGames)) {
        for (const tf of rawData.lastFiveGames) {
          const teamId = String(tf.team?.id || '');
          const teamName = tf.team?.displayName || tf.team?.name || '';

          const matches = (tf.events || []).map((ev: any) => {
            // Format ESPN soccer : opponent / gameResult / atVs / score (home-away)
            if (ev.opponent || ev.gameResult) {
              const rawScore = String(ev.score || '0-0');
              const scoreParts = rawScore.split('-');
              const homeScore = ev.homeTeamScore !== undefined ? Number(ev.homeTeamScore) : Number(scoreParts[0] || 0);
              const awayScore = ev.awayTeamScore !== undefined ? Number(ev.awayTeamScore) : Number(scoreParts[1] || 0);
              const isHome =
                ev.atVs === 'vs'
                  ? true
                  : ev.atVs === '@'
                    ? false
                    : String(ev.homeTeamId || '') === teamId;
              const teamScore = isHome ? homeScore : awayScore;
              const opponentScore = isHome ? awayScore : homeScore;
              const rawResult = String(ev.gameResult || '').toUpperCase();

              return {
                id: String(ev.id || ''),
                date: ev.gameDate || ev.date || '',
                opponentName:
                  ev.opponent?.displayName || ev.opponent?.name || ev.opponent?.shortDisplayName || 'Adversaire',
                opponentLogo: ev.opponentLogo || ev.opponent?.logo || ev.opponent?.logos?.[0]?.href,
                competition: ev.competitionName || ev.leagueName || ev.leagueAbbreviation,
                score: `${teamScore}-${opponentScore}`,
                isHome,
                result: (rawResult === 'W' || rawResult === 'L' ? rawResult : 'D') as 'W' | 'D' | 'L',
              };
            }

            // Ancien format (compétitions avec objets competitions[])
            const comp = ev.competitions?.[0] || {};
            const competitor = (comp.competitors || []).find((c: any) => String(c.id || c.team?.id) === teamId);
            const opponent = (comp.competitors || []).find((c: any) => String(c.id || c.team?.id) !== teamId);
            const isWinner = Boolean(competitor?.winner);
            const isTie = competitor?.score === opponent?.score;
            let result: 'W' | 'D' | 'L' = 'D';
            if (!isTie) result = isWinner ? 'W' : 'L';

            return {
              id: String(ev.id || ''),
              date: ev.date || comp.date || '',
              opponentName: opponent?.team?.displayName || opponent?.team?.name || 'Adversaire',
              opponentLogo: opponent?.team?.logo || opponent?.team?.logos?.[0]?.href,
              competition: comp.competitionName || comp.leagueName,
              score: `${competitor?.score || 0}-${opponent?.score || 0}`,
              isHome: competitor?.homeAway === 'home',
              result,
            };
          });

          recentForm.push({
            teamId,
            teamName,
            form: tf.form || matches.map((m: any) => m.result).join(','),
            matches,
          });
        }
      }

      // Head to Head (Face-à-face historique)
      const headToHead: HeadToHeadMatch[] = [];
      if (Array.isArray(rawData.seasonseries)) {
        for (const series of rawData.seasonseries) {
          const events = series.events || [];
          for (const ev of events) {
            const comp = ev.competitions?.[0] || ev;
            const competitorsList = comp.competitors || [];
            const h = competitorsList.find((c: any) => c.homeAway === 'home') || competitorsList[0];
            const a = competitorsList.find((c: any) => c.homeAway === 'away') || competitorsList[1];

            if (h && a) {
              const winnerComp = competitorsList.find((c: any) => c.winner === true);
              headToHead.push({
                id: String(ev.id || comp.id || ''),
                date: ev.date || comp.date || '',
                competition: ev.competitionName || series.competitionName || series.title,
                homeTeam: {
                  id: String(h.id || h.team?.id || ''),
                  name: h.team?.displayName || h.team?.name || 'Équipe',
                  logo: h.team?.logo || h.team?.logos?.[0]?.href,
                  score: parseInt(h.score || '0', 10),
                },
                awayTeam: {
                  id: String(a.id || a.team?.id || ''),
                  name: a.team?.displayName || a.team?.name || 'Équipe',
                  logo: a.team?.logo || a.team?.logos?.[0]?.href,
                  score: parseInt(a.score || '0', 10),
                },
                winnerId: winnerComp ? String(winnerComp.id || winnerComp.team?.id) : undefined,
              });
            }
          }
        }
      }

      // Les confrontations les plus récentes d'abord (style LiveScore)
      headToHead.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Live Commentary
      const commentary: MatchCommentaryItem[] = [];
      if (Array.isArray(rawData.commentary)) {
        for (const c of rawData.commentary) {
          commentary.push({
            sequence: c.sequence || 0,
            clock: c.time?.displayValue,
            period: c.play?.period?.number,
            text: c.text || c.play?.text || '',
          });
        }
      }

      const broadcasts = (rawData.broadcasts || [])
        .flatMap((b: any) => b.names || [b.name])
        .filter(Boolean);

      const analysis: DetailedMatchAnalysis = {
        id: String(header.id || eventId),
        title: `${homeTeam.name} vs ${awayTeam.name}`,
        status,
        statusText: competition.status?.type?.shortDetail || competition.status?.type?.description,
        minute: status === 'live' ? competition.status?.displayClock : undefined,
        startTime: competition.date || header.date || new Date().toISOString(),
        startTimestamp: competition.date ? new Date(competition.date).getTime() : Date.now(),
        league: leagueInfo,
        venue,
        referee,
        homeTeam,
        awayTeam,
        boxscore,
        rosters,
        keyEvents,
        odds,
        currentWinProbability,
        winProbabilityTimeline,
        recentForm,
        headToHead,
        commentary,
        broadcasts: broadcasts.length > 0 ? broadcasts : undefined,
      };

      ANALYSIS_CACHE.set(cacheKey, analysis);
      return analysis;
    } catch (parseError: any) {
      console.error(`[AnalysisService] Erreur mapping analyse ESPN (${eventId}):`, parseError);
      return null;
    }
  }
}

export const analysisService = new AnalysisService();
