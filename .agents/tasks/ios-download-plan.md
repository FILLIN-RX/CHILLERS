# Plan d'implémentation : Correction du téléchargement iOS/Android

## Contexte

**Problème actuel** : La fonction `triggerAttachmentDownload` dans `/home/ruxel/CHILLERS/src/services/downloads.ts` utilise une iframe cachée pour déclencher le téléchargement. Cette approche ne fonctionne plus de manière fiable sur iOS Safari.

**Méthode qui marchait avant** : `window.open()` ouvrait un nouvel onglet avec l'URL du serveur, le téléchargement démarrait grâce au header `Content-Disposition: attachment`, puis l'onglet se fermait automatiquement après 2000ms. Safari continuait le téléchargement en arrière-plan.

**Investigation des fichiers** :
- ✅ Backend `/api/download/file` envoie déjà les bons headers : `Content-Disposition: attachment`, `Content-Type: video/mp4`, `Accept-Ranges: bytes`
- ✅ `toIOSDownloadHref()` proxifie correctement toutes les URLs tierces via `/api/download/file`
- ✅ Sur Android, un fallback Blob natif existe déjà dans `streamSaver.ts` quand le Service Worker n'est pas actif
- ❌ `triggerAttachmentDownload()` utilise une iframe au lieu de `window.open()` avec auto-fermeture

## Architecture découverte

**Projet** : Next.js 16.2 + React 19 + TypeScript
**Build** : `npm run build`
**Tests** : Jest avec `npm test` (tests unitaires dans `src/**/__tests__/**`)
**Backend** : Express + TypeScript dans `/backend/src/`, build avec `npm run build`

**Flux de téléchargement iOS actuel** :
1. `streamDownloadToDisk()` détecte iOS avec `isIOS()`
2. Appelle `toIOSDownloadHref()` pour proxifier l'URL via `/api/download/file`
3. Appelle `triggerAttachmentDownload()` qui crée une iframe cachée
4. Backend répond avec `Content-Disposition: attachment` → déclenche le téléchargement Safari natif

**Problème identifié** : L'iframe cachée ne déclenche pas toujours le téléchargement Safari de manière fiable, surtout dans les versions récentes d'iOS. `window.open()` est la méthode recommandée et testée qui fonctionnait avant.

---

# Implementation Plan

## Phase 1 : Remplacement de l'iframe par window.open()

