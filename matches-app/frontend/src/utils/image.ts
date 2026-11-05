const ESPN_HOST = 'a.espncdn.com';
const NO_DARK_VARIANT = new Set(['16', '97', '99', '2192']);

/**
 * Réduit les visuels ESPN à la taille réellement affichée et privilégie
 * les variantes "dark" pour les logos de compétitions, invisibles sur fond sombre.
 */
export function optimizedImageUrl(src?: string, displaySize = 32): string | undefined {
  if (!src) return undefined;

  try {
    const url = new URL(src, window.location.origin);
    if (url.hostname !== ESPN_HOST) return src;

    const target = Math.max(32, Math.min(160, Math.round(displaySize * 2)));
    let path = url.pathname;

    if (path.includes('/leaguelogos/') && !path.includes('/500-dark/')) {
      const id = path.match(/(\d+)\.png$/)?.[1];
      if (!id || !NO_DARK_VARIANT.has(id)) {
        path = path.replace('/leaguelogos/soccer/500/', '/leaguelogos/soccer/500-dark/');
      }
    }

    if (path.startsWith('/combiner/')) return src;

    return `https://${ESPN_HOST}/combiner/i?img=${encodeURIComponent(path)}&w=${target}&h=${target}`;
  } catch {
    return src;
  }
}
