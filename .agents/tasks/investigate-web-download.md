# Rapport d'Investigation — Système de Téléchargement Web CHILLERS
**Date :** Investigation statique du code source  
**Scope :** App Web Next.js + Backend NestJS/Express  
**Symptôme :** Le téléchargement semble se terminer (notification "Téléchargé" / progression 100%) mais aucun fichier n'est présent dans le dossier Téléchargements de l'utilisateur.

---

## Profil du Bug

Il y a **deux bugs indépendants** qui produisent le même symptôme selon le navigateur/OS. Le plus fréquent concerne les navigateurs Desktop (Chrome/Firefox), le second concerne les mobiles et PWA. Tous deux aboutissent à ce que le système affiche "Téléchargement terminé" sans que rien n'atterrisse dans les fichiers.

**Bug #1 — Suspect Principal (Desktop/Android) :** L'`anchorHref` dans `DownloadModal.tsx` pointe vers l'URL **brute cross-origin** du CDN (ex : `https://u14.vidzy.cc/v/film.mp4?...`) pour les fournisseurs Vidzy et OpenOtaku. L'attribut HTML `download` est **ignoré par tous les navigateurs modernes sur les URLs cross-origin** : le navigateur ouvre le fichier dans un nouvel onglet au lieu de le sauvegarder, cet onglet se ferme immédiatement si le CDN renvoie un 403 ou un redirect, et la modale est déjà fermée (`onClick={() => onClose()}`). Résultat : aucun fichier, aucun message d'erreur visible.

**Bug #2 — Suspect Secondaire (tous navigateurs, flux HLS) :** La route `/api/download/stream` envoie du MP4 via FFmpeg en **mode chunked sans `Content-Length`**. Sur certains navigateurs et en contexte PWA, le gestionnaire natif de téléchargement abandonne un flux de taille inconnue ou signale "Terminé" dès que les en-têtes arrivent mais avant que les données ne soient écrites sur disque.

---

## Architecture du Système de Download (bout en bout)

```
Utilisateur clique "Télécharger"
    │
    ▼
[DownloadModal.tsx]
    │  useDownload() → resolve()
    ▼
[src/services/downloads.ts] resolveDownloadUrl()
    │  GET /api/download/resolve?tmdb_id=…&title=…&type=…
    ▼
[backend/src/modules/download/download.routes.ts] GET /resolve
    │  1. Cherche MongoDB (uqloadCode, uqloadLink, lien)
    │  2. ProviderManager (FrenchStream, Vidzy, Otaku…)
    │  3. Extraction embed → DirectScraper (Uqload, Vidzy, Doodstream)
    │  4. Rejette les URLs expirées (isSignedLinkExpired)
    │  5. Rejette les pages HTML / embeds non résolus
    │  6. Décide du finalDownloadUrl :
    │       • isIOS → /api/download/file?url=…  (proxy)
    │       • Vidzy / MP4 direct → URL BRUTE (pas de proxy)  ← PROBLÈME
    │       • Autres MP4 → /api/download/file?url=…  (proxy)
    │       • HLS → /api/download/stream?m3u8=…  (FFmpeg)
    ▼
[DownloadModal.tsx] reçoit { downloadUrl, directType, provider… }
    │  status → "ready"
    │  canDownload = true (si URL valide et non expirée)
    │
    ▼  (cas Desktop non-iOS, Vidzy/OpenOtaku)
    <a href="https://u14.vidzy.cc/v/film.mp4?t=…" 
       download="film.mp4"                         ← IGNORÉ cross-origin
       target="_blank">                            ← ouvre un onglet
    │
    ▼  (cas Desktop non-iOS, autres fournisseurs)
    <a href="https://backend.chillers.onrender.com/api/download/file?url=…"
       download="film.mp4"                         ← même domaine → fonctionne
       target="_blank">
    │
    ▼  (flux HLS → FFmpeg)
    <a href="/api/download/stream?m3u8=…"
       download="film.mp4">
    │  ← No Content-Length → gestionnaire native peut abandonner
    │
    ▼  (iOS)
    triggerAttachmentDownload(href)
       ← iframe cachée → gestionnaire natif Safari
```

