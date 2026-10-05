import type { SportMatch, MatchLeague } from '../types/matches';

export type CompetitionCategory =
  | 'top'         // Grandes Ligues (Premier League, LaLiga, L1, Serie A, Bundesliga, UCL)
  | 'euro_intl'   // Euro, Coupe du Monde, Nations League, Tournois Sélections
  | 'cup'         // Coupes Nationales (Coupe de France, FA Cup, Copa del Rey...)
  | 'division_2'  // Liga 2, Ligue 2, Championship, Serie B, 2. Bundesliga
  | 'friendly'    // Matchs Amicaux (Clubs et Sélections)
  | 'women'       // Football Féminin
  | 'youth'       // Catégories U-x (U-21, U-19, U-17...)
  | 'other';      // Autres ligues nationales

export interface MatchCategoryInfo {
  category: CompetitionCategory;
  isWomen: boolean;
  isYouth: boolean;
  youthLabel?: string;
  isFriendly: boolean;
  isSecondDivision: boolean;
  isEuroOrIntl: boolean;
  badgeLabel?: string;
  badgeColor?: string;
}

/**
 * Détecte les matchs amicaux (Club Friendly, Match amical, etc.)
 */
export function isFriendlyMatch(text: string): boolean {
  if (!text) return false;
  const l = text.toLowerCase();
  return (
    l.includes('friendly') ||
    l.includes('amical') ||
    l.includes('amicaux') ||
    l.includes('club friendly') ||
    l.includes('int. friendly') ||
    l.includes('fifa.friendly')
  );
}

/**
 * Détecte l'Euro et les compétitions internationales de sélections
 */
export function isEuroOrInternational(text: string, leagueId = ''): boolean {
  const l = text.toLowerCase();
  const id = leagueId.toLowerCase();
  return (
    id.includes('uefa.euro') ||
    id.includes('uefa.nations') ||
    id.includes('concacaf.nations') ||
    id.includes('fifa.world') ||
    l.includes('uefa euro') ||
    l.includes('euro 20') ||
    l.includes('euro qualification') ||
    l.includes('championship qualifying') ||
    l.includes('nations league') ||
    l.includes('copa america') ||
    l.includes('coupe du monde') ||
    l.includes('world cup')
  );
}

/**
 * Détecte les 2e divisions (Liga 2, Ligue 2, Championship, Serie B, 2. Bundesliga)
 */
export function isSecondDivisionLeague(text: string, leagueId = ''): boolean {
  const l = text.toLowerCase();
  const id = leagueId.toLowerCase();
  return (
    id === 'esp.2' ||
    id === 'fra.2' ||
    id === 'eng.2' ||
    id === 'ita.2' ||
    id === 'ger.2' ||
    l.includes('liga 2') ||
    l.includes('laliga 2') ||
    l.includes('segunda') ||
    l.includes('hypermotion') ||
    l.includes('ligue 2') ||
    l.includes('championship') ||
    l.includes('serie b') ||
    l.includes('2. bundesliga') ||
    l.includes('2.bundesliga') ||
    l.includes('division 2')
  );
}

/**
 * Détecte les coupes nationales
 */
export function isCupCompetition(text: string, leagueId = ''): boolean {
  const l = text.toLowerCase();
  const id = leagueId.toLowerCase();
  return (
    id.includes('.fa') ||
    id.includes('.cup') ||
    id.includes('copa_del_rey') ||
    id.includes('coupe_de_france') ||
    id.includes('coppa_italia') ||
    id.includes('dfb_pokal') ||
    l.includes('cup') ||
    l.includes('coupe') ||
    l.includes('copa del rey') ||
    l.includes('pokal') ||
    l.includes('coppa')
  );
}

/**
 * Détecte si une chaîne contient des marqueurs de football féminin
 */
export function isWomenMatchText(text: string): boolean {
  if (!text) return false;
  const l = text.toLowerCase();
  return (
    l.includes('women') ||
    l.includes('féminin') ||
    l.includes('feminine') ||
    l.includes('femmes') ||
    l.includes('dames') ||
    l.includes('ladies') ||
    l.includes('(f)') ||
    l.includes('w-league') ||
    l.includes('wsl') ||
    l.includes('uwcl') ||
    l.includes('fra.w') ||
    l.includes('eng.w') ||
    l.includes('esp.w') ||
    l.includes('ger.w') ||
    l.includes('ita.w') ||
    l.includes('fifa.w')
  );
}

