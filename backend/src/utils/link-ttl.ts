/**
 * link-ttl.ts
 * Détecte si un lien signé (Uqload, Vidzy.cc, etc.) est expiré
 * en parsant le paramètre query `e=` (timestamp UNIX ou durée relative).
 *
 * Format observé dans les URLs :
 *   ?t=<token>&s=<start>&e=<epoch_or_duration>&f=<file>&sp=<speed>&i=<ip>
 *
 * Quand `e` est un timestamp UNIX absolu (>= 1_000_000_000) on le compare
 * à l'heure actuelle. Sinon on déduit l'expiration de `s + e` (durée relative,
 * ex. Vidzy `s=<now>&e=14400` → 4 h). Sans `s` on ne peut pas déduire
 * l'expiration → on considère le lien valide (optimiste).
 *
 * Une marge (`marginSeconds`) permet de traiter un lien qui expire dans
 * quelques secondes comme déjà mort : le client mettrait plusieurs secondes
 * à consommer les octets restants.
 */

/** Marge par défaut : 60 s. */
export const DEFAULT_EXPIRY_MARGIN_SECONDS = 60;

/**
 * Expiration absolue (epoch ms) du lien signé, ou null quand elle est
 * indéterminable (pas de `e`, ou `e` relatif sans `s`).
 */
export function getSignedLinkExpiryMs(url: string | null | undefined): number | null {
  if (!url || url === '#') return null;
  try {
    const u = new URL(url);
    const eParam = u.searchParams.get('e');
    if (!eParam) return null;

    const expValue = parseInt(eParam, 10);
    if (isNaN(expValue)) return null;

    // Epoch UNIX absolu (secondes)
    if (expValue >= 1_000_000_000) return expValue * 1000;

    // Durée relative en secondes (ex: s=1787717907 & e=172800 -> expire à s + e)
    const sParam = u.searchParams.get('s');
    if (sParam) {
      const startEpoch = parseInt(sParam, 10);
      if (!isNaN(startEpoch)) return (startEpoch + expValue) * 1000;
    }
    return null;
  } catch {
    return null;
  }
}

/** Secondes restantes avant expiration, négatif si le lien est déjà mort. */
export function getSignedLinkTtlSeconds(url: string | null | undefined): number | null {
  const expiryMs = getSignedLinkExpiryMs(url);
  if (expiryMs === null) return null;
  return Math.floor((expiryMs - Date.now()) / 1000);
}

export function isSignedLinkExpired(
  url: string | null | undefined,
  marginSeconds: number = DEFAULT_EXPIRY_MARGIN_SECONDS,
): boolean {
  if (!url || url === '#') return false;
  const expiryMs = getSignedLinkExpiryMs(url);
  if (expiryMs === null) return false;

  const expired = Date.now() + marginSeconds * 1000 > expiryMs;
  if (expired) {
    console.warn(
      `[LinkTTL] Lien signé expiré (expire le ${new Date(expiryMs).toISOString()}, marge ${marginSeconds}s): ${url.slice(0, 80)}...`,
    );
  }
  return expired;
}

/**
 * Renvoie true quand l'URL contient une signature dont on peut mesurer
 * l'expiration (utile pour ne pas plafonner le TTL d'un cache sur un lien
 * dont on ignore la durée de vie).
 */
export function hasSignedLinkExpiry(url: string | null | undefined): boolean {
  return getSignedLinkExpiryMs(url) !== null;
}

/**
 * Retourne le timestamp d'expiration en millisecondes (pour affichage/logs),
 * ou null si non déterminable.
 */
export function getLinkExpiry(url: string): Date | null {
  const expiryMs = getSignedLinkExpiryMs(url);
  return expiryMs === null ? null : new Date(expiryMs);
}