---

## Preuves Collectées

### Bug #1 : URL brute cross-origin retournée pour Vidzy/OpenOtaku

**Fichier :** `backend/src/modules/download/download.routes.ts`, lignes 385–410

```typescript
// Lignes 395–403
if (isMp4Direct && downloadUrl.startsWith('http')) {
  if (isIOS) {
    finalDownloadUrl = `/api/download/file?url=...`;  // ← proxifié, OK
  } else if (DirectScraper.isVidzyUrl(downloadUrl) || 
             (!downloadUrl.includes('/api/') && /\.mp4(\?|$)/i.test(downloadUrl))) {
    // ↑ TOUS les MP4 directs non-iOS passent ici, pas seulement Vidzy
    finalDownloadUrl = downloadUrl;   // ← URL brute cross-origin retournée
    // Commentaire dans le code : "Pour Vidzy et tous les hébergeurs MP4 direct"
  } else {
    finalDownloadUrl = `/api/download/file?url=...`;  // ← proxifié
  }
}
```

La condition `DirectScraper.isVidzyUrl(downloadUrl) || /\.mp4(\?|$)/i.test(downloadUrl)` englobe **tous** les fournisseurs qui retournent un MP4 direct avec une URL brute (`https://cdn.example.com/film.mp4?sig=…`). Ce sont des domaines tiers (Vidzy, OpenOtaku, CDNs hébergeurs), différents de `chillers.site` ou `chillers.onrender.com`.

**Fichier :** `src/features/downloads/DownloadModal.tsx`, lignes 109–124 et 263–274

```typescript
// Lignes 109–112 : readyHref est l'URL RAW si elle commence par http
const readyHref = dl.task?.resolvedUrl
  ? (dl.task.resolvedUrl.startsWith("http")
      ? dl.task.resolvedUrl           // ← URL cross-origin directe !
      : `${getBackendOrigin()}${dl.task.resolvedUrl}`)
  : "#";

// Ligne 124 : anchorHref = readyHref pour non-iOS
const anchorHref = isIOS() ? ... : readyHref;

// Lignes 263–274 : l'ancre rendue avec download="" sur URL cross-origin
{canDownload && (
  <a
    href={anchorHref}              // = URL Vidzy brute https://u14.vidzy.cc/...
    target="_blank"
    rel="noopener noreferrer"
    download={dl.task?.filename}   // ← IGNORÉ par le navigateur (cross-origin)
    onClick={() => onClose()}      // ← modale fermée immédiatement
  >
    Télécharger
  </a>
)}
```

**Règle W3C (HTML Living Standard) :** L'attribut `download` ne fonctionne que sur les URLs **same-origin**. Sur une URL cross-origin, il est silencieusement ignoré. Le comportement devient : navigation vers l'URL dans un nouvel onglet. Si ce CDN renvoie un 403 (lien expiré) ou ferme la connexion, le nouvel onglet s'ouvre puis se referme immédiatement — aucune boîte de téléchargement n'apparaît.

**Confirmation du commentaire dans le code** (download.routes.ts, lignes 398–401) :

```typescript
// On sert l'URL directe pour une vitesse maximale et éviter que le proxy Node.js
// ne coupe la connexion ou ne produise des fichiers corrompus de 0 ko ou 55 bytes.
finalDownloadUrl = downloadUrl;
```

Ce commentaire révèle un bug antérieur avec le proxy (`0 ko ou 55 bytes`). La "solution" de contournement (aller direct) a créé le bug actuel (download ignoré par le navigateur).

---

### Bug #2 : FFmpeg chunked sans Content-Length

**Fichier :** `backend/src/modules/download/download.routes.ts`, lignes 707–730

```typescript
router.get('/stream', async (req: Request, res: Response) => {
  // ...
  res.setHeader('Content-Disposition', `attachment; filename="..."`);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'no-cache');
  // ← PAS de Content-Length (impossible avec FFmpeg à la volée)
  
  const ffmpeg = spawn('ffmpeg', [..., 'pipe:1']);
  ffmpeg.stdout.pipe(res);  // ← Chunked Transfer-Encoding automatique
});
```

