import { SITE_URL } from "./seo";

const INDEXNOW_KEY = "8xu4nvspm5j7l8rmhvdsghzlhdii0en4";

// Moteurs partenaires IndexNow
const INDEXNOW_ENDPOINTS = [
  "https://api.indexnow.org/indexnow",
  "https://www.bing.com/indexnow",
  "https://yandex.com/indexnow",
];

/**
 * Notifie les moteurs IndexNow d'un ensemble d'URLs.
 * À appeler côté serveur uniquement (Server Action, Route Handler, script Node).
 *
 * @example
 * // Après la publication d'un nouveau film
 * await notifyIndexNow([`${SITE_URL}/media/${movieId}`]);
 *
 * @example
 * // Depuis un script de déploiement ou un cron
 * await notifyIndexNow([SITE_URL, `${SITE_URL}/media/movies`, `${SITE_URL}/media/series`]);
 */
export async function notifyIndexNow(urls: string[]): Promise<void> {
  if (!urls.length) return;

  const host = new URL(SITE_URL).hostname;
  const payload = {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };

  await Promise.allSettled(
    INDEXNOW_ENDPOINTS.map((endpoint) =>
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      })
    )
  );
}

/**
 * Notifie IndexNow pour toutes les pages statiques principales.
 * Utile après un déploiement.
 */
export async function notifyIndexNowStaticPages(): Promise<void> {
  const staticPaths = [
    "",
    "/media/movies",
    "/media/series",
    "/media/anime",
    "/live",
    "/matches",
    "/categories",
    "/about",
    "/contact",
    "/support",
    "/privacy",
  ];
  await notifyIndexNow(staticPaths.map((p) => `${SITE_URL}${p}`));
}
