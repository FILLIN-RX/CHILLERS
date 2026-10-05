import { SportType } from '../matches/matches.types';

export interface CountryConfig {
  id: string;
  name: string;
  code: string;
  flag: string;
}

export interface LeagueConfig {
  id: string;
  slug: string;
  name: string;
  sport: SportType;
  espnLeague: string;
  logo: string;
  country: string;
  countryId: string;
  countryCode: string;
  flag: string;
  hasStandings?: boolean;
}

export const COUNTRIES_CONFIG: CountryConfig[] = [
  { id: 'england', name: 'Angleterre', code: 'GB-ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 'spain', name: 'Espagne', code: 'ES', flag: '🇪🇸' },
  { id: 'france', name: 'France', code: 'FR', flag: '🇫🇷' },
  { id: 'italy', name: 'Italie', code: 'IT', flag: '🇮🇹' },
  { id: 'germany', name: 'Allemagne', code: 'DE', flag: '🇩🇪' },
  { id: 'portugal', name: 'Portugal', code: 'PT', flag: '🇵🇹' },
  { id: 'netherlands', name: 'Pays-Bas', code: 'NL', flag: '🇳🇱' },
  { id: 'saudi-arabia', name: 'Arabie Saoudite', code: 'SA', flag: '🇸🇦' },
  { id: 'usa', name: 'États-Unis', code: 'US', flag: '🇺🇸' },
  { id: 'south-america', name: 'Amérique du Sud', code: 'SA', flag: '🌎' },
  { id: 'europe', name: 'Europe & International', code: 'EU', flag: '🌍' },
  { id: 'basketball', name: 'Basketball & NBA', code: 'US', flag: '🏀' },
];

export const LEAGUES_CONFIG: LeagueConfig[] = [
  // Europe & International
  {
    id: 'uefa.champions',
    slug: 'champions-league',
    name: 'Ligue des Champions',
    sport: 'football',
    espnLeague: 'uefa.champions',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2.png',
    country: 'Europe',
    countryId: 'europe',
    countryCode: 'EU',
    flag: '🌍',
    hasStandings: true,
  },
  {
    id: 'uefa.europa',
    slug: 'europa-league',
    name: 'Ligue Europa',
    sport: 'football',
    espnLeague: 'uefa.europa',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2.png',
    country: 'Europe',
    countryId: 'europe',
    countryCode: 'EU',
    flag: '🌍',
    hasStandings: true,
  },
  {
    id: 'uefa.europa.conference',
    slug: 'europa-conference-league',
    name: 'Ligue Conférence',
    sport: 'football',
    espnLeague: 'uefa.europa.conf',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2.png',
    country: 'Europe',
    countryId: 'europe',
    countryCode: 'EU',
    flag: '🌍',
    hasStandings: true,
  },
  {
    id: 'uefa.nations',
    slug: 'uefa-nations',
    name: 'UEFA Nations League',
    sport: 'football',
    espnLeague: 'uefa.nations',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2034.png',
    country: 'Europe',
    countryId: 'europe',
    countryCode: 'EU',
    flag: '🌍',
    hasStandings: true,
  },
  {
    id: 'fifa.world',
    slug: 'fifa-world-cup',
    name: 'Coupe du Monde FIFA',
    sport: 'football',
    espnLeague: 'fifa.world',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/4.png',
    country: 'International',
    countryId: 'europe',
    countryCode: 'INT',
    flag: '🌍',
    hasStandings: true,
  },

  // Angleterre
  {
    id: 'eng.1',
    slug: 'premier-league',
    name: 'Premier League',
    sport: 'football',
    espnLeague: 'eng.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/23.png',
    country: 'Angleterre',
    countryId: 'england',
    countryCode: 'GB-ENG',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    hasStandings: true,
  },
  {
    id: 'eng.2',
    slug: 'championship',
    name: 'Championship',
    sport: 'football',
    espnLeague: 'eng.2',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/24.png',
    country: 'Angleterre',
    countryId: 'england',
    countryCode: 'GB-ENG',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    hasStandings: true,
  },
  {
    id: 'eng.fa',
    slug: 'fa-cup',
    name: 'FA Cup',
    sport: 'football',
    espnLeague: 'eng.fa',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/21.png',
    country: 'Angleterre',
    countryId: 'england',
    countryCode: 'GB-ENG',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    hasStandings: false,
  },
  {
    id: 'eng.league_cup',
    slug: 'efl-cup',
    name: 'Carabao Cup',
    sport: 'football',
    espnLeague: 'eng.league_cup',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/22.png',
    country: 'Angleterre',
    countryId: 'england',
    countryCode: 'GB-ENG',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    hasStandings: false,
  },

  // Espagne
  {
    id: 'esp.1',
    slug: 'la-liga',
    name: 'LaLiga',
    sport: 'football',
    espnLeague: 'esp.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/15.png',
    country: 'Espagne',
    countryId: 'spain',
    countryCode: 'ES',
    flag: '🇪🇸',
    hasStandings: true,
  },
  {
    id: 'esp.2',
    slug: 'la-liga-2',
    name: 'LaLiga 2',
    sport: 'football',
    espnLeague: 'esp.2',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/16.png',
    country: 'Espagne',
    countryId: 'spain',
    countryCode: 'ES',
    flag: '🇪🇸',
    hasStandings: true,
  },
  {
    id: 'esp.copa_del_rey',
    slug: 'copa-del-rey',
    name: 'Coupe du Roi',
    sport: 'football',
    espnLeague: 'esp.copa_del_rey',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/18.png',
    country: 'Espagne',
    countryId: 'spain',
    countryCode: 'ES',
    flag: '🇪🇸',
    hasStandings: false,
  },

  // France
  {
    id: 'fra.1',
    slug: 'ligue-1',
    name: 'Ligue 1',
    sport: 'football',
    espnLeague: 'fra.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/9.png',
    country: 'France',
    countryId: 'france',
    countryCode: 'FR',
    flag: '🇫🇷',
    hasStandings: true,
  },
  {
    id: 'fra.2',
    slug: 'ligue-2',
    name: 'Ligue 2',
    sport: 'football',
    espnLeague: 'fra.2',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/8.png',
    country: 'France',
    countryId: 'france',
    countryCode: 'FR',
    flag: '🇫🇷',
    hasStandings: true,
  },
  {
    id: 'fra.coupe_de_france',
    slug: 'coupe-de-france',
    name: 'Coupe de France',
    sport: 'football',
    espnLeague: 'fra.coupe_de_france',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/7.png',
    country: 'France',
    countryId: 'france',
    countryCode: 'FR',
    flag: '🇫🇷',
    hasStandings: false,
  },

  // Italie
  {
    id: 'ita.1',
    slug: 'serie-a',
    name: 'Serie A',
    sport: 'football',
    espnLeague: 'ita.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/12.png',
    country: 'Italie',
    countryId: 'italy',
    countryCode: 'IT',
    flag: '🇮🇹',
    hasStandings: true,
  },
  {
    id: 'ita.2',
    slug: 'serie-b',
    name: 'Serie B',
    sport: 'football',
    espnLeague: 'ita.2',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/13.png',
    country: 'Italie',
    countryId: 'italy',
    countryCode: 'IT',
    flag: '🇮🇹',
    hasStandings: true,
  },
  {
    id: 'ita.coppa_italia',
    slug: 'coppa-italia',
    name: 'Coppa Italia',
    sport: 'football',
    espnLeague: 'ita.coppa_italia',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/14.png',
    country: 'Italie',
    countryId: 'italy',
    countryCode: 'IT',
    flag: '🇮🇹',
    hasStandings: false,
  },

  // Allemagne
  {
    id: 'ger.1',
    slug: 'bundesliga',
    name: 'Bundesliga',
    sport: 'football',
    espnLeague: 'ger.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/10.png',
    country: 'Allemagne',
    countryId: 'germany',
    countryCode: 'DE',
    flag: '🇩🇪',
    hasStandings: true,
  },
  {
    id: 'ger.2',
    slug: '2-bundesliga',
    name: '2. Bundesliga',
    sport: 'football',
    espnLeague: 'ger.2',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/11.png',
    country: 'Allemagne',
    countryId: 'germany',
    countryCode: 'DE',
    flag: '🇩🇪',
    hasStandings: true,
  },
  {
    id: 'ger.dfb_pokal',
    slug: 'dfb-pokal',
    name: 'DFB-Pokal',
    sport: 'football',
    espnLeague: 'ger.dfb_pokal',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/21.png',
    country: 'Allemagne',
    countryId: 'germany',
    countryCode: 'DE',
    flag: '🇩🇪',
    hasStandings: false,
  },

  // Portugal
  {
    id: 'por.1',
    slug: 'primeira-liga',
    name: 'Primeira Liga',
    sport: 'football',
    espnLeague: 'por.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/14.png',
    country: 'Portugal',
    countryId: 'portugal',
    countryCode: 'PT',
    flag: '🇵🇹',
    hasStandings: true,
  },

  // Pays-Bas
  {
    id: 'ned.1',
    slug: 'eredivisie',
    name: 'Eredivisie',
    sport: 'football',
    espnLeague: 'ned.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/11.png',
    country: 'Pays-Bas',
    countryId: 'netherlands',
    countryCode: 'NL',
    flag: '🇳🇱',
    hasStandings: true,
  },

  // Arabie Saoudite
  {
    id: 'sau.1',
    slug: 'saudi-pro-league',
    name: 'Saudi Pro League',
    sport: 'football',
    espnLeague: 'sau.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2177.png',
    country: 'Arabie Saoudite',
    countryId: 'saudi-arabia',
    countryCode: 'SA',
    flag: '🇸🇦',
    hasStandings: true,
  },

  // USA
  {
    id: 'usa.1',
    slug: 'mls',
    name: 'MLS',
    sport: 'football',
    espnLeague: 'usa.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/19.png',
    country: 'États-Unis',
    countryId: 'usa',
    countryCode: 'US',
    flag: '🇺🇸',
    hasStandings: true,
  },

  // Amérique du Sud
  {
    id: 'conmebol.libertadores',
    slug: 'copa-libertadores',
    name: 'Copa Libertadores',
    sport: 'football',
    espnLeague: 'conmebol.libertadores',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2676.png',
    country: 'Amérique du Sud',
    countryId: 'south-america',
    countryCode: 'SA',
    flag: '🌎',
    hasStandings: true,
  },
  {
    id: 'conmebol.sudamericana',
    slug: 'copa-sudamericana',
    name: 'Copa Sudamericana',
    sport: 'football',
    espnLeague: 'conmebol.sudamericana',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2677.png',
    country: 'Amérique du Sud',
    countryId: 'south-america',
    countryCode: 'SA',
    flag: '🌎',
    hasStandings: true,
  },

  // Basketball
  {
    id: 'nba',
    slug: 'nba',
    name: 'NBA Basketball',
    sport: 'basketball',
    espnLeague: 'nba',
    logo: 'https://a.espncdn.com/i/teamlogos/leagues/500/nba.png',
    country: 'USA / Canada',
    countryId: 'basketball',
    countryCode: 'US',
    flag: '🏀',
    hasStandings: true,
  },
  {
    id: 'wnba',
    slug: 'wnba',
    name: 'WNBA',
    sport: 'basketball',
    espnLeague: 'wnba',
    logo: 'https://a.espncdn.com/i/teamlogos/leagues/500/wnba.png',
    country: 'USA',
    countryId: 'basketball',
    countryCode: 'US',
    flag: '🏀',
    hasStandings: true,
  },
  {
    id: 'mens-college-basketball',
    slug: 'ncaa-basketball',
    name: 'NCAA Basketball',
    sport: 'basketball',
    espnLeague: 'mens-college-basketball',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/ncaa.png',
    country: 'USA',
    countryId: 'basketball',
    countryCode: 'US',
    flag: '🏀',
    hasStandings: true,
  },
];

export function getCountriesConfig() {
  return COUNTRIES_CONFIG.map((c) => ({
    ...c,
    leaguesCount: LEAGUES_CONFIG.filter((l) => l.countryId === c.id).length,
  }));
}

export function getLeaguesConfig() {
  return LEAGUES_CONFIG;
}

export function getLeaguesByCountryConfig(countryId: string) {
  return LEAGUES_CONFIG.filter(
    (l) => l.countryId === countryId || l.countryCode?.toLowerCase() === countryId.toLowerCase()
  );
}

export function getLeagueByIdConfig(idOrSlug: string) {
  return LEAGUES_CONFIG.find(
    (l) => l.id === idOrSlug || l.slug === idOrSlug || l.espnLeague === idOrSlug
  );
}
