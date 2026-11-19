/**
 * Utilitaires purs pour les résultats de streaming (embeds vs URLs directes).
 *
 * Un embed est une page HTML (iframe) : ce n'est PAS une URL jouable par le
 * lecteur <video>. Les garder dans `directUrl` faisait qualifier un embed mort
 * de « flux jouable » et le cacher 24 h.
 */

export function isEmbedOrHtml(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.html?(\?|$)/i.test(url) || url.includes('/embed-') || url.includes('/e/') || url.includes('/embed/');
}

/** Ne conserve une URL directe que si elle pointe vers un média, pas une page. */
export function normalizeDirectUrl(url: string | null | undefined): string | undefined {
  if (!url || isEmbedOrHtml(url)) return undefined;
  return url;
}

export interface CacheTtlOptions {
  /** TTL court pour un résultat sans URL directe jouable. */
  weakTtl: number;
  /** TTL spécifique au provider OHA (jeton relayé). */
  ohaTtl?: number;
}

/** TTL à appliquer à un résultat : court pour les embeds, long pour un média. */
export function cacheTtlFor(
  result: { provider: string; directUrl?: string },
  options: CacheTtlOptions,
): number | undefined {
  if (result.provider === 'oha') return options.ohaTtl;
  const embedOnly = !result.directUrl || isEmbedOrHtml(result.directUrl);
  return embedOnly ? options.weakTtl : undefined;
}
