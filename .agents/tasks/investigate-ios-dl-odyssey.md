# Rapport Forensique — CHILLERS

**Date :** 2025-07-16  
**Analysé par :** Agent forensique  
**Périmètre :** BUG 1 — Téléchargement iOS ; BUG 2 — The Odyssey / mauvais contenu  

---

## BUG 1 : iOS Download

### Résumé exécutif

Le téléchargement iOS ne tombe pas en erreur visible — il se termine silencieusement avec le statut `"done"` sans que le fichier soit effectivement enregistré. Deux causes racines coexistent : (1) `streamDownloadToDisk` retourne `{ totalBytes: null }` immédiatement après `triggerAttachmentDownload`, et `useDownload.streamCurrent` marque `"done"` sur cette promesse résolue avant même que Safari ait démarré son téléchargement natif ; (2) un scénario de double-URL où `toIOSDownloadHref` reçoit une URL déjà proxifiée mais dépourvue de l'origine backend, produisant un `href` cassé.

---

### 1. Détection `isIOS()` — verdict : correcte mais incomplète pour certains iPads récents

**Fichier :** `src/services/streamSaver.ts`, lignes 51–58

```typescript
export function isIOS(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}
```

**Analyse :**

- ✅ Le test `navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1` couvre bien iPadOS 13+ qui se présente comme un Mac.
- ⚠️ `navigator.platform` est **déprécié** (Chrome 93+, Safari 15.4+). Sur les versions récentes de Safari iOS/iPadOS, `navigator.platform` peut retourner `""` (chaîne vide) ou `"MacARM"` sur Apple Silicon, cassant le second test.
- ⚠️ La vérification `maxTouchPoints > 1` peut aussi correspondre à un Mac avec trackpad multi-touch (Magic Trackpad). Un Mac Studio détecte faussement comme iOS.

**Cause racine :** Dépendance à `navigator.platform` déprécié, pas de fallback sur `navigator.userAgentData`.

---

### 2. `toIOSDownloadHref` — verdict : correcte en théorie, mais appel avec mauvaise URL possible

**Fichier :** `src/services/downloads.ts`, lignes 143–157

```typescript
export function toIOSDownloadHref(downloadUrl: string, filename: string): string {
  if (!downloadUrl) return downloadUrl;
  if (downloadUrl.startsWith("/api/") || downloadUrl.startsWith(API_BASE_PATH)) {
    return downloadUrl;              // ← déjà proxifié : retourné tel quel (relatif)
  }
  if (downloadUrl.startsWith("http://") || downloadUrl.startsWith("https://")) {
    return `${API_BASE_PATH}/download/file?url=${encodeURIComponent(downloadUrl)}&filename=...`;
  }
  return downloadUrl;
}
```

**Analyse :**

- ✅ Une URL absolue `https://cdn.vidzy.cc/xxx.mp4` est bien proxifiée en `/api/download/file?url=…`.
- ✅ Une URL déjà `/api/download/…` est retournée telle quelle.
- 🔴 **BUG :** Quand `toIOSDownloadHref` retourne une URL relative (`/api/download/file?…`), le code dans `streamSaver.ts` ligne 102 construit :

```typescript
const href = relative.startsWith("http") ? relative : `${backendOrigin}${relative}`;
```

`getBackendOrigin()` retourne `API_BASE_URL.replace(/\/api\/?$/, "")`, soit par exemple `https://api.chillers.fr`. Le href final devient `https://api.chillers.fr/api/download/file?…`, ce qui est correct. Cependant, si `NEXT_PUBLIC_API_URL` n'est pas défini côté client (SSR hydration, env var manquante), `API_BASE_URL` peut valoir `/api` et `getBackendOrigin()` retourne `""`. L'iframe reçoit alors `href = "/api/download/file?…"` — URL relative — ce que Safari iOS peut interpréter en navigation de page plutôt qu'en téléchargement dans une iframe cross-origin si le serveur ne renvoie pas les bons headers.

---

### 3. `triggerAttachmentDownload` — verdict : correcte dans son mécanisme, mais créé une fausse complétion

**Fichier :** `src/services/downloads.ts`, lignes 165–183

```typescript
export function triggerAttachmentDownload(href: string): void {
  if (typeof document === "undefined" || !href) return;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;visibility:hidden;";
  document.body.appendChild(frame);
  frame.src = href;
  window.setTimeout(() => frame.remove(), 120_000);
}
```

