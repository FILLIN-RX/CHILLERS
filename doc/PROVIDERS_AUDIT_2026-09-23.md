# Audit des providers de films (todo.md) — 23/09/2026

Contexte : la todo-liste (`todo.md`) demande d'ajouter 6 providers de streaming gratuit.
Ce rapport récapitule le test de faisabilité réalisé : est-ce qu'on peut **récupérer le catalogue de films** (titres + liens de lecture) depuis chaque provider ?

## Résultat synthétique

| Provider | URL | Catalogue accessible | Liens de lecture | Complexité | Verdict |
|---|---|---|---|---|---|
| Free Movies Plus | freemoviesplus.com | ✅ Oui (API) | ⚠️ Partiel (auth) | Moyenne | 🔶 Faisable avec étape d'auth |
| Pluto TV | pluto.tv/intl | ❌ Non | ❌ | Élevée | ❌ Bloqué (API privée/GraphQL) |
| Plex | watch.plex.tv | ✅ Oui (HTML pré-rendu) | ❌ Compte requis | Moyenne | 🔶 Faisable pour index, pas pour lecture |
| Fawesome TV | fawesome.tv | ✅ Oui (API) | ✅ Direct MP4/HLS | Faible | ✅ **Meilleur candidat** |
| Xumo | play.xumo.com | ❌ Non | ❌ | Élevée | ❌ Geo-bloqué + API non publique |
| Philo | philo.com | ❌ Non | ❌ | Élevée | ❌ Service payant, pas de catalogue public |

---

## Détail par provider

### 1. Free Movies Plus (`https://www.freemoviesplus.com/`) — 🔶 FAISABLE

Site Angular (plateforme "Unreel"/OTT et l'API côté serveur est ouverte).

- **API détectée** : `https://ga-prod-api.powr.tv` (window.env de l'app)
- **Recherche catalogue** :
  ```
  GET /v2/sites/fmplus/videos-search?q=<query>&type=movie&page=1&limit=100
  ```
- **Résultat** : HTTP 200, JSON list. Contient `title`, `type`, `description`, posters, `channels`, `uid`. ~20 résultats/page, pagination via `page`.
- **Limitation** : les `streams` (dash/hls/mp4) sont vides dans la recherche — il faut une étape d'autorisation via le player Ooyala et l'endpoint `sas/player_api/v2/authorization/embed_code/...`. La lecture directe n'est donc pas triviale sans se connecter au flux du player.
- **Note** : `GET /v2/sites/fmplus/` renvoie « Requires Login ».

### 2. Pluto TV (`https://pluto.tv/intl/`) — ❌ BLOQUÉ

- L'ancienne API publique `api.pluto.tv/v2/channels` **renvoie un tableau vide** `[]` (endpoint déprécié / régionalisé).
- L'app web utilise des endpoints internes GraphQL `/api/tn/<service>/graphql/` qui renvoient 404 hors de l'app (token requis).
- Aucune route publique ne permet d'extraire le catalogue de VO1.

### 3. Plex (`https://watch.plex.tv/`) — 🔶 INDEX SEULEMENT

- La page d'accueil (2,7 Mo) contient le **catalogue pré-rendu en HTML** : titres, affiches (dont TMDB via `image.tmdb.org`), genres.
- Les liens de lecture (`/watch/video?uri=provider://tv.plex.provider.discover/...`) **nécessitent un compte Plex** (auth OAuth). Pas de lecture directe pour l'utilisateur final sans compte.
- **Utilisable pour** : extraire des titres/posters pour enrichir une base de suggestions — pas pour des liens de streaming directs.

### 4. Fawesome TV (`https://fawesome.tv/`) — ✅ FONCTIONNE

C'est le **meilleur candidat**. API JSON ouverte, sans DRM pour une bonne partie du catalogue.

- **Endpoint API** :
  ```
  https://fawesome.tv/home/new/v462/api/
  ```
  (version `v462` trouvée dans le HTML `iptv-main.js?ver=1232`)
- **Étape 1 — token de sécurité** (header requis) :
  ```
  GET /getSecurityToken.php?&appId=9&siteId=236&auth-token=1217575
  → envoyer le header "token: <securityToken>" sur les requêtes suivantes
  ```
- **Étape 2 — recherche par titre** :
  ```
  GET /recipes.php?searchType=search&keys=<titre>&platform_id=1217575&appId=9&siteId=236&auth-token=1217575
  ```
- **Étape 2 bis — catalogue/populaire** :
  ```
  GET /recipes.php?searchType=popular&appId=9&siteId=236&auth-token=1217575
  → status "ok", count: 1000, 20 résultats/page
  ```
- **Payload** très riche : `title`, `description`, `picture`/`main_picture`/`hero_image` (posters), `content_genre`, `item_type` (`movie`/`series`), `runtime`, `release_date`, `age_appropriate_rating`, et surtout :
  - `video_url` → **MP4 direct**
  - `video_hls_url` → **flux HLS (m3u8)**
  - `video_flv_url` → fallback MP4
- **Tests réalisés** : recherche « trapped » → 8 résultats films avec liens vidéo directs ; recherche « inception » → 1 résultat avec HLS fonctionnel. IMDb/titre non nécessaire puisque le champ `title` est exploitable.

**Intégration recommandée** : ajouter un scraper "fawesome" dans le moteur Go (`chillers-searcher/internal/scraper/providers/`) ou dans le backend Node, avec flux : recherche → résolution du token → mapping `video_hls_url` en lien de lecture.

### 5. Xumo (`https://play.xumo.com/`) — ❌ BLOQUÉ

- Le serveur (UK/datacenter) reçoit une **page `geo-block`** (blocage géographique).
- L'API pressentie `valencia-app-mds.xumo.com` (constante `ENV_XUMO_API_URL`) répond 404 sur toutes les routes tentées sans jeton ; la route de config `valencia-app.xumo.com/config` renvoie 403.
- Nécessite probablement un accès US + reverse-engineering du client ; non exploitable aujourd'hui.

### 6. Philo (`https://www.philo.com/`) — ❌ BLOQUÉ

- Service de TV **par abonnement** ($25/mois). La page publique est purement marketing (chaînes/logos, pas de catalogue).
- Aucune API publique de contenu ; tout le contenu est derrière le login utilisateur.
- Non exploitable sans compte payant.

---

## Conclusion & recommandation

1. **À intégrer en priorité** : **Fawesome TV** — API ouverte, recherche par titre, liens MP4/HLS directs, ~1000 titres, sans DRM. C'est le seul provider du todo « clé en main ».
2. **Utilisable pour l'index/suggestions uniquement** : **Plex** (titres + posters depuis le HTML pré-rendu) et **Free Movies Plus** (catalogue via API, mais lecture nécessite une étape d'auth player).
3. **Non exploitable** : **Pluto TV** (API devenue privée/GraphQL), **Xumo** (geo-blocage + API fermée), **Philo** (payant).

Prochaine étape suggérée : créer le scraper `fawesome` (Go + Node) en suivant le pattern des providers existants (`frenchstream.go`, `otaku.go`).