- [ ] 1. Modifier `triggerAttachmentDownload()` dans `/home/ruxel/CHILLERS/src/services/downloads.ts` pour utiliser `window.open()` avec auto-fermeture.
      - Remplacer la création d'iframe par `window.open(href, '_blank')`
      - Stocker la référence de la fenêtre ouverte
      - Ajouter un `setTimeout` de 2000ms pour fermer automatiquement la fenêtre avec `windowRef.close()`
      - Ajouter des logs de debugging : "Download triggered via window.open:", href
      - Gérer le cas où `window.open()` retourne `null` (popup bloqué) : log une alerte console.warn
      - ✅ Protection déjà en place : cette fonction est TOUJOURS appelée depuis un onClick (voir useDownloadsBatch.ts ligne 196-199, le scheduler s'arrête à "ready" sur iOS)
      Files: `/home/ruxel/CHILLERS/src/services/downloads.ts`
      Verify: Lire le fichier modifié et confirmer que `window.open()` est utilisé avec `setTimeout` pour la fermeture

- [ ] 2. Ajouter des logs de debugging dans `streamDownloadToDisk()` pour tracer le flux iOS.
      - Dans le bloc `if (isIOS())`, ajouter des console.log détaillés :
        * "iOS detected - using native Safari download"
        * "Backend origin:", backendOrigin
        * "Download href:", href
        * "Triggering attachment download..."
      - Après `triggerAttachmentDownload()`, log "iOS download triggered, returning optimistic result"
      Files: `/home/ruxel/CHILLERS/src/services/streamSaver.ts`
      Verify: Lire le fichier et confirmer la présence des logs dans le bloc iOS

- [ ] 3. Ajouter des logs dans `launchReady()` du hook `useDownloadsBatch`.
      - Log avant l'appel : "Launching ready download for:", id, "URL:", url
      - Log après `triggerAttachmentDownload()` : "Attachment download triggered for:", task.filename
      Files: `/home/ruxel/CHILLERS/src/hooks/useDownloadsBatch.ts`
      Verify: Lire le fichier et confirmer les logs autour de l'appel à `triggerAttachmentDownload()`

## Phase 2 : Préservation du comportement Android

- [ ] 4. Vérifier et documenter le fallback Android dans `streamDownloadToDisk()`.
      - Le bloc `if (useNativeAndroidDownload)` existe déjà et télécharge via Blob + ancre `<a download>`
      - Ajouter un log au début du bloc : "Android Chrome without SW - using native Blob download"
      - Ajouter un log après la création du Blob : "Blob created, triggering native download:", filename, "Size:", received, "bytes"
      - Aucun changement fonctionnel nécessaire - le fallback Blob est déjà correct
      Files: `/home/ruxel/CHILLERS/src/services/streamSaver.ts`
      Verify: Lire le bloc Android et confirmer que le fallback Blob reste intact avec les nouveaux logs

## Phase 3 : Mise à jour de la documentation inline

- [ ] 5. Mettre à jour le commentaire de la fonction `triggerAttachmentDownload()`.
      - Remplacer le commentaire existant qui mentionne iframe par :
        ```
        /**
         * Ouvre la boîte de téléchargement Safari/iOS dans un nouvel onglet qui se ferme automatiquement.
         *
         * window.open() ouvre un onglet → le serveur répond Content-Disposition: attachment → 
         * Safari déclenche le téléchargement natif → l'onglet se ferme après 2s.
         * Le téléchargement continue en arrière-plan dans le gestionnaire de Safari.
         *
         * Ancienne approche (iframe cachée) ne fonctionnait plus de manière fiable sur iOS récents.
         * Appeler depuis un geste utilisateur (WebKit limite un fichier par geste).
         */
        ```
      Files: `/home/ruxel/CHILLERS/src/services/downloads.ts`
      Verify: Lire la JSDoc de `triggerAttachmentDownload()` et confirmer qu'elle décrit `window.open()` et non iframe

- [ ] 6. Ajouter un commentaire dans le bloc iOS de `streamDownloadToDisk()` expliquant pourquoi window.open.
      - Au-dessus de `triggerAttachmentDownload(href)`, ajouter :
        ```
        // window.open() ouvre un onglet qui se ferme automatiquement après 2s.
        // Content-Disposition: attachment déclenche le téléchargement Safari natif.
        // Le navigateur gère la progression et la persistance même après fermeture de l'onglet.
        ```
      Files: `/home/ruxel/CHILLERS/src/services/streamSaver.ts`
      Verify: Lire le commentaire ajouté dans le bloc iOS

## Phase 4 : Tests unitaires

- [ ] 7. Mettre à jour les tests existants de `triggerAttachmentDownload()`.
      - Fichier : `/home/ruxel/CHILLERS/src/services/__tests__/download.test.ts`
      - Remplacer les assertions qui vérifient la création d'iframe par des assertions window.open :
        * Mocker `window.open` pour retourner un objet avec une méthode `close()`
        * Vérifier que `window.open` a été appelé avec (href, '_blank')
        * Vérifier que `windowRef.close()` est appelé après 2000ms (utiliser jest.useFakeTimers)
      - Ajouter un test pour le cas où `window.open()` retourne `null` (popup bloqué)
      Files: `/home/ruxel/CHILLERS/src/services/__tests__/download.test.ts`
      Verify: `npm test -- download.test.ts` — tous les tests passent

- [ ] 8. Vérifier que les tests de `streamSaver.ts` passent toujours.
      - Fichier : `/home/ruxel/CHILLERS/src/services/__tests__/streamSaver.test.ts` (s'il existe)
      - Mocker `triggerAttachmentDownload` et vérifier qu'il est appelé avec le bon href sur iOS
      - Si le fichier de test n'existe pas, créer un test basique qui vérifie :
        * `isIOS()` retourne true quand navigator.userAgent contient "iPhone"
        * `streamDownloadToDisk()` appelle `triggerAttachmentDownload` quand `isIOS()` est true
      Files: `/home/ruxel/CHILLERS/src/services/__tests__/streamSaver.test.ts`
      Verify: `npm test -- streamSaver.test` — tous les tests passent (ou créer le fichier si absent)

## Phase 5 : Vérification backend

- [ ] 9. Vérifier que `/api/download/file` envoie bien tous les headers nécessaires pour iOS.
      - Fichier : `/home/ruxel/CHILLERS/backend/src/modules/download/download.routes.ts`
      - Confirmer ligne 545-555 que les headers suivants sont bien définis :
        * `Content-Disposition: attachment; filename="..."; filename*=UTF-8''...` ✅
        * `Content-Type: video/mp4` (ou type amont valide) ✅
        * `Accept-Ranges: bytes` ✅
        * `Content-Length` (si disponible de l'amont) ✅
      - Ajouter un log après la définition des headers : "Serving download with headers - Content-Disposition: attachment, filename:", filename
      Files: `/home/ruxel/CHILLERS/backend/src/modules/download/download.routes.ts`
      Verify: Lire le code du route handler `/file` et confirmer les headers + log ajouté

- [ ] 10. Vérifier que `/api/download/stream` envoie aussi `Content-Disposition: attachment`.
      - Fichier : `/home/ruxel/CHILLERS/backend/src/modules/download/download.routes.ts`
      - Confirmer lignes 688-695 que `Content-Disposition: attachment` est défini pour les HLS convertis en MP4
      - Headers vérifiés : `Content-Disposition`, `Content-Type: video/mp4`, `Cache-Control: no-cache`
      - Ajouter un log : "Streaming HLS to MP4 with Content-Disposition: attachment, filename:", filename
      Files: `/home/ruxel/CHILLERS/backend/src/modules/download/download.routes.ts`
      Verify: Lire le route handler `/stream` et confirmer les headers + log

## Phase 6 : Test manuel et validation

- [ ] 11. Documenter la procédure de test manuel iOS dans un fichier dédié.
      - Créer `/home/ruxel/CHILLERS/.agents/tasks/ios-download-test-procedure.md`
      - Contenu :
        * Prérequis : iPhone/iPad avec Safari, ou Safari sur Mac avec mode développeur iOS
        * Étapes : Ouvrir l'app CHILLERS, sélectionner un film/épisode, cliquer sur Télécharger
        * Vérifications :
          1. Un nouvel onglet s'ouvre brièvement (durée : ~2s)
          2. L'onglet se ferme automatiquement
          3. La boîte de téléchargement Safari native apparaît (ou notification iOS)
          4. Le fichier apparaît dans les Téléchargements Safari (icône flèche vers le bas)
          5. Le fichier .mp4 peut être ouvert et lu
        * Logs à vérifier dans la console Safari (Inspect → Console sur Mac) :
          - "iOS detected - using native Safari download"
          - "Download triggered via window.open: /api/download/file?url=..."
          - "iOS download triggered, returning optimistic result"
        * Cas d'erreur à tester : bloqueur de popup activé → vérifier le log d'alerte
      Files: `/home/ruxel/CHILLERS/.agents/tasks/ios-download-test-procedure.md`
      Verify: Lire le fichier créé et confirmer qu'il contient toutes les étapes de test

- [ ] 12. Documenter la procédure de test Android dans le même fichier.
      - Ajouter une section Android au fichier de test :
        * Prérequis : Android avec Chrome, en navigation classique (pas PWA standalone)
        * Avec Service Worker actif : téléchargement StreamSaver normal (pas de changement)
        * Sans Service Worker (mode incognito ou SW désactivé) : fallback Blob natif
        * Étapes : même flux que iOS
        * Vérifications :
          1. Si SW actif : barre de progression Chrome native avec fichier qui descend
          2. Si SW inactif : ancre `<a download>` déclenche le téléchargement natif Android
          3. Fichier apparaît dans les Téléchargements Chrome (notification Android)
          4. Le fichier .mp4 peut être ouvert et lu
        * Logs à vérifier :
          - Si SW inactif : "Android Chrome without SW - using native Blob download"
          - "Blob created, triggering native download: <filename> Size: <bytes> bytes"
      Files: `/home/ruxel/CHILLERS/.agents/tasks/ios-download-test-procedure.md`
      Verify: Lire la section Android ajoutée au fichier

## Phase 7 : Cleanup et polissage

- [ ] 13. Supprimer tout code mort lié à l'ancienne approche iframe.
      - Dans `triggerAttachmentDownload()`, supprimer tout commentaire ou code legacy qui référence iframe
      - Rechercher dans la codebase d'autres références à l'approche iframe : `grep -r "iframe" src/services/ src/hooks/`
      - Si des commentaires mentionnent l'iframe comme solution, les mettre à jour
      Files: `/home/ruxel/CHILLERS/src/services/downloads.ts`, `/home/ruxel/CHILLERS/src/hooks/useDownloadsBatch.ts`
      Verify: `grep -r "iframe.*download" src/services/ src/hooks/` ne doit retourner aucun résultat

- [ ] 14. Ajouter un commentaire de changement dans le CHANGELOG ou doc projet.
      - Si un fichier CHANGELOG.md existe à la racine, ajouter une entrée :
        ```
        ## [Date] - iOS/Android Download Fix
        
        ### Changed
        - Replaced hidden iframe download trigger with `window.open()` for iOS Safari compatibility
        - Added auto-close (2s timeout) for download tabs on iOS
        - Added comprehensive debugging logs for download flow
        
        ### Fixed
        - iOS downloads not triggering reliably with hidden iframe approach
        - Download tab now closes automatically while Safari continues download in background
        ```
      - Si pas de CHANGELOG.md, ajouter une note dans `/home/ruxel/CHILLERS/PROJECT_STATUS.md` ou créer une note dans `.agents/tasks/`
      Files: `/home/ruxel/CHILLERS/CHANGELOG.md` ou `/home/ruxel/CHILLERS/.agents/tasks/ios-download-changes.md`
      Verify: Lire l'entrée ajoutée et confirmer qu'elle décrit les changements

---

## Résumé des changements

### Fichiers modifiés :
1. `/home/ruxel/CHILLERS/src/services/downloads.ts` — remplacer iframe par window.open()
2. `/home/ruxel/CHILLERS/src/services/streamSaver.ts` — logs de debugging iOS et Android
3. `/home/ruxel/CHILLERS/src/hooks/useDownloadsBatch.ts` — logs dans launchReady()
4. `/home/ruxel/CHILLERS/src/services/__tests__/download.test.ts` — tests window.open
5. `/home/ruxel/CHILLERS/backend/src/modules/download/download.routes.ts` — logs de confirmation headers

### Fichiers créés :
1. `/home/ruxel/CHILLERS/.agents/tasks/ios-download-test-procedure.md` — procédure de test manuel
2. `/home/ruxel/CHILLERS/.agents/tasks/ios-download-changes.md` ou entrée CHANGELOG — documentation des changements

### Comportement attendu après implémentation :

**iOS Safari** :
1. User clique "Télécharger" → `streamDownloadToDisk()` détecte iOS
2. URL proxifiée via `/api/download/file` si nécessaire
3. `triggerAttachmentDownload()` appelle `window.open(href, '_blank')`
4. Nouvel onglet s'ouvre → backend répond `Content-Disposition: attachment`
5. Safari déclenche le téléchargement natif (boîte iOS)
6. Après 2000ms, l'onglet se ferme automatiquement
7. Le téléchargement continue en arrière-plan dans le gestionnaire Safari

**Android Chrome avec Service Worker** :
- Aucun changement : StreamSaver + MITM fonctionne normalement

**Android Chrome sans Service Worker** :
- Fallback Blob natif déjà en place : fetch → Blob → ancre `<a download>`

**Desktop (tous navigateurs)** :
- Aucun changement : StreamSaver avec MITM iframe fonctionne normalement

### Points de vérification :
✅ Backend envoie déjà `Content-Disposition: attachment` (pas de changement nécessaire)
✅ `toIOSDownloadHref()` proxifie déjà les URLs correctement (pas de changement)
✅ Fallback Android Blob existe déjà (juste ajouter logs)
⚠️ Changement principal : iframe → window.open() avec auto-fermeture
⚠️ Logs de debugging à ajouter dans tous les flux
⚠️ Tests à mettre à jour pour refléter window.open()

### Risques et mitigations :
- **Bloqueurs de popup** : Si window.open() est bloqué, le log alertera l'utilisateur. 
  - ✅ **Mitigation déjà en place** : Sur iOS, le code s'arrête à `status: "ready"` et `launchReady()` est appelé UNIQUEMENT depuis un `onClick` de bouton (gestionnaire d'événement utilisateur direct).
  - Le scheduler automatique ne déclenche JAMAIS `triggerAttachmentDownload()` automatiquement.
  - Flux protégé dans `useDownloadsBatch.ts` ligne 196-199 : `if (isIOS()) { setStatus(task.id, "ready"); return; }`
- **Régression desktop** : Aucun changement dans le flux desktop (StreamSaver), donc pas de risque.
- **Régression Android** : Aucun changement dans le flux Android existant, juste logs supplémentaires.

### Tests requis :
- Tests unitaires Jest : vérifier window.open mock et close après 2000ms
- Test manuel iOS : vérifier onglet s'ouvre et se ferme, téléchargement démarre
- Test manuel Android : vérifier les deux cas (avec/sans SW)
- Test manuel Desktop : vérifier que StreamSaver normal fonctionne toujours
