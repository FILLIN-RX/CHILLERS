# Rapport forensique — FrenchAnime / Black Clover

**Date** : investigation statique (lecture seule)
**Périmètre** : streaming + téléchargement, contenus anime (Black Clover, contenus W16)

---

## Résumé exécutif

FrenchAnime retourne **uniquement un `embedUrl`**, jamais de `directUrl`. L'enrichissement
(`resolveDirectFromEmbed`) est bien appelé sur ce résultat, mais il ne peut scraper que
Doodstream / Uqload / Vidzy. Si les liens W16 pointent vers un autre hébergeur (Vidmoly,
Voe, Sibnet, YouTube…), l'enrichissement échoue silencieusement et le lecteur tombe sur
l'iframe embed — **avec publicités**. Par ailleurs, le `downloadUrl` n'est **jamais défini**
par FrenchAnimeProvider : le bouton Télécharger sera inopérant à moins que l'enrichissement
n'ait produit un `directUrl` MP4. Enfin, la route `/api/download/resolve` ne transmet pas
`isAnime:true` au `StreamQuery`, ce qui ne bloque pas le provider mais introduit une
incohérence de routage.

---

## 1. Architecture FrenchAnime — bout en bout

### Source de données : catalogue W16

- Site source : `https://w16.french-manga.net`
- API épisodes : `GET /engine/ajax/manga_episodes_api.php?id=<newsId>`
  → Retourne un objet `{ vf: { "1": { host1: url1, … }, … }, vostfr: { … } }`
  → `fetchW16AnimePayload()` (w16-anime-source.ts) parse et normalise en `W16AnimePayload`.
- **Aucune pagination sur les épisodes** : l'API retourne l'intégralité des épisodes d'un
  `newsId` en une seule requête. Pas de problème de pagination pour Black Clover en soi.

### Catalogue MongoDB (ProviderCatalogItem)