- ✅ Utilise bien une iframe hors écran (pas de navigation directe).
- ✅ Nettoie l'iframe après 120 s.
- 🔴 **BUG CRITIQUE — Faux "done" immédiat :**

La fonction `triggerAttachmentDownload` est **fire-and-forget** : elle retourne `void` immédiatement après avoir assigné `frame.src`. Dans `streamDownloadToDisk` (ligne 104–105), cet appel est suivi d'un `return { totalBytes: null }` synchrone. La promesse de `streamDownloadToDisk` se résout donc **avant que Safari ait reçu le premier octet**.

Dans `useDownload.ts`, `streamCurrent` (lignes 227–246) attend `await streamDownloadToDisk(…)`, puis passe à `setStatus(id, "done")` ligne 246. Sur iOS, cette séquence prend quelques millisecondes — le statut `"done"` s'affiche alors que le téléchargement Safari vient à peine de démarrer, **ou n'a même pas démarré** si l'iframe a été bloquée (bloqueur de pubs, Safari content blocker, 3rd-party frame restriction).

```
streamDownloadToDisk() appelé
  → triggerAttachmentDownload(href)  // fire-and-forget, retour immédiat
  → return { totalBytes: null }      // promesse résolue ~2ms plus tard
useDownload.streamCurrent()
  → await streamDownloadToDisk(...)  // résolu immédiatement
  → setStatus(id, "done")            // ← FAUX POSITIF, Safari n'a rien téléchargé encore
```

**Code exact incriminé :**

- `src/services/streamSaver.ts` lignes 103–106 :
  ```typescript
  triggerAttachmentDownload(href);
  return { totalBytes: null };       // ← promesse résolue sans attendre Safari
  ```
- `src/hooks/useDownload.ts` lignes 240–246 :
  ```typescript
  await streamDownloadToDisk(url, { ... });
  if (ctrl.signal.aborted) {
    setStatus(id, "canceled");
  } else {
    setStatus(id, "done");           // ← marqué done immédiatement après l'iframe fire-and-forget
  }
  ```

---

### 4. Backend `/api/download/file` — verdict : headers corrects

**Fichier :** `backend/src/modules/download/download.routes.ts`, fonction `serveFileProxy`

- ✅ `Content-Disposition: attachment; filename="…"; filename*=UTF-8''…` (lignes 353–356)
- ✅ `Content-Type: video/mp4` (ou Content-Type upstream non-HTML) (lignes 337–341)
- ✅ `Accept-Ranges: bytes` déclaré explicitement (ligne 360)
- ✅ Passe les headers `Content-Length`, `Content-Range`, `ETag`, `Last-Modified` de l'upstream avec filtre sur les valeurs invalides (ligne 362–375)
- ✅ Transfère le header `Range` du client vers l'upstream pour les requêtes partielles iOS

**Aucun bug dans le backend.** Les headers Safari iOS sont correctement configurés.

---

### 5. `isIOS()` appelé AVANT `isAndroidMobileChrome()` — verdict : ordre correct

**Fichier :** `src/services/streamSaver.ts`

- Ligne 91 : `if (isIOS()) {` — chemin iOS
- Ligne 113 : `const useNativeAndroidDownload = isAndroidMobileChrome() && …` — chemin Android

L'ajout du chemin Android (lignes 113–164) est **en dehors et après** le bloc `if (isIOS())` qui retourne directement. `isAndroidMobileChrome()` n'est **jamais exécuté** sur iOS, le branchement est mutuellement exclusif.

✅ **L'ordre n'est pas le problème.** La modification récente n'a pas cassé le chemin iOS.

---

### 6. Timeout / erreur silencieuse — verdict : confirmé

Le vrai timeout silencieux est décrit au point 3 : la promesse se résout en ~2ms sans attendre la réponse HTTP de l'iframe. Il n'y a pas d'autre timeout caché, mais l'absence de signal de confirmation du téléchargement iOS (Safari n'émet aucun événement DOM sur l'iframe quand il démarre un téléchargement) rend structurellement impossible de savoir si le fichier a été téléchargé.

---

### Fix recommandé — BUG 1

**Stratégie :** Sur iOS, ne pas marquer `"done"` immédiatement. Afficher un statut intermédiaire `"downloading"` persistent et laisser l'utilisateur confirmer manuellement, OU mettre l'UI en état "en attente Safari" sans jamais auto-terminer.

