import type { MatchPlayer, TeamRoster, MatchSubstitution, TeamBoxscore } from './matches.types';

// In-memory cache for LiveScore date feeds (5 minutes TTL)
const DATE_FEED_CACHE = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeName(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export interface LiveScoreEnrichment {
  rosters?: TeamRoster[];
  isProbableLineup?: boolean;
  coachHome?: string;
  coachAway?: string;
  substitutions?: MatchSubstitution[];
  venueInfo?: { name: string; city?: string; capacity?: number };
  refereeInfo?: { name: string; country?: string; image?: string };
  boxscore?: TeamBoxscore[];
}

/**
 * Service pour interroger l'API LiveScore (Option LiveScore en priorité)
 * avec algorithme de fallback (Option A) sur les données ESPN.
 */
export class LiveScoreService {
  private static readonly BASE_URL = 'https://prod-public-api.livescore.com/v1/api/app';

  /**
   * Récupère le flux complet des matchs et phases pour une date donnée
   */
  static async getDateFeed(matchDateStr?: string): Promise<{ events: any[]; stages: any[] } | null> {
    try {
      const now = new Date();
      let dateKey = now.toISOString().slice(0, 10).replace(/-/g, '');
      if (matchDateStr) {
        const clean = matchDateStr.replace(/[^0-9]/g, '').slice(0, 8);
        if (clean.length === 8) dateKey = clean;
      }

      const cached = DATE_FEED_CACHE.get(dateKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
      }

      const url = `${this.BASE_URL}/date/soccer/${dateKey}/0?locale=en&MD=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
          Accept: 'application/json',
        },
      });

      if (!res.ok) return null;

      const json = await res.json();
      const events: any[] = [];
      const stages = json.Stages || [];

      for (const stage of stages) {
        for (const ev of stage.Events || []) {
          events.push({
            ...ev,
            _stageCnm: stage.Cnm,
            _stageSnm: stage.Snm,
            _stageScd: stage.Scd,
          });
        }
      }

      const feedData = { events, stages };
      DATE_FEED_CACHE.set(dateKey, { data: feedData, timestamp: Date.now() });
      return feedData;
    } catch {
      return null;
    }
  }

  /**
   * Trouve l'identifiant d'événement LiveScore pour un match donné
   */
  static async findLiveScoreEventId(
    homeName: string,
    awayName: string,
    matchDateStr?: string
  ): Promise<string | null> {
    try {
      const feed = await this.getDateFeed(matchDateStr);
      if (!feed || !feed.events.length) return null;

      const hNorm = normalizeName(homeName);
      const aNorm = normalizeName(awayName);

      const matchedEvent = feed.events.find((ev: any) => {
        const t1 = normalizeName(ev.T1?.[0]?.Nm);
        const t2 = normalizeName(ev.T2?.[0]?.Nm);
        const t1Matches = t1.includes(hNorm) || hNorm.includes(t1);
        const t2Matches = t2.includes(aNorm) || aNorm.includes(t2);
        return t1Matches && t2Matches;
      });

      return matchedEvent?.Eid ? String(matchedEvent.Eid) : null;
    } catch {
      return null;
    }
  }

  /**
   * Récupère la poule / groupe et la compétition officielle LiveScore pour un match
   */
  static async getStageForMatch(
    homeName: string,
    awayName: string,
    matchDateStr?: string
  ): Promise<{ competitionName?: string; groupName?: string; stageCode?: string } | null> {
    try {
      const feed = await this.getDateFeed(matchDateStr);
      if (!feed || !feed.stages) return null;

      const hNorm = normalizeName(homeName);
      const aNorm = normalizeName(awayName);

      for (const stage of feed.stages) {
        for (const ev of stage.Events || []) {
          const t1 = normalizeName(ev.T1?.[0]?.Nm);
          const t2 = normalizeName(ev.T2?.[0]?.Nm);
          const t1Matches = t1.includes(hNorm) || hNorm.includes(t1);
          const t2Matches = t2.includes(aNorm) || aNorm.includes(t2);
          if (t1Matches && t2Matches) {
            return {
              competitionName: stage.Cnm,
              groupName: stage.Snm,
              stageCode: stage.Scd,
            };
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Tente de récupérer toutes les données officielles LiveScore (Compositions, Remplacements, Stade, Arbitre, Stats)
   */
  static async fetchFullLiveScoreData(
    homeName: string,
    awayName: string,
    matchDateStr?: string
  ): Promise<LiveScoreEnrichment | null> {
    try {
      const eventId = await this.findLiveScoreEventId(homeName, awayName, matchDateStr);
      if (!eventId) return null;

      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'application/json',
      };

      // Appels parallèles aux différents modules LiveScore
      const [lineupRes, infoRes, statsRes] = await Promise.all([
        fetch(`${this.BASE_URL}/lineups/soccer/${eventId}?locale=en`, { headers }),
        fetch(`${this.BASE_URL}/info/soccer/${eventId}?locale=en`, { headers }),
        fetch(`${this.BASE_URL}/statistics/soccer/${eventId}`, { headers }),
      ]);

      const result: LiveScoreEnrichment = {};

      // ─── 1. INFOS STADE & ARBITRE ───
      if (infoRes.ok) {
        const info = await infoRes.json();
        if (info.Vnm) {
          result.venueInfo = {
            name: info.Vnm,
            city: info.Vcy,
            capacity: info.Vsp,
          };
        }
        if (info.Refs && info.Refs.length > 0) {
          const r = info.Refs[0];
          result.refereeInfo = {
            name: r.Nm,
            country: r.Cn,
            image: r.imageUrl ? `https://static.livescore.com/enet/referees/${r.imageUrl}` : undefined,
          };
        }
      }

      // ─── 2. STATISTIQUES DU MATCH ───
      if (statsRes.ok) {
        const statJson = await statsRes.json();
        if (statJson.Stat && statJson.Stat.length >= 2) {
          const s1 = statJson.Stat[0];
          const s2 = statJson.Stat[1];
          const mapStat = (s: any): any[] => [
            { name: 'possession', label: 'Possession', displayValue: s.Pss !== undefined ? `${s.Pss}%` : '50%' },
            { name: 'shotsTotal', label: 'Tirs au but', displayValue: String((s.Shon || 0) + (s.Shof || 0) + (s.Shbl || 0)) },
            { name: 'shotsOnTarget', label: 'Tirs cadrés', displayValue: String(s.Shon || 0) },
            { name: 'shotsOffTarget', label: 'Tirs non cadrés', displayValue: String(s.Shof || 0) },
            { name: 'shotsBlocked', label: 'Tirs contrés', displayValue: String(s.Shbl || 0) },
            { name: 'corners', label: 'Corners', displayValue: String(s.Cos || 0) },
            { name: 'fouls', label: 'Fautes', displayValue: String(s.Fls || 0) },
            { name: 'offsides', label: 'Hors-jeux', displayValue: String(s.Ofs || 0) },
            { name: 'yellowCards', label: 'Cartons jaunes', displayValue: String(s.Ycs || 0) },
            { name: 'redCards', label: 'Cartons rouges', displayValue: String(s.Rcs || 0) },
          ];

          result.boxscore = [
            {
              team: { id: 'home', name: homeName },
              statistics: mapStat(s1),
            },
            {
              team: { id: 'away', name: awayName },
              statistics: mapStat(s2),
            },
          ];
        }
      }

      // ─── 3. COMPOSITIONS (OFFICIELLES OU PROBABLES) & REMPLACEMENTS ───
      let lData: any = null;
      let isProbable = false;

      if (lineupRes.ok) {
        lData = await lineupRes.json();
      }

      const hasStarters = (teamData: any) =>
        (teamData?.Ps || []).some((p: any) => p.Pos && p.Pos !== 5 && p.Pos !== 10);

      // Si les compos officielles ne sont pas encore publiées, essayer les compos précédentes (/lineups-p)
      if (!lData?.Lu || (!hasStarters(lData.Lu[0]) && !hasStarters(lData.Lu[1]))) {
        const prevRes = await fetch(`${this.BASE_URL}/lineups-p/soccer/${eventId}?locale=en`, { headers });
        if (prevRes.ok) {
          const prevData = await prevRes.json();
          if (prevData.T1?.Lu?.Ps && prevData.T2?.Lu?.Ps) {
            lData = {
              Lu: [
                { Tid: prevData.T1.Tid, Fo: prevData.T1.Lu.Fo, Ps: prevData.T1.Lu.Ps },
                { Tid: prevData.T2.Tid, Fo: prevData.T2.Lu.Fo, Ps: prevData.T2.Lu.Ps },
              ],
            };
            isProbable = true;
          }
        }
      }

      if (lData?.Lu && lData.Lu.length >= 2 && (hasStarters(lData.Lu[0]) || hasStarters(lData.Lu[1]))) {
        const team1Data = lData.Lu[0];
        const team2Data = lData.Lu[1];

        const mapLiveScoreTeam = (teamData: any, fallbackName: string): TeamRoster => {
          const formation = teamData.Fo ? teamData.Fo.join('-') : undefined;
          const allPs: any[] = teamData.Ps || [];

          const starters: MatchPlayer[] = allPs
            .filter((p) => p.Pos && p.Pos !== 5 && p.Pos !== 10)
            .map((p) => ({
              id: String(p.Pid || p.Aid || ''),
              name: [p.Fn, p.Ln].filter(Boolean).join(' ') || p.Pn || 'Joueur',
              jersey: p.Snu ? String(p.Snu) : undefined,
              position: p.Pon || (p.Pos === 1 ? 'Goalkeeper' : p.Pos === 2 ? 'Defender' : p.Pos === 3 ? 'Midfielder' : 'Forward'),
              formationPlace: p.Snu ? String(p.Snu) : undefined,
              fieldPosition: p.Fp,
              starter: true,
              photo: p.imageUrl ? `https://static.livescore.com/enet/athletes/${p.imageUrl}` : undefined,
            }));

          const bench: MatchPlayer[] = allPs
            .filter((p) => p.Pos === 5)
            .map((p) => ({
              id: String(p.Pid || p.Aid || ''),
              name: [p.Fn, p.Ln].filter(Boolean).join(' ') || p.Pn || 'Joueur',
              jersey: p.Snu ? String(p.Snu) : undefined,
              position: p.Pon || 'Remplaçant',
              starter: false,
              photo: p.imageUrl ? `https://static.livescore.com/enet/athletes/${p.imageUrl}` : undefined,
            }));

          return {
            team: {
              id: String(teamData.Tid || ''),
              name: fallbackName,
            },
            formation,
            starters,
            bench,
          };
        };

        const coachHome = (team1Data.Ps || []).find((p: any) => p.Pos === 10);
        const coachAway = (team2Data.Ps || []).find((p: any) => p.Pos === 10);

        result.rosters = [
          mapLiveScoreTeam(team1Data, homeName),
          mapLiveScoreTeam(team2Data, awayName),
        ];
        result.isProbableLineup = isProbable;
        result.coachHome = coachHome ? [coachHome.Fn, coachHome.Ln].filter(Boolean).join(' ') : undefined;
        result.coachAway = coachAway ? [coachAway.Fn, coachAway.Ln].filter(Boolean).join(' ') : undefined;

        // Remplacements appairés depuis LiveScore (Subs)
        if (lData.Subs) {
          const subsList: MatchSubstitution[] = [];
          const allSubs: any[] = [];
          for (const k of Object.keys(lData.Subs)) {
            if (Array.isArray(lData.Subs[k])) allSubs.push(...lData.Subs[k]);
          }

          // Filtrer les entrées (IT === 5) et chercher le sortant (IT === 4 ou IDo)
          const inEvents = allSubs.filter((s) => s.IT === 5);
          for (const sIn of inEvents) {
            const sOut = allSubs.find((s) => s.IT === 4 && s.ID === sIn.IDo && s.Min === sIn.Min);
            subsList.push({
              minute: `${sIn.Min}'`,
              teamId: sIn.Nm === 1 ? 'home' : 'away',
              playerInName: sIn.Pn || [sIn.Fn, sIn.Ln].filter(Boolean).join(' '),
              playerInJersey: sIn.Pnum ? String(sIn.Pnum) : undefined,
              playerOutName: sOut ? sOut.Pn || [sOut.Fn, sOut.Ln].filter(Boolean).join(' ') : (sIn.PnO || 'Joueur'),
              playerOutJersey: sIn.PnumO ? String(sIn.PnumO) : undefined,
            });
          }

          if (subsList.length > 0) {
            result.substitutions = subsList;
          }
        }
      }

      return result;
    } catch (err) {
      console.warn('[LiveScoreService] Erreur lors de l\'enrichissement LiveScore:', err);
      return null;
    }
  }

  /**
   * Option A (Fallback) : Génère la matrice fieldPosition ("row:col") à partir
   * de la composition et formation ESPN si LiveScore n'a pas le match.
   */
  static generateFieldPositionsFromEspn(formationStr: string | undefined, starters: MatchPlayer[]): MatchPlayer[] {
    if (!starters || starters.length === 0) return [];

    const gk = starters.find(
      (p) =>
        p.formationPlace === '1' ||
        p.position?.toLowerCase().includes('g') ||
        p.position?.toLowerCase().includes('keeper')
    );
    const outfield = starters.filter((p) => p !== gk);

    const lineCounts = (formationStr || '4-3-3')
      .split(/[-–]/)
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);

    const result: MatchPlayer[] = [];

    if (gk) {
      result.push({
        ...gk,
        fieldPosition: '1:1',
      });
    }

    let playerIdx = 0;
    lineCounts.forEach((count, lineIdx) => {
      const rowNum = lineIdx + 2;
      const rowPlayers = outfield.slice(playerIdx, playerIdx + count);
      playerIdx += count;

      rowPlayers.forEach((p, colIdx) => {
        result.push({
          ...p,
          fieldPosition: `${rowNum}:${colIdx + 1}`,
        });
      });
    });

    while (playerIdx < outfield.length) {
      const p = outfield[playerIdx++];
      result.push({
        ...p,
        fieldPosition: `${lineCounts.length + 1}:${result.length + 1}`,
      });
    }

    return result;
  }
}