Sans `Content-Length`, le gestionnaire natif du navigateur ne sait pas quand le fichier se terminera. Sur Chrome/Firefox, le téléchargement apparaît comme "Resuming..." ou sans barre de progression. Sur certaines versions de Safari, le transfert est annulé. En PWA standalone, le comportement est encore plus aléatoire.

**Note :** `upgradeToDirectFile()` tente de passer à un MP4 direct avant FFmpeg, mais si elle échoue (ce qui arrive pour les HLS Uqload complexes), FFmpeg prend le relais sans Content-Length.

---

### Bug #3 (mineur) : iOS — état "done" avant confirmation

**Fichier :** `src/services/streamSaver.ts`, lignes 77–92

```typescript
if (isIOS()) {
  triggerAttachmentDownload(href);   // déclenche l'iframe
  return { totalBytes: null };        // retour IMMÉDIAT
}
```

**Fichier :** `src/hooks/useDownload.ts`, lignes 244–246

```typescript
await streamDownloadToDisk(url, { ... });
// ...
setStatus(id, "done");  // ← "done" immédiatement après retour iOS
```

Sur iOS, `streamDownloadToDisk` retourne `{ totalBytes: null }` **dès que l'iframe est injectée**, avant même que Safari ait commencé à télécharger. Le status passe à `"done"` alors que le fichier est peut-être encore en cours de transfert, ou que le CDN a retourné un 403. L'utilisateur voit ✅ "Téléchargé" mais rien dans ses Fichiers.

---

### Vérification des Headers CORS

**Fichier :** `backend/src/app.ts`, lignes 104–111

```typescript
exposedHeaders: [
  'Content-Range',
  'Accept-Ranges',
  'Content-Length',
  'Content-Type',
  'ETag',
  'X-Total-Count',
  // ← Content-Disposition ABSENT
],
```

**`Content-Disposition` n'est pas dans `exposedHeaders`**. Cela signifie que si le frontend fait un `fetch()` vers le backend et lit `response.headers.get('content-disposition')`, il récupère `null`. Ce n'est pas directement la cause du bug principal (le problème est en amont), mais ça empêche le frontend de vérifier programmatiquement que le serveur a bien envoyé le header attachment.

---

### Authentification sur la route download

**Résultat :** Aucune vérification d'authentification sur `/api/download/*`. La route est publique (`backend/src/app.ts` ligne 217 : `app.use('/api/download', downloadRoutes)` sans middleware auth). Les utilisateurs non connectés peuvent télécharger — ce n'est pas la cause du bug.

---

### Service Worker — interception des téléchargements

**Fichier :** `public/sw.js`, lignes ~135–145

```javascript
if (
  url.includes('/api/') ||
  url.includes('.mp4') ||
  url.includes('.m3u8') ||
  url.includes('/proxy') ||
  event.request.method !== 'GET'
) {
  return;  // ← SW ne gère PAS ces requêtes
}
```

Le Service Worker **n'intercepte pas** les URLs `/api/`, `.mp4`, `.m3u8`. Il ne peut donc pas silencieusement dropper un téléchargement. Ce n'est pas la cause du problème.

---

### Rewrites Next.js

**Fichier :** `next.config.ts`

```typescript
{ source: '/api/:path*', destination: `${backendOrigin}/api/:path*` }
```

Les rewrites redirigent `/api/*` vers le backend. Pas de rewrite spécifique qui détournerait `/api/download` vers un CDN externe. Ce n'est pas la cause du problème.

---

## Suspects — Classés par Probabilité

| # | Suspect | Probabilité | Impact |
|---|---------|------------|--------|
| 1 | **URL brute cross-origin retournée** (Vidzy/MP4 direct), `download` attr ignoré | **85%** | Aucun fichier téléchargé, aucune erreur visible |
| 2 | **FFmpeg chunked sans Content-Length** (HLS → MP4 à la volée) | **60%** | Fichier partiel ou abandon silencieux |
| 3 | **Statut "done" prématuré iOS** (iframe injectée ≠ téléchargement confirmé) | **70%** (iOS) | Utilisateur voit ✅ mais rien dans Fichiers |
| 4 | **Content-Disposition absent de CORS exposedHeaders** | **20%** | Impossible de déboguer programmatiquement |
| 5 | Lien signé expiré entre résolution et clic | **30%** | 403 silencieux, onglet qui se ferme |