/**
 * Détecte si une chaîne contient des marqueurs de catégorie Jeunes / U-x
 */
export function extractYouthCategory(text: string): string | null {
  if (!text) return null;
  const l = text.toLowerCase();

  const match = l.match(/\b(u[-_ ]?(15|16|17|18|19|20|21|22|23))\b/i);
  if (match) {
    const num = match[2];
    return `U-${num}`;
  }

  if (l.includes('youth') || l.includes('jeunes')) return 'Youth';
  if (l.includes('espoirs')) return 'Espoirs';
  if (l.includes('juniors')) return 'Juniors';
  return null;
}

/**
 * Détermine la classification complète d'un match individuel
 */
export function classifyMatch(match: SportMatch): MatchCategoryInfo {
  const allText = `${match.league.name} ${match.league.slug || ''} ${match.title || ''} ${match.homeTeam.name} ${match.awayTeam.name}`;
  const leagueId = match.league.id || '';

  const isWomen = isWomenMatchText(allText);
  const youthLabel = extractYouthCategory(allText) || undefined;
  const isYouth = Boolean(youthLabel);
  const isFriendly = isFriendlyMatch(allText);
  const isEuroOrIntl = isEuroOrInternational(allText, leagueId);
  const isSecondDivision = isSecondDivisionLeague(allText, leagueId);

  let category: CompetitionCategory = 'other';
  let badgeLabel: string | undefined;
  let badgeColor: string | undefined;

  if (isFriendly) {
    category = 'friendly';
    badgeLabel = 'Amical';
    badgeColor = '#f59e0b';
  } else if (isEuroOrIntl) {
    category = 'euro_intl';
    badgeLabel = allText.toLowerCase().includes('euro') ? 'Euro' : 'Intl';
    badgeColor = '#3b82f6';
  } else if (isWomen) {
    category = 'women';
    badgeLabel = 'Féminin';
    badgeColor = '#ec4899';
  } else if (isYouth) {
    category = 'youth';
    badgeLabel = youthLabel || 'Jeunes';
    badgeColor = '#06b6d4';
  } else if (isSecondDivision) {
    category = 'division_2';
    badgeLabel = allText.toLowerCase().includes('liga 2') ? 'Liga 2' : 'D2';
    badgeColor = '#8b5cf6';
  }

  return {
    category,
    isWomen,
    isYouth,
    youthLabel,
    isFriendly,
    isSecondDivision,
    isEuroOrIntl,
    badgeLabel,
    badgeColor,
  };
}

/**
 * Détermine la classification et l'ordre de priorité d'une ligue / compétition
 * Calqué sur l'ordre de présentation officiel LiveScore
 */
