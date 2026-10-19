/**
 * Source unique de vérité de l'URL du backend CHILLERS.
 *
 * Ordre de résolution :
 *  1. `NEXT_PUBLIC_API_URL` (variable d'env Vercel / `.env.production` / `.env`)
 *  2. fallback prod vérifié — le dépôt Railway en vie : `636d` répond
 *     `GET /api/health` → 200 (les autres valeurs qui traînaient dans le code,
 *     `8e02` et `onrender`, ne répondent plus)
 *  3. localhost en développement
 *
 * Tous les points d'appel doivent importer ce module au lieu de redéclarer
 * l'URL : `services/http.ts`, `auth.ts`, `lib/server-api.ts`, les routes API
 * sous `app/api/*`, les pages `live/*` et les rewrites de `next.config.ts`.
 */

const DEV_API_URL = "http://localhost:4000/api";
const PROD_API_URL = "https://chillers-production-636d.up.railway.app/api";

/** URL de base du backend (avec le suffixe `/api`). */
export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production" ? PROD_API_URL : DEV_API_URL);

/** Ancien backend hébergé sur Render — second rideau de `serverApiFetch` uniquement. */
export const LEGACY_API_BASE_URL = "https://chillers.onrender.com/api";
