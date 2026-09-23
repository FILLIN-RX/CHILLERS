# CHILLERS — Analyse produit / UX / architecture

**Date** : 2026-09-22 · **Branche** : `main` @ `3d02829` · **Périmètre** : dépôt complet (`src/`, `backend/`, `mobile/`, `scrapper/`, `chillers-searcher/`)
**Skills utilisés** : `architecture-visualization:explore` → `system-modeler` + `flow-visualizer` (+ `c4model`, `graphviz`) · `ui-ux-pro-max:design-system` + `ui-ux-pro-max` · `product-management:产品脑暴` (Brainstorm) + `需求优先级排序` (RICE)

> Les affirmations portent un `chemin:ligne`. Confiance : **haute** = code lu, **moyenne** = signaux concordants, **basse** = inféré du nommage.

---

## 1. Ce qu'est CHILLERS (définition produit)

Plateforme de streaming OTT **multi-tenant-lite, mobile-first, PWA**, destinée à un public **francophone ouest-africain et sa diaspora** : catalogue films/séries/anime agrégé depuis des hosts tiers, TV en direct + scores football en direct, téléchargement hors-ligne côté client, monétisée par **AdSense + abonnements Mobile Money validés à la main par un admin**.

| Capacité | Statut | Preuve |
| --- | --- | --- |
| Catalogue, recherche, fiches média, saisons/épisodes | Implémenté | `src/app/(main)/page.tsx`, `media/[slug]/page.tsx`, `tv/[id]/` |
| TV en direct + matchs liveball | Implémenté | `src/app/live/`, `live/[slug]/`, `live/lb/[matchId]/` |
| Téléchargement hors-ligne (IndexedDB + SW) | Implémenté | `src/services/offlineStorage.ts:25-27`, `public/sw.js:4-24` |
| Continue-watching | **localStorage seulement** | `src/services/progress.ts:1-10` |
| Auth NextAuth v5 + Google | **Décoratif** (voir §3.1) | `src/auth.ts:9`, un seul appel `auth()` dans `layout.tsx:142` |
| Abonnement premium payant | **Enregistré mais non appliqué** | voir §3.1 |
| Console admin (22 pages antd) | Implémenté | `src/app/admin/**` |
| i18n | 2 langues (en, fr) | `src/i18n/translations/` |
| Mobile natif | Flutter, **non déployé** (CI = Windows) | `mobile/pubspec.yaml:1`, `.github/workflows/build-windows.yml:12-46` |

**Monétisation réelle** : `src/app/(main)/subscribe/page.tsx:33,120-164` — l'utilisateur choisit Orange Money ou MTN MoMo, compose un **code USSD généré côté client**, télécharge une **capture d'écran** de virement, un admin la review (`backend/src/modules/admin/subscription.controller.ts:165-199`) et active l'abonnement. Aucun PSP, aucun webhook, aucun renouvellement automatique, aucun remboursement.

---

## 2. Architecture (system-modeler + c4model)

Cartographie complète dans [`chillers-containers.dsl`](./chillers-containers.dsl).

**6 unités exécutables, dont 3 sans foyer de déploiement déclaré :**

| Unité | Stack | Déploiement |
| --- | --- | --- |
| Web Next.js 16 / React 19 | Tailwind v4 public + antd v6 admin | Vercel (`.vercel/project.json:2-8`) |
| Core API Express 5 + Mongoose | MongoDB, 20+ mounts | Render free (`render.yaml:1-16`) |
| `scrapper` Node + Playwright | port 4001, cron | VPS via systemd/PM2 — **hors CI** |
| `chillers-searcher` Go 1.25 | port 8090 | **absent de `render.yaml`** → orphelin |
| `mobile` Flutter | media_kit + dio | CI **Windows desktop uniquement** |
| `server.py` | yt-dlp | **jamais déployé** (prototype) |

Trois choses structurellement notables :