export function classifyLeague(
  league: MatchLeague,
  matches: SportMatch[] = []
): {
  category: CompetitionCategory;
  categoryLabel: string;
  badgeLabel?: string;
  badgeColor?: string;
  isWomen: boolean;
  isYouth: boolean;
  youthLabel?: string;
  isFriendly: boolean;
  isSecondDivision: boolean;
  isEuroOrIntl: boolean;
  priority: number;
} {
  const leagueText = `${league.name} ${league.slug || ''}`;
  const leagueId = league.id || '';
  const matchSample = matches
    .slice(0, 5)
    .map((m) => `${m.homeTeam.name} ${m.awayTeam.name}`)
    .join(' ');
  const fullText = `${leagueText} ${matchSample}`;

  const isWomen = isWomenMatchText(fullText);
  const youthLabel = extractYouthCategory(fullText) || undefined;
  const isYouth = Boolean(youthLabel);
  const isFriendly = isFriendlyMatch(fullText);
  const isEuroOrIntl = isEuroOrInternational(fullText, leagueId);
  const isSecondDivision = isSecondDivisionLeague(fullText, leagueId);
  const isCup = isCupCompetition(fullText, leagueId);

  // 1. Compétitions Européennes Majeures & Tournois Internationaux (Priorité 1)
  if (isEuroOrIntl) {
    const isEuro = fullText.toLowerCase().includes('euro');
    return {
      category: 'euro_intl',
      categoryLabel: isEuro ? 'Euro & Sélections' : 'Compétition Internationale',
      badgeLabel: isEuro ? 'EURO' : 'INTL',
      badgeColor: '#3b82f6',
      isWomen,
      isYouth,
      youthLabel,
      isFriendly,
      isSecondDivision: false,
      isEuroOrIntl: true,
      priority: 5,
    };
  }

  // 2. Champions League & Coupes d'Europe de clubs (Priorité 8)
  if (['uefa.champions', 'uefa.europa', 'uefa.europa.conference'].includes(leagueId)) {
    return {
      category: 'top',
      categoryLabel: 'Coupe d’Europe',
      badgeLabel: 'UCL',
      badgeColor: '#1d4ed8',
      isWomen: false,
      isYouth: false,
      isFriendly: false,
      isSecondDivision: false,
      isEuroOrIntl: false,
      priority: 8,
    };
  }

  // 3. Top 5 des Ligues Majeures (Priorité 10)
  const isTopLeague = ['eng.1', 'esp.1', 'fra.1', 'ita.1', 'ger.1'].includes(leagueId);
  if (isTopLeague) {
    return {
      category: 'top',
      categoryLabel: 'Ligue Majeure',
      badgeLabel: 'TOP',
      badgeColor: '#E50914',
      isWomen: false,
      isYouth: false,
      isFriendly: false,
      isSecondDivision: false,
      isEuroOrIntl: false,
      priority: 10,
    };
  }

  // 4. Coupes Nationales (Priorité 15)
  if (isCup) {
    return {
      category: 'cup',
      categoryLabel: 'Coupe Nationale',
      badgeLabel: 'COUPE',
      badgeColor: '#10b981',
      isWomen,
      isYouth,
      youthLabel,
      isFriendly: false,
      isSecondDivision: false,
      isEuroOrIntl: false,
      priority: 15,
    };
  }

  // 5. Deuxième Division (Liga 2, Ligue 2, Championship, Serie B...) (Priorité 25)
  if (isSecondDivision) {
    const isLiga2 = fullText.toLowerCase().includes('liga 2') || leagueId === 'esp.2';
    const isLigue2 = fullText.toLowerCase().includes('ligue 2') || leagueId === 'fra.2';
    const label = isLiga2 ? 'LIGA 2' : isLigue2 ? 'LIGUE 2' : 'D2';
    return {
      category: 'division_2',
      categoryLabel: `Deuxième Division (${label})`,
      badgeLabel: label,
      badgeColor: '#8b5cf6',
      isWomen,
      isYouth,
      youthLabel,
      isFriendly: false,
      isSecondDivision: true,
      isEuroOrIntl: false,
      priority: 25,
    };
  }

  // 6. Football Féminin (Priorité 30)
  if (isWomen) {
    return {
      category: 'women',
      categoryLabel: youthLabel ? `Féminin ${youthLabel}` : 'Football Féminin',
      badgeLabel: 'FÉMININ',
      badgeColor: '#ec4899',
      isWomen: true,
      isYouth,
      youthLabel,
      isFriendly: false,
      isSecondDivision: false,
      isEuroOrIntl: false,
      priority: 30,
    };
  }

  // 7. Catégories Jeunes & Espoirs (U-x) (Priorité 40)
  if (isYouth) {
    return {
      category: 'youth',
      categoryLabel: `Catégorie ${youthLabel}`,
      badgeLabel: youthLabel || 'JEUNES',
      badgeColor: '#06b6d4',
      isWomen: false,
      isYouth: true,
      youthLabel,
      isFriendly: false,
      isSecondDivision: false,
      isEuroOrIntl: false,
      priority: 40,
    };
  }

  // 8. Matchs Amicaux (Priorité 50)
  if (isFriendly) {
    return {
      category: 'friendly',
      categoryLabel: 'Matchs Amicaux',
      badgeLabel: 'AMICAL',
      badgeColor: '#f59e0b',
      isWomen,
      isYouth,
      youthLabel,
      isFriendly: true,
      isSecondDivision: false,
      isEuroOrIntl: false,
      priority: 50,
    };
  }

  // 9. Autres Championnats Nationaux (D1)
  return {
    category: 'other',
    categoryLabel: 'Championnat National',
    badgeLabel: undefined,
    badgeColor: undefined,
    isWomen: false,
    isYouth: false,
    isFriendly: false,
    isSecondDivision: false,
    isEuroOrIntl: false,
    priority: 20,
  };
}