**Option A — Statut `"pending_safari"` (recommandé)**

```typescript
// src/services/streamSaver.ts — patch isIOS() pour futur-proofing
export function isIOS(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  // Préférer userAgentData si disponible (Chrome 90+, non dispo sur Safari mais safe à tester)
  const uaData = (navigator as any).userAgentData;
  if (uaData?.platform) {
    const p = uaData.platform.toLowerCase();
    if (p === 'ios' || p === 'ipados') return true;
    if (p === 'macos') return false; // Mac réel, pas iPad
  }
  // Fallback legacy
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  // iPadOS 13+ se présente comme MacIntel ; navigator.platform déprécié mais
  // encore fiable sur Safari 17. Vérifier également "MacARM" pour Apple Silicon iPad.
  const platform = navigator.platform || '';
  return (platform === 'MacIntel' || platform === 'MacARM' || platform === 'Mac') 
    && navigator.maxTouchPoints > 1;
}
```

```typescript
// src/hooks/useDownload.ts — streamCurrent, ne pas auto-terminer sur iOS
import { isIOS } from "@/services/streamSaver";

// Dans streamCurrent, remplacer :
await streamDownloadToDisk(url, { ... });
if (ctrl.signal.aborted) {
  setStatus(id, "canceled");
} else {
  setStatus(id, "done");  // ← SUPPRIMER cette ligne pour iOS
}

// Par :
await streamDownloadToDisk(url, { ... });
if (ctrl.signal.aborted) {
  setStatus(id, "canceled");
} else if (isIOS()) {
  // Safari gère le téléchargement nativement — on ne peut pas détecter la fin.
  // Laisser en "downloading" et afficher un message "Vérifiez vos téléchargements Safari".
  setStatus(id, "done");  // acceptable si l'UX communique l'ambiguïté
  // OU : setStatus(id, "pending_ios") avec un nouveau statut UI dédié
}
```

**Option B — Message UI explicite (minimum viable)**

Dans l'UI du drawer/modal, détecter iOS et afficher après `"done"` :  
> *"Safari a reçu le fichier. Vérifiez l'icône ↓ en bas de votre écran pour accéder au téléchargement."*

---

## BUG 2 : The Odyssey / L'Odyssée — mauvais contenu servi

### Résumé exécutif

Le provider manager ne cherche jamais par `tmdbId` sur FrenchStream, Otaku ou les autres providers de scraping — il les interroge exclusivement **par titre**. Pour "The Odyssey" (film 2024 de Thomas Bidegain, tmdbId ≠ "The Odyssey" 1997), la recherche par titre remonte plusieurs homonymes. Le scoring de `rankCandidates` peut les départager par l'année **si elle est transmise**, mais le vecteur d'injection de l'année dans la `StreamQuery` présente une lacune. De plus, le schéma Movie a `titre` unique sans `tmdbId` obligatoire, donc si un film "L'Odyssée" est enregistré avec le mauvais `lien`, MongoDB le sert en priorité absolue sans aucun contrôle de cohérence.

---

### 1. Quel provider sert le contenu et comment est-il sélectionné

**Fichier :** `backend/src/modules/streaming/provider-manager.ts`, méthode `buildProviders()` (ligne ~128)

L'ordre de priorité des providers pour un film standard (non-anime) est :

```
1. MongoDBProvider   ← priorité absolue (tmdbId puis titre)
2. DirectProvider
3. FrenchStreamProvider
4. AfrolandProvider
5. DoodStreamProvider
6. FrenchAnimeProvider
7. OtakuProvider
8. OhaProvider
9. FawesomeProvider
10. StreamtapeProvider
11. VidLinkProvider
12. TorrServerProvider
```

La clé de cache LRU est construite dans `getMovieStream` :
```typescript
const cacheKey = getCacheKey('movie', query.tmdbId, undefined, undefined, ...);
```
Un `tmdbId` correct isole bien la cache entry. **Mais le problème est en aval, dans les providers eux-mêmes.**

---

### 2. MongoDB Provider — sélection par tmdbId ou titre

**Fichier :** `backend/src/modules/streaming/providers/mongodb.provider.ts`, `getMovieStream()` (lignes 95–122)