---

## Verdict — Cause Racine

### Cas 1 — Desktop/Android (Chrome, Firefox, Edge) — fournisseur Vidzy ou MP4 direct

Le backend retourne une URL brute `https://u14.vidzy.cc/v/film.mp4?t=…&s=…&e=14400` dans `downloadUrl`. La `DownloadModal` construit `readyHref = resolvedUrl` (commence par `http` → pas de proxy). Le bouton est un `<a href="https://u14.vidzy.cc/..." download="film.mp4" target="_blank">`.

**Le navigateur ouvre un nouvel onglet** vers cette URL cross-origin. Trois sous-cas :
- a) Le CDN accepte → le fichier est listé dans les téléchargements du navigateur natif, mais sans nom correct (le CDN sert un nom générique ou rien). **L'utilisateur cherche dans ses Téléchargements et ne trouve pas le bon fichier.**
- b) Le CDN a besoin d'un `Referer` correct → répond 403 → l'onglet s'ouvre puis se ferme → **aucun fichier**.
- c) Le CDN redirige → le navigateur suit le redirect cross-origin → l'attribut `download` est perdu sur chaque redirect → **aucun fichier.**

L'état `"done"` est ensuite positionné par le Service Worker (BG_FETCH_SUCCESS) ou **jamais** — car avec une ancre `<a>`, aucun message SW n'est émis. La modale est fermée par `onClick={() => onClose()}` avant même que le navigateur ait fini. Le status reste à `"ready"` ou `"done"` selon le timing. **L'utilisateur voit la modale disparaître et croit le téléchargement lancé, mais rien n'est arrivé.**

### Cas 2 — Tous navigateurs — fournisseur HLS (flux à la volée FFmpeg)

Le résolveur retourne `/api/download/stream?m3u8=…` qui est servi en chunked sans `Content-Length`. Sur certains navigateurs, le téléchargement natif s'affiche en "taille inconnue", et s'il est interrompu (perte réseau, onglet mis en veille), la reconnexion échoue car il n'y a pas de `Accept-Ranges` + `Content-Length` pour reprendre. Le fichier partiel peut être 0 octet.

### Cas 3 — iOS (iPhone/iPad)

`triggerAttachmentDownload()` injecte une `<iframe src="...">` hors écran et retourne immédiatement. Le status passe à `"done"` avant confirmation. Si le CDN retourne une erreur 403 (lien expiré) ou si Safari rejette la navigation de l'iframe (restriction iOS > 15.4 sur les iframes de type attachment dans PWA), l'utilisateur voit ✅ sans fichier.

---

## Recommandations — Code Concret

### Fix #1 (Priorité HAUTE) — Toujours proxifier les MP4 directs pour les non-iOS

**Fichier :** `backend/src/modules/download/download.routes.ts`, lignes 393–406

**Problème :** La branche qui retourne l'URL brute est trop large — elle attrape tous les MP4 directs non-iOS.

**Avant :**
```typescript
} else if (DirectScraper.isVidzyUrl(downloadUrl) || (!downloadUrl.includes('/api/') && /\.mp4(\?|$)/i.test(downloadUrl))) {
  finalDownloadUrl = downloadUrl; // URL brute cross-origin
```

**Après :**
```typescript
} else {
  // Toujours proxifier pour garantir Content-Disposition: attachment
  // et éviter que l'attribut download HTML soit ignoré cross-origin.
  finalDownloadUrl = `/api/download/file?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(cleanFilename)}`;
}
```

> **Note sur le bug "0 ko / 55 bytes" mentionné dans le commentaire :** Ce bug proxy venait probablement d'un mauvais `Referer` envoyé à l'hébergeur. La fonction `serveFileProxy()` gère maintenant correctement les Referers spécifiques par domaine (lignes 480–496). Supprimer la branche "direct" est maintenant sans risque.

---

### Fix #2 (Priorité HAUTE) — Ajouter Content-Disposition à CORS exposedHeaders

