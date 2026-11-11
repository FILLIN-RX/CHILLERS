# Procédure de test manuel iOS/Android - Téléchargement

## Test iOS Safari

### Prérequis
- iPhone/iPad avec Safari, ou Safari sur Mac avec mode développeur iOS (Développement → Simulateur)
- L'application CHILLERS déployée et accessible depuis l'appareil

### Étapes de test
1. Ouvrir l'app CHILLERS dans Safari
2. Se connecter si nécessaire
3. Naviguer vers un film ou épisode
4. Cliquer sur le bouton "Télécharger"

### Vérifications attendues

✅ **Comportement normal** :
1. Un nouvel onglet s'ouvre brièvement (durée : ~2 secondes)
2. L'onglet se ferme automatiquement
3. La boîte de téléchargement Safari native apparaît (ou notification iOS)
4. Le fichier apparaît dans les Téléchargements Safari (icône flèche vers le bas dans la barre d'outils)
5. Le fichier .mp4 peut être ouvert et lu depuis les Téléchargements

✅ **Logs dans la console Safari** (Inspect → Console sur Mac) :
```
[download] iOS detected - using native Safari download
[download] Backend origin: https://...
[download] Download href: https://.../api/download/file?url=...
[download] Triggering attachment download...
[download] triggerAttachmentDownload -> https://.../api/download/file?url=...
[download] iOS download triggered, returning optimistic result
```

### Cas d'erreur à tester

⚠️ **Bloqueur de popup activé** :
1. Activer le bloqueur de popup dans Safari (Réglages Safari → Bloquer les fenêtres pop-up)
2. Tenter de télécharger un fichier
3. Vérifier le log d'alerte dans la console :
   ```
   [download] window.open blocked, falling back to iframe
   ```
4. Le téléchargement devrait quand même fonctionner via le fallback iframe (comportement dégradé)

---

## Test Android Chrome

### Prérequis
- Android avec Chrome
- L'application CHILLERS accessible depuis l'appareil

### Cas 1 : Avec Service Worker actif (navigation normale)

**Étapes** :
1. Ouvrir l'app CHILLERS dans Chrome (navigation normale, pas mode incognito)
2. Se connecter si nécessaire
3. Naviguer vers un film ou épisode
4. Cliquer sur "Télécharger"

**Vérifications** :
- ✅ Barre de progression Chrome native apparaît
- ✅ Fichier descend normalement avec StreamSaver
- ✅ Notification Android apparaît quand le téléchargement démarre
- ✅ Le fichier apparaît dans les Téléchargements Chrome (notification Android)
- ✅ Le fichier .mp4 peut être ouvert et lu

**Logs attendus** :
```
(pas de log iOS, comportement normal StreamSaver)
```

### Cas 2 : Sans Service Worker (mode incognito ou SW désactivé)

**Étapes** :
1. Ouvrir Chrome en mode incognito (ou désactiver les Service Workers dans chrome://flags)
2. Ouvrir l'app CHILLERS
3. Se connecter et naviguer vers un film/épisode
4. Cliquer sur "Télécharger"

**Vérifications** :
- ✅ Fallback Blob natif est utilisé
- ✅ Ancre `<a download>` déclenche le téléchargement natif Android
- ✅ Notification Android apparaît
- ✅ Fichier apparaît dans les Téléchargements Chrome
- ✅ Le fichier .mp4 peut être ouvert et lu

**Logs attendus** :
```
[download] Android Chrome without SW - using native Blob download
[download] Blob created, triggering native download: <filename> Size: <bytes> bytes
```

---

## Test Desktop (Chrome/Firefox/Edge)

### Prérequis
- Navigateur desktop moderne

### Étapes
1. Ouvrir l'app CHILLERS
2. Se connecter
3. Télécharger un film/épisode

### Vérifications
- ✅ StreamSaver avec MITM iframe fonctionne normalement
- ✅ Barre de progression native du navigateur
- ✅ Fichier enregistré dans le dossier Téléchargements
- ✅ Aucun changement de comportement par rapport à avant

**Logs attendus** :
```
(pas de log iOS ou Android, comportement normal StreamSaver)
```

---

## Backend - Vérification des headers

### Endpoint `/api/download/file`

**Log attendu dans la console backend** :
```
[Download File Proxy] Serving download with headers - Content-Disposition: attachment, filename: <filename>
```

**Headers HTTP à vérifier** (via Network tab du navigateur) :
- ✅ `Content-Disposition: attachment; filename="..."; filename*=UTF-8''...`
- ✅ `Content-Type: video/mp4` (ou type approprié)
- ✅ `Accept-Ranges: bytes`
- ✅ `Content-Length: <size>` (si disponible)

### Endpoint `/api/download/stream` (HLS → MP4)

**Log attendu dans la console backend** :
```
[Download Stream] Streaming HLS to MP4 with Content-Disposition: attachment, filename: <filename>
```

**Headers HTTP à vérifier** :
- ✅ `Content-Disposition: attachment; filename="..."; filename*=UTF-8''...`
- ✅ `Content-Type: video/mp4`
- ✅ `Cache-Control: no-cache`

---

## Résumé des changements

### ✅ Fichiers modifiés
1. `src/services/downloads.ts` - `triggerAttachmentDownload()` utilise maintenant `window.open()` avec auto-fermeture
2. `src/services/streamSaver.ts` - Logs de debugging pour iOS et Android
3. `src/hooks/useDownloadsBatch.ts` - Logs dans `launchReady()`
4. `backend/src/modules/download/download.routes.ts` - Logs de confirmation headers
5. `src/services/__tests__/download.test.ts` - Tests mis à jour pour `window.open()`

### 🎯 Comportement attendu

**iOS Safari** :
- `window.open()` ouvre un nouvel onglet
- Backend répond avec `Content-Disposition: attachment`
- Safari déclenche le téléchargement natif
- L'onglet se ferme automatiquement après 2s
- Le téléchargement continue en arrière-plan

**Android Chrome** :
- Avec SW : StreamSaver normal (pas de changement)
- Sans SW : Fallback Blob natif avec logs

**Desktop** :
- StreamSaver normal (pas de changement)
- MITM iframe fonctionne comme avant

### ⚠️ Points d'attention

1. **Geste utilisateur** : `window.open()` doit être appelé depuis un gestionnaire d'événement utilisateur direct (click, tap) sinon il sera bloqué par le navigateur
2. **Bloqueurs de popup** : Si bloqué, le fallback iframe est utilisé
3. **Un fichier par geste sur iOS** : Safari limite à un seul téléchargement par geste utilisateur