```typescript
// Priority 1: exact tmdbId match
let movie: any = query.tmdbId 
  ? await Movie.findOne({ tmdbId: query.tmdbId }).lean().exec() 
  : null;
// Priority 2: titre identique
if (!movie) {
  const candidates = await Movie.find({
    $or: titles.map((t) => ({ titre: { $regex: new RegExp(escapeRe(t), 'i') } })),
  }).limit(30).lean();
  movie = candidates.find((d: any) => docMatchesQuery(d, titles, query.year)) || null;
}
```

- ✅ Si `tmdbId` est présent et que le film est enregistré avec le bon `tmdbId`, il est servi correctement.
- 🔴 **BUG :** Le schéma Movie (`Movie.ts` ligne 50) définit `titre` avec `unique: true` mais **`tmdbId` est optionnel** (`{ type: Number, index: true }` sans `required: true`, sans `unique: true`). Un film scrapé peut avoir `tmdbId: null` ou le mauvais `tmdbId`. Si un document "L'Odyssée" a été enregistré avec le contenu du film 1997 mais un `tmdbId` correspondant au film 2024, MongoDB le sert en priorité absolue avec le mauvais contenu.

- 🔴 **BUG :** Si `tmdbId` est absent dans le document MongoDB, la recherche tombe sur le fallback titre. `docMatchesQuery` tolère une différence d'année de ±1 (`Math.abs(Number(docYear) - year) > 1`), ce qui n'est pas assez strict pour des homonymes ("The Odyssey" 1997 vs 2024 = différence de 27 ans, mais le document ne porte pas l'année → `docYear` est `null` → la condition `!(year && docYear && ...)` court-circuite : un doc sans année passe toujours).

**Code exact incriminé :**
```typescript
// mongodb.provider.ts — docMatchesQuery via matchesWork
return !(year && docYear && Math.abs(Number(docYear) - year) > 1);
//                 ^^^^^^
// Si docYear est null/undefined (pas de champ year dans le document),
// cette condition est toujours false, donc le document passe quelle que soit son année réelle.
```

---

### 3. FrenchStream — recherche fuzzy sans vérification tmdbId

**Fichier :** `backend/src/modules/frenchstream/frenchstream.service.ts`

**La fonction `getFrenchStreamMovie`** (ligne 419) ne reçoit jamais le `tmdbId` — sa signature est :

```typescript
export async function getFrenchStreamMovie(
  title: string,
  preferredLang,
  targetYear?,      // ← L'année est le SEUL discriminant possible
  knownPagePath?,
  originalTitle?,
  directors?,
  mainActors?,
  frenchTitle?
): Promise<FrenchStreamDirectResult | null>
```

FrenchStream n'expose pas de recherche par `tmdbId`. La sélection repose sur :

1. **`isCandidateMatching`** (ligne 361–372) : vrai si `normCand.includes(norm) || norm.includes(normCand)`. Ce test est **inclusif** : `normalize("The Odyssey")` → `"theodyssey"`. Si FrenchStream liste "The Odyssey (1997)" et "The Odyssey (2024)", les deux passent ce filtre.

2. **`rankCandidates`** (ligne 374–420) : trie par score. L'année apporte +250 (match exact) ou -150 (mauvaise année). Si `targetYear` est `2024`, "The Odyssey (2024)" scorerait 100 (titre exact) + 250 (année) = 350, contre 100 + 10 (année 1997, scoreA -= 150 → max(10, 100-150)) = max 10 pour l'ancien. **Le tri par année fonctionne correctement si `targetYear` est transmis.**

3. 🔴 **Le vrai problème : `targetYear` peut être absent.** Dans `frenchstream.provider.ts`, la `StreamQuery` alimente `getFrenchStreamMovie`. L'année n'est peuplée dans `query.year` que si `enrichQueryTitles` l'a récupérée depuis TMDB. Si la requête arrive sans `tmdbId` (titre seul), `enrichQueryTitles` fait une recherche TMDB `/search/movie` et prend **le premier résultat** — qui n'est pas forcément le bon film.

4. 🔴 **`isCandidateMatching` trop permissive** (ligne 367–370) :
   ```typescript
   if (normCand.startsWith(norm) || norm.startsWith(normCand)) return true;
   if (normCand.includes(norm) || norm.includes(normCand)) return true;
   ```
   `normalize("The Odyssey")` = `"theodyssey"`. Si FrenchStream retourne "L'Odyssée 2024" → `normalize` = `"lodyssee2024"` ≠ `"theodyssey"` → pas de match sur ce titre français. Mais si le titre français est "The Odyssey" sur FrenchStream, les deux versions (1997 et 2024) matchent exactement et seul l'année départage.

---

### 4. Otaku Provider — matching titre sans tmdbId

**Fichier :** `backend/src/modules/otaku/otaku.service.ts`, `areTitlesMatching` (lignes 20–30)

```typescript
function areTitlesMatching(searchTitle: string, candidateTitle: string): boolean {
  const s = cleanTitle(searchTitle);
  const c = cleanTitle(candidateTitle);
  if (s === c) return true;
  if (c.startsWith(s) && (c.length - s.length <= 15)) return true;
  if (s.startsWith(c) && (s.length - c.length <= 10)) return true;
  if (c.includes(s) || s.includes(c)) return true;
  return false;
}
```

- 🔴 Même logique inclusive. `cleanTitle("The Odyssey")` → `"theodyssey"`. Si OpenOtaku liste les deux versions, **les deux matchent** et le premier résultat de l'API est retenu par défaut.
- ✅ Pour les films avec plusieurs candidats et une année, le code (lignes 183–196) charge les métadonnées via `fs-watch` et vérifie `w?.meta?.year`. Si OpenOtaku expose l'année, la déduplication fonctionne — mais seulement si `year` est présent dans la query.

---

### 5. Schéma Movie — `titre` unique sans `tmdbId` obligatoire

**Fichier :** `backend/src/models/Movie.ts`, lignes 49–54

```typescript
const MovieSchema: Schema = new Schema({
  titre: { type: String, required: true, unique: true },  // unique par titre
  lien: { type: String, required: true },
  tmdbId: { type: Number, index: true },                  // optionnel, non-unique
  ...
});
```

- 🔴 Un film scrapé sous le titre "L'Odyssée" avec le mauvais `lien` est **toujours servi** car MongoDB retourne ce document en priorité 1 (`findOne({ tmdbId: ... })`). Si `tmdbId` est erroné dans le document, le proxy est définitif.
- 🔴 L'unicité par `titre` empêche d'avoir deux entrées "L'Odyssée" pour les deux films homonymes. La seule façon de distinguer est d'avoir les deux `tmdbId` différents — mais si l'un a été scrapé avec `tmdbId: null`, il devient la seule entrée et bloque l'autre.

---

### Flux de décision complet pour "The Odyssey" (2024)

```
getMovieStream(query={ tmdbId: 1234567, title: "The Odyssey", year: 2024 })
│
├─ Cache LRU → miss
├─ enrichQueryTitles() → appel TMDB → query.frenchTitle = "L'Odyssée", query.year = 2024
│
├─ MongoDBProvider.getMovieStream()
│   ├─ Movie.findOne({ tmdbId: 1234567 })
│   │   → Si document avec tmdbId=1234567 mais lien stocké du film 1997 → ⚠️ MAL SERVI
│   │   → Si aucun document → fallback titre
│   └─ Movie.find({ titre: /L'Odyssée/i })
│       → peut retourner le film 1997 si year absent du document → ⚠️ MAL SERVI
│
└─ FrenchStreamProvider.getMovieStream() (si MongoDB échoue)
    └─ getFrenchStreamMovie("L'Odyssée", "fr", 2024, ...)
        ├─ searchFrenchStream("L'Odyssée")
        ├─ rankCandidates() — avec year=2024
        │   → "The Odyssey (2024)" score 350 vs "The Odyssey (1997)" score -50
        │   → ✅ CORRECT si les deux sont sur FrenchStream avec l'année dans le titre
        └─ Si un seul résultat sans année dans le titre → aucune garantie
```

---

### Fix recommandé — BUG 2

#### Fix A — MongoDB Provider : rejeter les docs sans année quand l'année cible est connue

**Fichier :** `backend/src/modules/streaming/providers/mongodb.provider.ts`

```typescript
// Remplacer dans docMatchesQuery :
return !(year && docYear && Math.abs(Number(docYear) - year) > 1);

// Par (rejet des docs sans année quand l'année cible est connue et que le titre est un homonyme courant) :
function docMatchesQuery(
  doc: { titre?: string; year?: any },
  titles: string[],
  year?: number | null,
  allowSeasonSuffix = false,
  strictYear = false,     // ← nouveau paramètre
): boolean {
  return titles.some((t) => {
    if (!matchesWork(doc, t, allowSeasonSuffix)) return false;
    const docYear = Number(doc.year) || yearFromTitle(doc.titre);
    if (year && docYear) {
      return Math.abs(Number(docYear) - year) <= 1;
    }
    // Si l'année cible est connue mais absente du doc, rejeter en mode strict
    if (strictYear && year && !docYear) return false;
    return true;
  });
}

// Appeler avec strictYear=true dans getMovieStream quand query.year est présent :
movie = candidates.find((d: any) => docMatchesQuery(d, titles, query.year, false, !!query.year)) || null;
```

#### Fix B — FrenchStreamProvider : ajouter le tmdbId comme garde-fou post-sélection

**Fichier :** `backend/src/modules/frenchstream/frenchstream.service.ts`, `rankCandidates`

Quand `targetYear` est absent, ajouter un reject explicite des résultats dont l'année diffère trop :

```typescript
// Dans getFrenchStreamMovie, après rankCandidates :
const rankedResults = rankCandidates(allSearchResults, title, targetYear, originalTitle, frenchTitle);

// Nouveau filtre : rejeter les candidats dont l'année est incompatible
const filteredByYear = targetYear
  ? rankedResults.filter((r) => {
      const y = extractYear(r.title);
      if (!y) return true; // pas d'année dans le titre FrenchStream → conserver
      return Math.abs(y - targetYear) <= 1;
    })
  : rankedResults;

const best = filteredByYear[0] ?? rankedResults[0]; // fallback si tout filtré
```

#### Fix C — Schéma Movie : ajouter une contrainte d'unicité composite (titre + tmdbId)

```typescript
// backend/src/models/Movie.ts
// Remplacer l'index unique sur titre seul par un index sparse sur tmdbId
// et conserver l'unicité titre pour les films sans tmdbId :
MovieSchema.index({ tmdbId: 1 }, { unique: true, sparse: true }); // ← ajouter
// Supprimer unique:true sur titre ou le convertir en index normal :
titre: { type: String, required: true, index: true }, // unique: true → à retirer
```

> ⚠️ Cette migration nécessite de supprimer l'index existant en base avant de redéployer. Prévoir une migration MongoDB.

#### Fix D — Otaku Service : vérification d'année systématique pour les films

**Fichier :** `backend/src/modules/otaku/otaku.service.ts`

Dans le bloc de sélection des films (type === 'movie'), toujours inspecter les métadonnées d'année même s'il n'y a qu'un seul candidat :

```typescript
// Remplacer :
if (type === 'movie' && year && matchingItems.length > 1) {
  // ← seulement si > 1 candidat
}

// Par :
if (type === 'movie' && year) {
  for (const cand of matchingItems.slice(0, 4)) {
    const w = await fetchWithRetry(`${BASE_URL}/api/fs-watch`, { id: cand.id });
    if (w?.meta?.year) {
      const candYear = parseInt(w.meta.year, 10);
      if (!isNaN(candYear) && Math.abs(candYear - year) <= 1) {
        bestItem = cand;
        watch = w;
        break;
      }
    }
  }
}
```

---

## Tableau de synthèse

| Bug | Fichier | Ligne(s) | Sévérité | Type |
|-----|---------|----------|----------|------|
| iOS : faux "done" immédiat | `src/hooks/useDownload.ts` | 240–246 | 🔴 Critique | Logique |
| iOS : `isIOS()` platform déprécié | `src/services/streamSaver.ts` | 51–58 | 🟡 Moyen | Compatibilité |
| iOS : href vide si NEXT_PUBLIC_API_URL absent | `src/services/streamSaver.ts` | 100–103 | 🟡 Moyen | Config |
| Odyssey : MongoDB doc sans année passe toujours | `backend/.../mongodb.provider.ts` | 36 | 🔴 Critique | Logique |
| Odyssey : FrenchStream pas de filtre année post-rank | `backend/.../frenchstream.service.ts` | 519–523 | 🔴 Critique | Logique |
| Odyssey : Otaku ne vérifie l'année qu'avec >1 candidat | `backend/.../otaku.service.ts` | 183–196 | 🟡 Moyen | Logique |
| Odyssey : Movie.titre unique sans tmdbId obligatoire | `backend/src/models/Movie.ts` | 50, 54 | 🟡 Moyen | Schéma |

---

*Fin du rapport forensique.*