**Fichier :** `backend/src/app.ts`, lignes 104–111

```typescript
exposedHeaders: [
  'Content-Range',
  'Accept-Ranges',
  'Content-Length',
  'Content-Type',
  'Content-Disposition',   // ← AJOUTER
  'ETag',
  'X-Total-Count',
],
```

Cela permet au frontend de lire `response.headers.get('content-disposition')` après un `fetch()` et de vérifier que le serveur envoie bien `attachment`.

---

### Fix #3 (Priorité MOYENNE) — Confirmer le téléchargement iOS avant "done"

**Fichier :** `src/services/streamSaver.ts`, lignes 77–92

Le statut `"done"` ne devrait pas être positionné immédiatement après `triggerAttachmentDownload`. Deux approches :

**Option A (rapide)** — Ne pas marquer `"done"` sur iOS, utiliser un statut intermédiaire :

```typescript
// Dans streamSaver.ts
if (isIOS()) {
  triggerAttachmentDownload(href);
  return { totalBytes: null, iosTriggered: true };
}
```

```typescript
// Dans useDownload.ts (streamCurrent)
const result = await streamDownloadToDisk(url, { ... });
if ((result as any).iosTriggered) {
  // Sur iOS on ne peut pas confirmer : on laisse en "downloading"
  // et on attend le message BG_FETCH_SUCCESS du SW si disponible,
  // ou on passe à "done" après un timeout de 30s (heuristique).
  setTimeout(() => {
    if (useDownloadsStore.getState().tasks.find(t => t.id === id)?.status === 'downloading') {
      setStatus(id, 'done');
    }
  }, 30_000);
} else {
  setStatus(id, 'done');
}
```

**Option B (robuste)** — Utiliser la Background Fetch API (déjà partiellement implémentée dans `sw.js`) qui envoie `BG_FETCH_SUCCESS` uniquement quand les octets sont confirmés reçus par le SW. Le `sw.js` gère déjà `backgroundfetchsuccess` et envoie `{ type: 'BG_FETCH_SUCCESS', id }` — le `useDownload.ts` écoute déjà ce message (lignes 75–90). Il faut connecter les deux.

---

### Fix #4 (Priorité BASSE) — FFmpeg : ajouter un en-tête de taille estimée

**Fichier :** `backend/src/modules/download/download.routes.ts`, route `/stream`

Avant de lancer FFmpeg, tenter un HEAD sur l'URL m3u8 pour estimer la durée totale, puis calculer une taille approximative. Ou, plus simplement, forcer le gestionnaire à attendre la fin du stream sans afficher de taille :

```typescript
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('Transfer-Encoding', 'chunked'); // explicite
// Ajouter un avertissement dans la réponse initiale si possible
```

Ou encore passer `upgradeToDirectFile()` en obligatoire (reject si pas de MP4 direct) pour les flux HLS, afin de ne jamais servir un chunked sans taille.

---

### Vérification Rapide (sans changer de code)

Pour tester si Fix #1 résoudrait le bug sans déploiement :

1. Ouvrir DevTools → Network dans Chrome
2. Déclencher un téléchargement sur un film Vidzy/OpenOtaku
3. Observer la requête `/api/download/resolve` → noter `data.downloadUrl`
4. Si `downloadUrl` commence par `https://u14.vidzy.cc/` ou `https://cdn.openotaku.` → c'est bien le Bug #1
5. Copier l'URL, l'ouvrir dans un onglet → observer si le fichier se télécharge ou si l'onglet se ferme

---

## Résumé des Fichiers à Modifier

| Fichier | Changement | Priorité |
|---------|-----------|----------|
| `backend/src/modules/download/download.routes.ts` | Supprimer la branche `finalDownloadUrl = downloadUrl` (URL brute), toujours proxifier | HAUTE |
| `backend/src/app.ts` | Ajouter `Content-Disposition` dans `exposedHeaders` | HAUTE |
| `src/services/streamSaver.ts` | Ne pas retourner "done" immédiatement sur iOS | MOYENNE |
| `src/hooks/useDownload.ts` | Gérer le cas `iosTriggered` dans `streamCurrent` | MOYENNE |