1. **La résolution de flux est triplicitée.** `src/lib/providers.ts:18-42` (classifieur d'URL client), `backend/src/streaming/providers/provider.interface.ts:24-29` (10 implémentations, **8 seulement enregistrées** — `animekai` et `streamtape` sont morts, `provider-manager.ts:46-57`), et `src/lib/providers/afroland.ts:36-198` qui n'implémente **aucune** des deux interfaces. `AfrolandProvider` — le travail des 2 derniers commits — est donc un 3e chemin parallèle. Ajouter un provider = éditer 3 endroits.
2. **Le scraping est dupliqué sur 4 sites** : backend request-time, route Next.js (`afroland.ts:58,106`), `scrapper/src/scraping/`, `chillers-searcher/internal/scraper/providers/`. `backend/src/scraping/core/` et `scrapper/src/scraping/` contiennent **les mêmes noms de fichiers** — deux arbres de code qui font le même métier.
3. **La résolution d'URL backend est tri-polaire** : `/api` relatif côté navigateur (`http.ts:10,61-63`), `NEXT_PUBLIC_API_URL` absolu côté serveur (`http.ts:27,57`) avec un second fallback en dur (`server-api.ts:36-47`). Une variable préfixée `NEXT_PUBLIC_` pilote du routage serveur.

**Hygiène** : `@mantine/core` + `@mantine/hooks` = **0 import** dans `src/` mais toujours dans `package.json:19-20` *et* dans `optimizePackageImports` (`next.config.ts:9-10`) ; `video.js` = **0 import** (`package.json:31`). `sw.js` à la racine est un service-worker de pub tierce (`importScripts('https://3nbf4.com/...')`, `zoneId: 11863313`) — domaine adware connu, versionné dans git. Logs et `.bak` de 540 Ko et base JSON pseudo-persistée dans `backend/src/scraping/core/`. Playwright pointe vers `./tests` **qui n'existe pas** (`playwright.config.ts:3`) → `npm run test:e2e` collecte 0 spec.

---

## 3. Le constat central

### 3.1 Le paywall n'existe pas côté serveur (confiance haute)

Chronologie complète dans [`chillers-playback-flow.dot`](./chillers-playback-flow.dot).

- `backend/src/streaming/streaming.routes.ts:7-8` — les routes de stream sont montées **sans aucun middleware d'auth**.
- `backend/src/streaming/streaming.controller.ts:15` — `isRequestPremium()` renvoie `true` si l'en-tête `x-is-premium: true` **ou** la query `?is_premium=true` est présente, **avant** toute vérification de JWT. Ce booléen pilote ensuite l'ordre des providers (`provider-manager.ts:309-333`, 1080p FrenchStream en premier) et la qualité retournée.
- `backend/src/middleware/premium-feature-gate.middleware.ts:32-74` — un gate fail-closed, correctement écrit, **importé nulle part** dans `backend/src`. Code mort.
- `backend/src/modules/download/download.routes.ts:250-275` — `GET /download/premium?title=` fait `res.redirect(movie.streamUrl)` sans auth. Le « premium 1080p » est entièrement ouvert.
- Côté client, les gardes lisent le plan depuis localStorage : `useDownload.ts:258` et `useDownloadsBatch.ts:188` testent `user.subscription.plan`, valeur **éditable par le navigateur** (`useAuthStore.ts:32-37,71`).

**Conséquence** : un `curl -H 'x-is-premium: true'` suffit. Le produit vend aujourd'hui une expérience dont la rareté n'est pas garantie. Cela ne se corrige pas en blindant l'UI.

### 3.2 Surface SSRF / secrets (confiance haute)

- `src/app/api/live/proxy/route.ts:10-40` — fetch de n'importe quel `?url=` sans allowlist ni blocage d'IP privée, relai du corps avec `Access-Control-Allow-Origin: *` (`:96-104`), réécriture récursive des lignes M3U8 qui transforme une requête en chaîne de fetch non bornée (`:60-81`).
- `backend/src/modules/download/download.routes.ts:212-256` — `?m3u8=` passé à `axios` sans allowlist, `filename` interpolé brut dans `Content-Disposition` (`:220`), et `spawn('ffmpeg -i <URL utilisateur>')` (`:223-233`).
- `backend/.../app.ts:135-138` — `POST /api/clear-cache` non authentifié. `:176-178` — `/api/requests` monté **trois fois**, dont `/api/internal/requests` : la porte d'écriture du service Go est exposée à Internet (`requests.controller.ts:70-98` écrit des champs arbitraires dans le doc).
- **Trois secrets JWT par défaut différents** pour des services qui doivent s'interroger (`auth.middleware.ts:4`, `admin.middleware.ts:5`, `scrapper/src/middleware/auth.ts:4`), un token tiers réel en dur (`src/lib/providers/afroland.ts:32`), un secret anti-bot embarqué dans le bundle client (`src/lib/antibot.ts:6`, MD5 de timestamp inversé — le middleware backend `:4` attend la même valeur), `admin`/`admin` par défaut au seed (`backend/src/server.ts:32-33`).
- `backend/src/middleware/csrf.middleware.ts:82-86` — `next()` pour **toute** requête portant un `Bearer`, c'est-à-dire exactement le style d'auth du frontend (`http.ts:104-108`). Le CSRF est désactivé par le mécanisme qui l'active.

### 3.3 Aucune couverture sur les chemins critiques

1 seul test frontend (`src/app/api.test.ts`, 2 assertions sur un constructeur d'URL). Les 3 tests backend ciblent **exclusivement** le service d'abonnement dont le middleware n'est pas câblé. Aucun workflow ne build ni ne teste le frontend Vercel. Zéro test sur l'auth, la résolution de providers, les 7 routes API, le pipeline de téléchargement.

---

## 4. UX et design system (ui-ux-pro-max:design-system)

### 4.1 Une vraie base, mais deux roses concurrents

`src/app/globals.css` est **meilleur que la moyenne** : tokens `@theme` (`:3-22`), variables runtime dark/light (`:24-56`), utilitaires glassmorphism (`:104-156`), squelettes shimmer GPU (`:170-200`), safe-area iOS (`:287-307`), neutralisation du sticky-hover tactile (`:320-324`), `focus-visible` cohérent (`:330-340`), `prefers-reduced-motion` **respecté** (`:350-359`), et un kill-switch `backdrop-filter` sous 768px pour les iPhones anciens (`:363-383`) — le commentaire `:361` explique le pourquoi, ce qui est exactement ce qu'il faut.

Les défauts sont des défauts de **discipline d'adoption**, pas de conception :

| Problème | Preuve | Impact |
| --- | --- | --- |
| **Deux couleurs de marque** : token `--color-brand-primary: #F42A7C` (`globals.css:4`) vs `#D70466` en dur **199 fois**, dont dans le composant `Button` de base (`ui/Button.tsx`, `variantStyles.primary`) | `grep` : 161 refs `brand-primary`, 199 refs `#D70466`, 10 refs `#F42A7C` | Le rose officiel n'est jamais celui affiché |
| **683 littéraux hex dans 73 fichiers `.tsx`** + 871 utilitaires `bg-zinc-*`/`from-[#…]` | idem | Pas de thème, pas de refonte possible sans chasse manuelle |
| **Thème clair mort** | `.light` défini `globals.css:41-56` ; **zéro** endroit dans `src/` ne l'applique | 16 lignes de tokens inutilisées, dette déclarative |
| **Taille de rayon "strictement 2-3px"** (`globals.css:6-16`) non appliquée par la couche UI | `error.tsx:14` `rounded-2xl`, `MovieCard`/`ProfileClient` `rounded-3xl`, antd `Table`/`Card`/`Modal` hors système | La règle de marque est décorative |
| **Deux systèmes de composants sans tokens partagés** | antd isolé à 100 % dans `src/app/admin/**` (25 imports, 0 ailleurs), `ConfigProvider theme={adminTheme}` seulement (`admin/layout.tsx:170,197`) | L'admin ne ressemble pas au produit |
| **Shims d'import dupliqués** | `components/Button.tsx` et `CardImage.tsx` ne font que `export * from "./ui/…"` | Deux chemins d'import pour un même composant |

**Points positifs à protéger** : la séparation antd/admin est propre et le Tailwind public est cohérent ; 6 modales distinctes mais toutes passent par `hooks/useModalShell.ts` ; 4 squelettes + `error.tsx` + `RouteError` + `not-found` + `NetworkStatusBanner` + `useOnlineStatus` → la gestion des états d'attente/erreur/hors-ligne est **au-dessus du standard** pour un side-project ; 280 `<button>` contre 1 seul `<div onClick>` et 120 attributs `aria-` — l'accessibilité clavier/lecteur d'écran est réellement travaillée ; `next/image` (26) et `<img>` brut (24) sont à égalité, ce qui est le vrai point de vigilance perf sur des pages poster-heavy.

### 4.2 Détecteurs de dette structurelle

`client-page.tsx` **1492 lignes**, `VideoPlayer.tsx` **1406**, `media.ts` **1347**, `ProfileClient.tsx` **1327**, `watch-content.tsx` **1049**, `LivePlayer.tsx` **824**, `MovieCard.tsx` **646**. 76 fichiers en `"use client"` — le composant serveur a disparu au profit d'une SPA React sur Next.

---

## 5. Priorisation (product-management:需求优先级排序 — RICE)

Effort en semaines-développeur. Score = R × I × C / E.

| # | Action | Reach | Impact | Confidence | Effort | Score | Pourquoi maintenant |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **P1** | Câbler `premiumFeatureGate` sur `/api/stream/*` et `/api/download/*`, supprimer la lecture de `x-is-premium` (`streaming.controller.ts:15`) | 100 % revenus | 3 | 90 % | 0,5 | **18,0** | Le seul item qui conditionne l'existence du modèle économique |
| **P2** | Allowlist d'hôtes sur `live/proxy`, `/download/file`, `/download/stream` ; retirer le `spawn` piloté par l'URL ; auth sur `/api/clear-cache` et `/api/internal/requests` | 100 % dispo | 3 | 85 % | 1,0 | **7,7** | SSRF + exécution de processus = arrêt de service ou saisie |
| **P3** | Sortir les 3 secrets JWT par défaut, le token Afroland (`afroland.ts:32`) et le secret anti-bot client ; tourner `admin`/`admin` | 100 | 2 | 95 % | 0,5 | **3,8** | Déjà dans git → rotation obligatoire, pas seulement retrait du code |
| **P4** | Un seul token `--color-brand-primary` et bannir les hex des composants (lint `no-restricted-syntax`) | 100 % UI | 2 | 80 % | 1,0 | **1,6** | 683 occurrences : à geler avant d'écrire du nouveau code |
| **P5** | Fusionner les 3 couches « provider » derrière la seule interface `StreamingProvider` ; registrer ou supprimer `animekai`/`streamtape` ; décider du sort d'`AfrolandProvider` | 100 % contenu | 2 | 70 % | 2,0 | **0,7** | Coût croissant : chaque nouveau provider (`todo.md:3-8`) ajoute 3 modifications |
| **P6** | Réactiver les tests : Playwright sur `backend/e2e/`, CI qui build le frontend, 1 test d'entitlement (le forfait gratuit ne doit PAS obtenir 1080p) | 100 % vélocité | 2 | 75 % | 1,5 | **1,0** | Sans P1 testé, P1 régressera au commit suivant |
| **P7** | Passer continue-watching sur `PUT /user/progress` (**déjà écrit** : `backend/src/modules/user/user.routes.ts:11`) et supprimer le commentaire obsolète de `progress.ts:3-5` | 40 % engagés | 2 | 85 % | 1,0 | **0,7** | Le sync multi-appareils est le pré-requis de la valeur « mobile » |
| **P8** | Automatisation de l'abonnement : webhook PSP (Paystack/Flutterwave) au lieu de la capture d'écran + review manuelle | 100 % revenus | 3 | 60 % | 3,0 | **0,6** | Goulet actuel : l'admin est le facteur de conversion |
| **P9** | Nettoyer la dette de dépôt : `@mantine/*` + `video.js` hors de `package.json` et `next.config.ts:9-10`, `sw.js` racine, logs et `.json.bak` versionnés, `chillers-test/` | 0 % user | 1 | 95 % | 0,5 | **0,1** | Faible valeur directe, mais chaque objet ambigu est un piège pour un nouvel entrant |
| **P10** | Décider du sort de `mobile/` (Flutter) et `chillers-searcher/` (Go) : déployer ou archiver | 0 | 1 | 50 % | 2,0 | **0,0** | Deux bases maintenues sans chemin de mise en production |

**Séquence recommandée** : P1 → P6 (un test d'entitlement qui prouve P1) → P2 → P3, puis seulement le design system (P4) et la consolidation providers (P5). P1+P6 font 1,5 semaine et débloquent tout le reste.

---

## 6. Inconnus assumés

- **Droits de distribution** : l'agrégation provient de hosts tiers (`upstream`). Aucune donnée du dépôt ne précise la posture légale. C'est le risque non-technique n°1 et il bloque P8 (aucun PSP n'accepte un catalogue non licencié).
- **Charge réelle** : aucune métrique runtime dans le dépôt. Le free tier Render (`render.yaml:9`) est un point d'étranglement inconnu pour du streaming.
- **Qualité du catalogue** : `backend/src/scraping/core/*.json.bak` (21 backups) suggère un pipeline fragile, non mesuré.
- **Le `.env*` est bien gitignoré** (`.gitignore:23`, vérifié par `git ls-files`) — le problème est dans le code versionné, pas dans la config.

## 7. Verdict

Le frontend est **nettement plus mature que son backend** sur le plan UX : gestion d'états, PWA, safe-area, `prefers-reduced-motion`, accessibilité clavier sont réellement traités, et la dette visuelle est une dette d'adoption de tokens (résolvable en une sprint de lint + codemod), pas une erreur de conception.

Le problème est ailleurs et il est simple à énoncer : **l'abstraction « provider » est triplicitée et l'abonnement premium n'est pas appliqué côté serveur.** P1 et P5 sont les deux items dont dépendent tous les autres. Le reste — Mantine mort, Go orphelin, Playwright qui ne collecte rien, deux roses concurrents — est du bruit qui trompe un nouvel entrant, pas du risque produit.