/**
 * Normalisation LiveScore :
 * Regroupe tous les matchs d'un tournoi (ex: UEFA Nations League, Euro, CONCACAF, Coupe du Monde)
 * sous un SEUL en-tête unifié au lieu de créer 15 en-têtes fragmentés par groupe (Group 1, Group A, etc.)
 */
export function resolveMatchCompetition(match: SportMatch): MatchLeague {
  const currentLeague = match.league;
  const rawId = (currentLeague.id || '').toLowerCase();
  const rawName = (currentLeague.name || '').toLowerCase();
  const seasonSlug = (currentLeague.seasonSlug || '').toLowerCase();
  const title = (match.title || `${match.homeTeam.name} vs ${match.awayTeam.name}`).toLowerCase();
  const home = (match.homeTeam.name || '').toLowerCase();
  const away = (match.awayTeam.name || '').toLowerCase();
  const combined = `${rawId} ${rawName} ${seasonSlug} ${title} ${home} ${away}`;

  // ─────────────────────────────────────────────────────────────
  // 1. Catégories Jeunes & U-21 (Euro U21, Amicaux U21)
  // ─────────────────────────────────────────────────────────────
  if (
    rawId.includes('u21') ||
    rawName.includes('u21') ||
    combined.includes('u-21') ||
    combined.includes('u21') ||
    combined.includes('under-21')
  ) {
    if (isFriendlyMatch(combined)) {
      return {
        ...currentLeague,
        id: 'friendly.u21',
        name: 'Matchs Amicaux U21',
        slug: 'friendly.u21',
        country: 'International',
        flag: '🤝',
      };
    }
    return {
      ...currentLeague,
      id: 'uefa.euro.u21',
      name: 'Euro U21 2027',
      slug: 'uefa.euro.u21',
      country: 'Europe',
      countryCode: 'EU',
      flag: '🇪🇺',
      logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/53.png',
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 2. CONCACAF Nations League (AMÉRIQUE DU NORD & CENTRALE)
  // ─────────────────────────────────────────────────────────────
  const concacafTeams = [
    'costa rica', 'haiti', 'trinidad and tobago', 'curaçao', 'curacao',
    'nicaragua', 'dominican republic', 'puerto rico', 'cayman islands',
    'guyana', 'dominica', 'aruba', 'anguilla', 'bahamas', 'us virgin islands',
    'turks and caicos', 'british virgin islands', 'jamaica', 'honduras', 'panama',
    'guatemala', 'el salvador', 'suriname', 'martinique', 'barbados', 'belize',
    'bermuda', 'grenada', 'saint kitts', 'saint lucia', 'saint vincent', 'cuba', 'guadeloupe'
  ];
  if (
    rawId.includes('concacaf') ||
    rawName.includes('concacaf') ||
    seasonSlug.includes('concacaf') ||
    (concacafTeams.some((t) => home.includes(t)) && concacafTeams.some((t) => away.includes(t)) && !isFriendlyMatch(combined))
  ) {
    return {
      ...currentLeague,
      id: 'concacaf.nations',
      name: 'CONCACAF Nations League',
      slug: 'concacaf.nations',
      country: 'Amérique du Nord & Centrale',
      countryCode: 'CONCACAF',
      flag: '🌎',
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Matchs Amicaux Internationaux & Clubs
  // ─────────────────────────────────────────────────────────────
  if (
    seasonSlug.includes('international-friendly') ||
    (isFriendlyMatch(combined) && !combined.includes('u21'))
  ) {
    const isClub = combined.includes('club friendly');
    return {
      ...currentLeague,
      id: isClub ? 'club.friendly' : 'intl.friendly',
      name: isClub ? 'Matchs Amicaux de Clubs' : 'Matchs Amicaux Internationaux',
      slug: isClub ? 'club.friendly' : 'intl.friendly',
      country: 'International',
      countryCode: 'INT',
      flag: isClub ? '⚽' : '🤝',
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 4. UEFA Nations League (EUROPE)
  // ─────────────────────────────────────────────────────────────
  if (
    rawId.includes('uefa.nations') ||
    rawName.includes('uefa nations league') ||
    seasonSlug.includes('uefa-nations')
  ) {
    return {
      ...currentLeague,
      id: 'uefa.nations',
      name: 'UEFA Nations League',
      slug: 'uefa.nations',
      country: 'Europe',
      countryCode: 'EU',
      flag: '🇪🇺',
      logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/53.png',
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 5. UEFA Euro & Qualifications (EUROPE)
  // ─────────────────────────────────────────────────────────────
  if (
    rawId.includes('uefa.euro') ||
    rawName.includes('uefa euro') ||
    rawName.includes('euro 20') ||
    rawName.includes('european championship') ||
    seasonSlug.includes('euro-qualification') ||
    seasonSlug.includes('european-championship')
  ) {
    return {
      ...currentLeague,
      id: 'uefa.euro',
      name: 'UEFA Euro',
      slug: 'uefa.euro',
      country: 'Europe',
      countryCode: 'EU',
      flag: '🇪🇺',
      logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/53.png',
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 6. DEUXIÈMES DIVISIONS (ÉVALUÉES AVANT LES D1 POUR ÉVITER LES FAUX POSITIFS !)
  // ─────────────────────────────────────────────────────────────
  const spanishD2Teams = [
    'castellón', 'castellon', 'ceuta', 'sporting gijón', 'sporting gijon',
    'celta fortuna', 'sabadell', 'andorra', 'las palmas', 'real valladolid',
    'valladolid', 'girona', 'mallorca', 'tenerife', 'oviedo', 'albacete',
    'zaragoza', 'leganes', 'ferrol', 'racing santander', 'burgos', 'mirandes', 'cordoba', 'córdoba'
  ];
  if (
    rawId === 'esp.2' ||
    rawName.includes('hypermotion') ||
    rawName.includes('liga 2') ||
    rawName.includes('laliga 2') ||
    rawName.includes('segunda') ||
    spanishD2Teams.some((t) => home.includes(t) || away.includes(t))
  ) {
    return {
      ...currentLeague,
      id: 'esp.2',
      name: 'LaLiga 2',
      slug: 'esp.2',
      country: 'Espagne',
      countryCode: 'ES',
      flag: '🇪🇸',
      logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/16.png',
    };
  }

  if (rawId === 'fra.2' || rawName.includes('ligue 2')) {
    return {
      ...currentLeague,
      id: 'fra.2',
      name: 'Ligue 2',
      slug: 'fra.2',
      country: 'France',
      countryCode: 'FR',
      flag: '🇫🇷',
      logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/10.png',
    };
  }

  if (rawId === 'eng.2' || rawName.includes('championship')) {
    return {
      ...currentLeague,
      id: 'eng.2',
      name: 'Championship',
      slug: 'eng.2',
      country: 'Angleterre',
      countryCode: 'GB-ENG',
      flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/24.png',
    };
  }

  if (rawId === 'ita.2' || rawName.includes('serie b')) {
    return {
      ...currentLeague,
      id: 'ita.2',
      name: 'Serie B',
      slug: 'ita.2',
      country: 'Italie',
      countryCode: 'IT',
      flag: '🇮🇹',
      logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/13.png',
    };
  }

  if (rawId === 'ger.2' || rawName.includes('2. bundesliga') || rawName.includes('2.bundesliga')) {
    return {
      ...currentLeague,
      id: 'ger.2',
      name: '2. Bundesliga',
      slug: 'ger.2',
      country: 'Allemagne',
      countryCode: 'DE',
      flag: '🇩🇪',
      logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/6.png',
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 7. PREMIÈRES DIVISIONS (Top 5)
  // ─────────────────────────────────────────────────────────────
  if (rawId === 'eng.1' || (rawName.includes('premier league') && !rawName.includes('isthmian') && !rawName.includes('jamaica'))) {
    return {
      ...currentLeague,
      id: 'eng.1',
      name: 'Premier League',
      slug: 'eng.1',
      country: 'Angleterre',
      countryCode: 'GB-ENG',
      flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      logo: currentLeague.logo || '/league/premiere_ligue/pl_logo.png',
    };
  }

  if (
    rawId !== 'esp.2' &&
    !/\b2\b|hypermotion|segunda/.test(rawName) &&
    (rawId === 'esp.1' || rawName === 'laliga' || rawName === 'la liga' || rawName.startsWith('laliga ea'))
  ) {
    return {
      ...currentLeague,
      id: 'esp.1',
      name: 'LaLiga',
      slug: 'esp.1',
      country: 'Espagne',
      countryCode: 'ES',
      flag: '🇪🇸',
      logo: currentLeague.logo || '/league/liga/liga.png',
    };
  }

  if (rawId === 'ita.1' || rawName === 'serie a') {
    return {
      ...currentLeague,
      id: 'ita.1',
      name: 'Serie A',
      slug: 'ita.1',
      country: 'Italie',
      countryCode: 'IT',
      flag: '🇮🇹',
      logo: currentLeague.logo || '/league/serie_A/seriea.png',
    };
  }

  if (rawId === 'ger.1' || rawName === 'bundesliga') {
    return {
      ...currentLeague,
      id: 'ger.1',
      name: 'Bundesliga',
      slug: 'ger.1',
      country: 'Allemagne',
      countryCode: 'DE',
      flag: '🇩🇪',
      logo: currentLeague.logo || '/league/Bundesliga/budesliga.png',
    };
  }

  if (rawId === 'fra.1' || rawName === 'ligue 1') {
    return {
      ...currentLeague,
      id: 'fra.1',
      name: 'Ligue 1',
      slug: 'fra.1',
      country: 'France',
      countryCode: 'FR',
      flag: '🇫🇷',
      logo: currentLeague.logo || '/league/ligue_1/l1_logo.png',
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 9. Football Féminin
  // ─────────────────────────────────────────────────────────────
  if (combined.includes('wsl') || combined.includes("women's super league")) {
    return {
      ...currentLeague,
      id: 'eng.w.1',
      name: "Barclays Women's Super League",
      slug: 'eng.w.1',
      country: 'Angleterre',
      countryCode: 'GB-ENG',
      flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    };
  }

  if (combined.includes('liga f') || (combined.includes('barcelona') && combined.includes('real madrid') && isWomenMatchText(combined))) {
    return {
      ...currentLeague,
      id: 'esp.w.1',
      name: 'Liga F',
      slug: 'esp.w.1',
      country: 'Espagne',
      countryCode: 'ES',
      flag: '🇪🇸',
    };
  }

  // Nettoyage générique : retirer les suffixes de sous-groupes " - Group X", " - Round X"
  if (currentLeague.name) {
    const groupMatch = currentLeague.name.match(/\s*-\s*(Group\s+[A-Z0-9]+|Groupe\s+[A-Z0-9]+|Poule\s+[A-Z0-9]+|League\s+[A-D]\s*:\s*Group\s+[0-9]+)/i);
    if (groupMatch && !match.group) {
      match.group = groupMatch[1].trim();
    }

    const cleanName = currentLeague.name
      .replace(/\s*-\s*Group\s+[A-Z0-9]+/i, '')
      .replace(/\s*-\s*League\s+[A-Z0-9]+/i, '')
      .replace(/\s*-\s*Round\s+[A-Z0-9]+/i, '')
      .replace(/\s*-\s*Group\s*Stage/i, '')
      .trim();

    if (cleanName && cleanName !== currentLeague.name) {
      return {
        ...currentLeague,
        name: cleanName,
      };
    }
  }

  return currentLeague;
}

/**
 * Extrait et formate le nom de la Poule / Groupe pour l'affichage
 */
export function extractMatchGroup(match: SportMatch): string | null {
  if (match.group && match.group.trim()) {
    return match.group.trim();
  }
  const raw = `${match.league?.name || ''} ${match.title || ''}`;
  const matchGroup = raw.match(/\b(League\s+[A-D]\s*:\s*Group\s+[0-9]+|Ligue\s+[A-D]\s*:\s*Groupe\s+[0-9]+|Group\s+[A-Z0-9]+|Groupe\s+[A-Z0-9]+|Poule\s+[A-Z0-9]+)\b/i);
  if (matchGroup) {
    return matchGroup[1].trim();
  }
  return null;
}