- FrenchAnimeProvider lit des items avec `provider: 'otaku'` (pas `'frenchanime'`).
  Le catalogue W16 partage l'index Otaku dans `ProviderCatalogItem`.
  **Conséquence** : le champ `enum` du modèle accepte `['frenchstream', 'otaku', 'afroland', 'mongodb']`
  → `'frenchanime'` n'est **pas** dans l'enum. Cela ne pose pas de problème de lecture
  (`.find()` ne valide pas l'enum), mais c'est une incohérence de schéma.

### Résolution d'un épisode (chemin nominal)

```
1. ProviderManager.getEpisodeStream() [provider-manager.ts:290+]
2. sortProviders() : ordre anime = [mongodb, frenchanime, otaku, frenchstream, …]
3. FrenchAnimeProvider.getEpisodeStream()
   a. MongoDB : cherche ProviderCatalogItem{provider:'otaku', type:'anime', tmdbId}
   b. Si absent : fallback titre avec regex ^<titre>\b
   c. fetchW16AnimePayload(item.sourceId) → API W16
   d. Choisit VF ou VOSTFR selon query.language
   e. Retourne StreamResult { embedUrl: link.url, referer: origin(item.pageUrl)+'/' }
4. tryProvider() appelle enrichStreamResult() sur le résultat
   a. resolveDirectFromEmbed(embedUrl) → isScrapableUrl() → Doodstream | Uqload | Vidzy ?
   b. Si oui : scrape → directUrl + directType + referer
   c. Si non (Voe, Sibnet, YouTube…) → status:'unsupported' → embed conservé tel quel
   d. Si scrapable mais mort → status:'failed' → résultat marqué 'weak', chaîne continue
5. toCachedStream() : si directType==='mp4' && directUrl → downloadUrl = directUrl
                       sinon downloadUrl = undefined
```

---

## 2. Streaming — URL directe ou embed ?

### **BUG CRITIQUE (Sévérité : HAUTE)**

```typescript
// frenchanime.provider.ts — retour du provider
return {
  provider: this.name,
  embedUrl: link.url,     // ← TOUJOURS un embed (Vidzy/Voe/Uqload/etc.)
  type: 'episode',
  language: link.language,
  referer: `${new URL(item.pageUrl).origin}/`,  // referer = w16.french-manga.net
};
// directUrl : NON défini
// downloadUrl : NON défini
```

Le lecteur jouera **sans pubs uniquement si** l'enrichissement (`resolveDirectFromEmbed`)
parvient à extraire un `directUrl`. Cela dépend de l'hébergeur du lien W16 :

| Hébergeur W16 | Scrapable ? | Résultat pour le lecteur |
|---|---|---|
| Uqload | ✅ Oui | URL MP4/HLS directe, pas de pub |
| Vidzy | ✅ Oui | URL HLS/MP4 directe, pas de pub |
| Doodstream / Playmogo | ✅ Oui | URL MP4 directe, pas de pub |
| Voe / VOE | ❌ Non (`isScrapableUrl` = false) | iframe embed avec pubs |
| Sibnet | ❌ Non | iframe embed avec pubs |
| YouTube | ❌ Non | iframe embed avec pubs |
| Autres (Vidmoly, Mail.ru…) | ❌ Non | iframe embed avec pubs |

**Conclusion** : si les épisodes de Black Clover sur W16 sont hébergés chez Voe ou Sibnet
(hébergeurs courants sur les sites anime francophones), les publicités s'afficheront.

### Referer

Le referer retourné par FrenchAnimeProvider est `https://w16.french-manga.net/` (origin de
`item.pageUrl`). C'est correct pour accéder à la page W16, mais **ce n'est pas le referer
requis par le CDN** de l'hébergeur vidéo. Le `referer` CDN est surchargé par `resolveDirectFromEmbed`
dans `direct-enricher.ts` via `refererForDirectUrl()` si l'enrichissement réussit.

```typescript
// direct-enricher.ts:refererForDirectUrl()
if (/vidzy\./i.test(host)) return 'https://vidzy.cc/';
if (/uqload\./i.test(host)) return 'https://uqload.is/';
// … Voe, Doodstream, Streamtape
```

Si l'enrichissement échoue (Voe, Sibnet), le referer `w16.french-manga.net` est transmis
au lecteur, qui l'utilisera comme `xhrSetup` pour hls.js. Ce referer sera rejeté par les CDN
Voe/Sibnet → **le lecteur tombera probablement en erreur si ce referer est utilisé**.

---

## 3. Téléchargement — `downloadUrl` présent ?

### **BUG CRITIQUE (Sévérité : HAUTE)**

```typescript
// StreamResult de FrenchAnimeProvider : downloadUrl = NON DÉFINI
// toCachedStream() dans provider-manager.ts:
const isDirectMp4 = r?.directType === 'mp4' && r?.directUrl && !isEmbedOrHtml(r.directUrl);
return {
  downloadUrl: isDirectMp4 ? r.directUrl : (r?.downloadUrl && !isEmbedOrHtml(r.downloadUrl) ? r.downloadUrl : undefined),
};
```

Le `downloadUrl` final est :
- **Défini uniquement si** l'enrichissement a produit un `directUrl` de type `mp4`.
- **Absent** si l'hébergeur W16 est Voe/Sibnet (non scrapable) ou si le fichier est HLS.

Dans le VideoPlayer, `handleDirectDownload` utilise :
```typescript
const directDl = torrentDownloadUrl || streamQuery.data?.downloadUrl;
```
Si `downloadUrl` est `undefined`, `directDl` est `undefined` → le bouton déclenche la modal
de téléchargement secondaire (`setShowSingleDownload(true)`) au lieu de déclencher le
téléchargement direct.

### Route `/api/download/resolve` — gestion des animes

La route est appelée avec `type=anime` ou `type=series`. Elle construit le `StreamQuery` :
```typescript
// download.routes.ts:109
type: isTv ? 'tv' : 'movie',  // ← 'anime' est aplatit en 'tv', pas 'anime'
```

**BUG (Sévérité : MOYENNE)** : `type` vaut `'tv'` même pour `type=anime`. Cela empêche
`enrichQueryTitles()` dans provider-manager de poser `query.isAnime = true` via le chemin
`query.type === 'anime'` (ligne `if (query.type === 'anime') { query.isAnime = true; }`).

Cependant, `enrichQueryTitles` a un fallback : si TMDB classe la série en genre 16 (Animation)
ou si un `ProviderCatalogItem{provider:'otaku'}` existe pour ce `tmdbId`, `isAnime` sera
quand même mis à `true`. Pour Black Clover (clairement anime, genre 16 dans TMDB), ce fallback
devrait rattraper le problème. Mais c'est fragile.

La route inclut bien `'frenchanime'` dans la liste des providers iOS :
```typescript
{ only: ['frenchstream', 'afroland', 'frenchanime', 'otaku', 'fawesome'] }
```
→ FrenchAnime est bien ciblé lors du fallback iOS.

---

## 4. Black Clover — problèmes spécifiques

### Problème 1 : catalogue W16 lié à Otaku, pas directement à Black Clover

Le `FrenchAnimeProvider` cherche des `ProviderCatalogItem` avec `provider: 'otaku'` et
`tmdbId: query.tmdbId`. Si Black Clover n'a **pas** d'item catalogué avec son tmdbId TMDB
(TMDB ID: 65930), le provider cherche par titre :

```typescript
const searchTitle = (query.title || ...).replace(/\b(saison|season)\s*\d+/gi, '').trim();
// regex : ^Black Clover\b
```

Cette regex est correcte. Mais si le titre dans W16 est « Black Clover Saison 1 » ou 
« Black-Clover », la regex `^Black Clover\b` ne matchera pas.

### Problème 2 : épisodes > 100 (Black Clover en a 170)

```typescript
// frenchanime.provider.ts:51
const sourceEpisode = payload?.episodes?.[String(episode)]
  || payload?.episodes?.[String(episode).padStart(2, '0')];
```

L'épisode est cherché comme `"1"`, `"01"`, `"100"`, `"101"`, etc.
L'API W16 retourne les clés d'épisodes telles quelles depuis la source. Si W16 stocke
l'épisode 101 comme `"101"` : ça marchera. Si stocké comme `"101.0"` ou `"ep101"` :
ça échouera silencieusement. **Non vérifiable sans accéder à l'API W16 en live.**

### Problème 3 : `season` non stocké dans le ProviderCatalogItem W16

```typescript
const item = items.find((entry: any) => {
  const s = entry.season !== undefined
    ? Number(entry.season)
    : (entry.title?.match(/saison\s*(\d+)/i)?.[1]
      ? Number(entry.title.match(/saison\s*(\d+)/i)[1])
      : 1);
  return s === season;
});
```

Si le `ProviderCatalogItem` n'a pas de champ `season` ET que le `title` ne contient pas
`"saison N"`, la saison par défaut est 1. Black Clover ayant une seule saison sur TMDB mais
l'anime ayant été découpé en arcs, cela peut causer des confusions sur quelle série est
chargée.

---

## 5. Bugs classés par sévérité

### 🔴 HAUTE — `downloadUrl` jamais défini par FrenchAnimeProvider

**Fichier** : `backend/src/modules/streaming/providers/frenchanime.provider.ts`  
**Effet** : le bouton Télécharger ne fonctionne pas pour les animes FrenchAnime sauf si
l'enrichissement produit un `directUrl` MP4. Si l'hébergeur est Voe ou Sibnet, pas de téléchargement.

### 🔴 HAUTE — Enrichissement non fonctionnel pour hébergeurs non scrapables (Voe, Sibnet…)

**Fichier** : `backend/src/modules/streaming/providers/direct-scraper.ts:793`  
**Effet** : `isScrapableUrl` = `Doodstream | Uqload | Vidzy` seulement. Si W16 livre un
lien Voe → le lecteur charge l'iframe embed → publicités.

### 🟠 MOYENNE — `type: 'tv'` dans `/api/download/resolve` pour les animes

**Fichier** : `backend/src/modules/download/download.routes.ts:109`  
**Effet** : `query.isAnime` n'est pas directement mis à `true` depuis le type, mais le
fallback TMDB genre 16 rattrape généralement la situation. Risque sur les animes non
classifiés genre animation dans TMDB.

### 🟡 FAIBLE — Catalogue W16 stocké sous `provider: 'otaku'` dans ProviderCatalogItem

**Fichier** : `backend/src/modules/streaming/providers/frenchanime.provider.ts:21`  
**Effet** : confusion conceptuelle, le provider `'frenchanime'` n'est pas dans l'enum du
modèle. Les items W16 sont indiscernables des items Otaku classiques dans la base.

### 🟡 FAIBLE — Referer W16 transmis si enrichissement échoue

**Fichier** : `backend/src/modules/streaming/providers/frenchanime.provider.ts:71`  
**Effet** : si l'hébergeur est Voe/Sibnet, le referer `w16.french-manga.net` est transmis
au lecteur hls.js. Les CDN Voe attendent leur propre referer → risque d'erreur CORS ou 403.

---

## 6. Fixes recommandés

### Fix 1 — Ajouter `downloadUrl` dans FrenchAnimeProvider (prioritaire)

```typescript
// frenchanime.provider.ts — dans getEpisodeStream(), return statement
return {
  provider: this.name,
  embedUrl: link.url,
  type: 'episode',
  language: link.language,
  referer: `${new URL(item.pageUrl).origin}/`,
  // Marquer l'embedUrl comme downloadUrl : la route /resolve le scrape ensuite
  // via DirectScraper.resolve() pour extraire le MP4 direct.
  downloadUrl: link.url,
};
```

Cela permet à `toCachedStream()` de passer l'embedUrl à `/api/download/resolve`, qui
l'extrait déjà via les étapes A/B/C.

### Fix 2 — Corriger le type dans `/api/download/resolve`

```typescript
// download.routes.ts:109 — au lieu de :
type: isTv ? 'tv' : 'movie',
// Utiliser :
type: type === 'anime' ? 'anime' : (isTv ? 'tv' : 'movie'),
```

Cela garantit que `enrichQueryTitles` pose `query.isAnime = true` immédiatement.

### Fix 3 — Étendre `isScrapableUrl` aux hébergeurs anime courants

Selon les hébergeurs réellement utilisés par W16 (à vérifier en live), ajouter dans
`direct-scraper.ts` le support de Voe ou d'autres hébergeurs W16. Actuellement seuls
Doodstream, Uqload et Vidzy sont scrapables.

### Fix 4 — Indexer les items W16 sous `provider: 'frenchanime'`

Lors du scraping du catalogue W16, enregistrer les `ProviderCatalogItem` avec
`provider: 'frenchanime'` au lieu de `'otaku'`, et ajouter `'frenchanime'` à l'enum du
modèle. Cela clarifie la séparation et évite de polluer l'index Otaku.

```typescript
// frenchanime.provider.ts — dans la requête ProviderCatalogItem.find()
provider: 'frenchanime', // au lieu de 'otaku'
```

Implique aussi de migrer les items W16 existants en base (ou de faire le find sur les deux).

---

## 7. Flux nominal vs flux réel (résumé)

```
Utilisateur → Black Clover S1E5

Backend:
  FrenchAnimeProvider.getEpisodeStream()
    → ProviderCatalogItem{provider:'otaku', tmdbId:65930} trouvé
    → fetchW16AnimePayload(newsId) → liens épisode 5
    → link VF retourné, hôte = Voe
    → StreamResult { embedUrl: 'https://voe.sx/e/xxx', downloadUrl: ABSENT }

  enrichStreamResult(embedUrl)
    → isScrapableUrl('voe.sx/...') = FALSE
    → outcome = { status: 'unsupported' }  ← embed conservé tel quel
    → weak = false (car non-vidlink, considéré comme success)

  toCachedStream()
    → directUrl = undefined
    → downloadUrl = undefined

Frontend VideoPlayer:
  resolvedStreamUrl = embedUrl (Voe iframe) → chargé en <iframe>
  → publicités diffusées par l'iframe Voe

  handleDirectDownload()
    → directDl = undefined
    → setShowSingleDownload(true)  ← modal secondaire, pas de téléchargement direct
```
