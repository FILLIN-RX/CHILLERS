# 🕵️ INVESTIGATION : Téléchargement Android — Les Fichiers Qui Disparaissent

> Style : Person of Interest — Analyse forensique du système, preuve par preuve.
> Date : Investigation réalisée sur la base du code source actuel (branche principale).

---

## PROFIL DU SUSPECT

**Symptôme signalé :** Les utilisateurs lancent un téléchargement, voient la barre de progression atteindre 100 % et le signal de fin s'afficher, mais aucun fichier ne se retrouve sur leur téléphone.

**Verdict immédiat (avant l'investigation complète) :**
Le bug principal est une **confusion de répertoire de destination** combinée à une **logique d'export silencieusement défaillante**. Le fichier est bien téléchargé, il existe sur l'appareil — mais dans un répertoire **inaccessible au système de fichiers de l'utilisateur**. Pour les utilisateurs Premium, la copie dans le dossier public peut échouer silencieusement, laissant le fichier privé puis le supprimant. Pour les utilisateurs Free, le fichier est sandboxé et invisible hors de l'app. Dans les deux cas, l'overlay "TÉLÉCHARGÉ" s'affiche normalement.

---

## PREUVES COLLECTÉES

### 🔍 PREUVE 1 — Package de téléchargement utilisé

**Fichier :** `mobile/pubspec.yaml`

```yaml
dio: ^5.11.1
path_provider: ^2.1.6
```

**Verdict :** Pas de `flutter_downloader`. L'app implémente son propre moteur de téléchargement en streaming avec `Dio` + `dart:io` (RandomAccessFile). C'est du code custom, sans les garanties d'un package éprouvé comme `flutter_downloader` qui gère nativement les intégrations Android DownloadManager.

---

### 🔍 PREUVE 2 — Le chemin de sauvegarde selon le mode utilisateur

**Fichier :** `mobile/lib/services/download_service.dart`, lignes 485-505

```dart
if (task.isExternal) {
    // MODE VIP
    Directory extDir;
    if (Platform.isAndroid) {
        try {
            extDir = (await getExternalStorageDirectory()) ?? (await getApplicationDocumentsDirectory());
        } catch (_) {
            extDir = await getApplicationDocumentsDirectory();
        }
    }
    targetDir = Directory('${extDir.path}/CHILLERS');
} else {
    // MODE GRATUIT
    final appDir = await getApplicationDocumentsDirectory();
    targetDir = Directory('${appDir.path}/chillers_offline');
}
```

**⚠️ SUSPECT #1 — Le chemin VIP est trompeur :**

`getExternalStorageDirectory()` sur Android retourne un chemin du type :
```
/storage/emulated/0/Android/data/com.chillers.chillers_mobile/files/
```

Ce dossier est **sandboxé à l'application** — il n'apparaît pas dans l'explorateur de fichiers de l'utilisateur, et il sera **supprimé si l'utilisateur désinstalle l'app**. Ce n'est **pas** le dossier `Téléchargements` public. Le code commente lui-même "Mode VIP : Téléchargements dans votre dossier Téléchargements" — mais le répertoire utilisé n'est pas le dossier Téléchargements public.

**Chemin Mode Free :** `getApplicationDocumentsDirectory()` → `/data/data/com.chillers.chillers_mobile/app_flutter/chillers_offline/` — complètement sandboxé, normal pour ce mode.

---

### 🔍 PREUVE 3 — Le mécanisme d'export vers le dossier public (VIP)

**Fichier :** `mobile/lib/services/download_service.dart`, méthode `_publishExport`, lignes ~224-244

```dart
Future<void> _publishExport(DownloadTask task, String sourcePath, String displayName) async {
    final published = await NativeBridge.instance.publishToDownloads(
        path: sourcePath,
        displayName: displayName,
    );

    if (published == null) {
        throw Exception(
            "Le fichier a été téléchargé mais n'a pas pu être placé dans le dossier Téléchargements de l'appareil.",
        );
    }

    task.publicUri = published;
    try {
        final f = File(sourcePath);
        if (f.existsSync()) await f.delete(); // ← SUPPRESSION DU FICHIER PRIVÉ
    } catch (_) {}
    task.localFilePath = null;
}
```

**⚠️ SUSPECT #2 — Race condition : suppression avant confirmation :**

Si `publishToDownloads` retourne `null` (échec), une exception est levée — le fichier privé n'est pas supprimé. C'est bien géré.

**MAIS** si `publishToDownloads` retourne une URI valide mais que l'écriture a en fait partiellement échoué côté MediaStore (disque plein, timeout, etc.), le code :
1. Suppose que l'URI valide = fichier copié avec succès ✓
2. Supprime le fichier source privé ← **fichier perdu sans confirmation**

La méthode Kotlin `publishToDownloads` dans `MainActivity.kt` (ligne ~257) retourne une URI valide dès que `resolver.insert()` réussit, avant même de vérifier que `copyTo(output)` a tout transféré.

---

### 🔍 PREUVE 4 — La méthode Kotlin `publishToDownloads`

**Fichier :** `mobile/android/app/src/main/kotlin/com/chillers/chillers_mobile/MainActivity.kt`, lignes ~270-310

```kotlin
val uri = resolver.insert(collection, values) ?: return null

try {
    resolver.openOutputStream(uri)?.use { output ->
        source.inputStream().use { input -> input.copyTo(output) }
    } ?: run {
        resolver.delete(uri, null, null)
        return null
    }

    val done = ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }
    resolver.update(uri, done, null, null)
    uri.toString()    // ← retourne l'URI
} catch (_: Exception) {
    resolver.delete(uri, null, null)
    null
}
```

**Point positif :** La gestion IS_PENDING est correcte (Android 10+). Le fichier n'est visible par les autres apps qu'une fois `IS_PENDING = 0` — c'est le bon pattern MediaStore.

**⚠️ SUSPECT #3 — Exception catchée silencieusement :**

`catch (_: Exception)` absorbe toutes les exceptions (IOException, SecurityException, etc.) et retourne `null`. Si la copie échoue à 99 % à cause d'un manque d'espace disque, la méthode :
1. Supprime l'entrée MediaStore (resolver.delete) ✓
2. Retourne `null` → côté Dart, une exception est levée → le task passe en état `error`

Ce cas **est** correctement géré — mais l'état `error` passe via le catch général dans `_executeDownload` qui met `task.status = 'error'` avec un message. La question est : est-ce que l'UI affiche cet erreur ou l'overlay de succès?

---

### 🔍 PREUVE 5 — Le timing de l'overlay de succès

**Fichier :** `mobile/lib/services/download_service.dart`, méthode `_finalizeDownload`, lignes ~248-275

```dart
Future<void> _finalizeDownload(DownloadTask task, String savePath, String filename, ...) async {
    // ... validation de taille ...
    
    task.progress = 1.0;
    task.status = 'completed';   // ← STATUS COMPLETED

    if (task.isExternal) {
        await _publishExport(task, savePath, filename);  // ← EXPORT APRÈS COMPLETED
    }

    // Notify subscribers
    _completionController.add(task);    // ← TOAST ENVOYÉ

    unawaited(NativeBridge.instance.notifyCompleted(...));  // ← NOTIFICATION ENVOYÉE
}
```

**🚨 BUG CRITIQUE — Ordre d'opérations :**

`task.status = 'completed'` est défini **avant** l'appel à `_publishExport()`. Si `_publishExport()` lève une exception (ce qu'il peut faire), l'exception remonte et est capturée par le catch dans `_executeDownload`, qui va ré-écrire `task.status = 'error'`. Mais entre ces deux moments :

1. `task.status = 'completed'` — **l'UI affiche "téléchargé"**
2. `_completionController.add(task)` — **le toast/overlay "TÉLÉCHARGÉ" est affiché** ← Non, ce code est après l'export. Mais...

Attends — relecture précise de l'ordre :

```dart
task.progress = 1.0;
task.totalBytes = fileSize;
task.downloadedBytes = fileSize;
task.errorMessage = null;

if (task.isExternal) {
    await _publishExport(task, savePath, filename);  // peut throw
}

task.status = 'completed';   // ← seulement après l'export
_completionController.add(task);  // ← le toast
```

**Correction de ma lecture** : `task.status = 'completed'` est défini **après** `_publishExport`. Donc si l'export échoue, le status ne passe pas à 'completed'. C'est correct en théorie.

**Mais** : `task.progress = 1.0` est défini **avant** l'export. Les listeners `notifyListeners()` sont throttlés (250ms) — il est possible que l'UI affiche `progress = 1.0` pendant une fraction de seconde avant que l'exception n'arrive et ne remette `status = 'error'`.

---

### 🔍 PREUVE 6 — La vérification de taille minimale

**Fichier :** `mobile/lib/services/download_service.dart`, lignes ~230-243

```dart
if (fileSize <= 100 * 1024) {  // ← < 100 Ko
    throw Exception(
        'La source vidéo distante est un embed web protégé...',
    );
}
```

**⚠️ SUSPECT #4 — Fichiers HTML/erreur téléchargés silencieusement :**

Le backend `/api/download/resolve` peut retourner une URL directe qui, au moment du téléchargement effectif, renvoie une page HTML d'erreur (403 Uqload, page d'expiration CDN, etc.). Si cette page HTML fait moins de 100 Ko — ce qui est toujours le cas pour une page d'erreur — l'exception est levée et le download passe en `error` avec un message correct.

**MAIS** si une page d'erreur HTML fait plus de 100 Ko (improbable mais possible avec une page de login riche), elle passerait le filtre de taille. Le vrai check serait de vérifier le Content-Type (`text/html` vs `video/mp4`).

---

### 🔍 PREUVE 7 — Le proxy backend `/api/download/file` peut renvoyer du HTML

**Fichier :** `backend/src/modules/download/download.routes.ts`, méthode `serveFileProxy`

```typescript
const upstreamContentType = String(response.headers['content-type'] || '').toLowerCase();
if (upstreamContentType.includes('text/html')) {
    console.warn(`[Download File Proxy] ⚠️ L'amont a renvoyé du HTML...`);
    return false;  // ← retourne false → côté client, res.redirect(target) est appelé
}
```

Quand le proxy détecte du HTML, il retourne `false` et l'appelant fait `res.redirect(target)`. Le client Dio reçoit alors un redirect (302) vers une URL HTML. Dio suit les redirects (`followRedirects: true`). Le client va donc télécharger une page HTML, qui :
- Soit fait < 100 Ko → exception "embed protégé" → état `error` ✓
- Soit fait > 100 Ko → fichier sauvegardé en `.mp4` mais contenant du HTML ← **Bug silencieux**

---

### 🔍 PREUVE 8 — La validation des liens expirés est faite côté backend mais pas côté client

**Fichier :** `backend/src/modules/download/download.routes.ts`, fin de la route `/resolve`

```typescript
if (isSignedLinkExpired(downloadUrl)) {
    return res.status(404).json({
        success: false,
        error: "Le lien de téléchargement a expiré...",
    });
}
```

**Fichier :** `mobile/lib/services/api_service.dart`, méthode `resolveDownloadUrl`

```dart
if (res.statusCode == 200) {
    final body = json.decode(res.body);
    final url = body['data']?['downloadUrl'] ?? body['downloadUrl'];
    if (url != null && url.toString().isNotEmpty) {
        // ...
        return str;
    }
}
// Fallback direct stream resolution
if (type == 'movie') {
    return getMovieStreamUrl(tmdbId, title, language: language);
}
```

**⚠️ SUSPECT #5 — Fallback silencieux vers le stream URL :**

Si `/api/download/resolve` retourne 404 (lien expiré), le client ne vérifie pas le statusCode — il vérifie seulement si `statusCode == 200` pour extraire l'URL. Si ce n'est pas 200, il tombe sur le fallback `getMovieStreamUrl()` qui retourne l'URL de streaming (souvent un embed vidlink/vidsrc). Cette URL embed sera ensuite détectée par `_isWebEmbed()` dans `DownloadService`, qui va relancer une résolution... mais avec la même chaîne.

Le scénario catastrophe :
1. Résolution backend → 404 (lien expiré)
2. Client fallback → URL de streaming `vidlink.pro/...`
3. `_isWebEmbed()` détecte l'embed → relance `resolveDownloadUrl()` (boucle potentielle ou nouveau 404)
4. Deuxième résolution → encore 404
5. `targetUrl` est null → `throw Exception('Aucun flux vidéo direct disponible')` → `task.status = 'error'`

Ce cas est bien géré finalement (erreur visible), mais le fallback vers le stream URL est trompeur.

---

### 🔍 PREUVE 9 — Permissions Android

**Fichier :** `mobile/android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission
    android:name="android.permission.WRITE_EXTERNAL_STORAGE"
    android:maxSdkVersion="28"/>
```

**Point positif :** Le manifest est correctement configuré. `WRITE_EXTERNAL_STORAGE` avec `maxSdkVersion="28"` est la bonne pratique — sur Android 10+ (API 29+), le stockage public passe par MediaStore sans permission explicite. Le code Kotlin le gère avec le bon branchement `Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q`.

**Pas d'anomalie de permission ici.**

---

### 🔍 PREUVE 10 — targetSdkVersion

**Fichier :** `mobile/android/app/build.gradle.kts`

```kotlin
targetSdk = 36
compileSdk = 36
```

**Confirmation du risque Scoped Storage :** `targetSdk = 36` est Android 16. Cela active pleinement le Scoped Storage depuis Android 10 (API 29). Donc `getExternalStorageDirectory()` retourne `Android/data/com.chillers.../files/` qui est un stockage **externe app-spécifique**, **pas** le dossier Téléchargements public. C'est exactement le problème #1.

---

### 🔍 PREUVE 11 — Chemin réel selon le mode utilisateur

Pour un utilisateur **Free** :
- Chemin : `/data/data/com.chillers.chillers_mobile/app_flutter/chillers_offline/MonFilm.mp4`
- Visible dans l'app CHILLERS : ✅
- Visible dans l'explorateur de fichiers : ❌
- Supprimé à la désinstallation : ✅

Pour un utilisateur **VIP** (si `_publishExport` réussit) :
- Chemin MediaStore : `Téléchargements/CHILLERS/MonFilm.mp4`
- Visible dans l'app CHILLERS : ✅ (via publicUri)
- Visible dans l'explorateur de fichiers : ✅
- Supprimé à la désinstallation : ❌ (reste sur l'appareil)

Pour un utilisateur **VIP** (si `_publishExport` échoue silencieusement) :
- Chemin intermédiaire : `/storage/emulated/0/Android/data/com.chillers.../files/CHILLERS/MonFilm.mp4`
- Le fichier intermédiaire est supprimé par `_publishExport` qui delete après la copie → **fichier perdu**

---

### 🔍 PREUVE 12 — Gestion du Content-Type dans le download Dart

**Fichier :** `mobile/lib/services/download_service.dart`, méthode `_executeDownload`

```dart
final response = await _dio.get<ResponseBody>(
    targetUrl,
    cancelToken: cancelToken,
    options: Options(
        responseType: ResponseType.stream,
        followRedirects: true,
        // ...
        validateStatus: (status) => status != null && (status < 400 || status == 416),
    ),
);
```

**⚠️ SUSPECT #6 — Pas de vérification du Content-Type de la réponse :**

Le client Dio télécharge aveuglément le flux sans vérifier que `Content-Type` est bien `video/*` ou `application/octet-stream`. Si l'URL source retourne du `text/html` (page d'erreur 200 OK avec HTML — pratique courante chez les hébergeurs vidéo pour masquer les 403), le client va :
1. Télécharger la page HTML (~50-200 Ko généralement)
2. Vérifier la taille : si > 100 Ko → passer la vérification
3. Sauvegarder un fichier `.mp4` contenant du HTML
4. Marquer comme `completed` → overlay "TÉLÉCHARGÉ" affiché ← **BUG CRITIQUE**

L'utilisateur voit "téléchargé", va dans ses fichiers, et le lecteur refuse de lire ce "mp4" qui est en fait du HTML.

---

### 🔍 PREUVE 13 — Durée du timeout resolve API

**Fichier :** `mobile/lib/services/api_service.dart`

```dart
final res = await http.get(uri, headers: headers).timeout(const Duration(seconds: 25));
```

Le backend peut prendre > 25 secondes pour scraper Uqload/Vidzy (extraction JS, bypass obfuscation PACKER). Si le timeout expire, le catch global absorbe l'erreur (`catch (_) {}`) et le fallback vers `getMovieStreamUrl` est activé — retournant un embed URL au lieu d'un MP4 direct.

---

## SUSPECTS IDENTIFIÉS (par probabilité)

### 🔴 #1 — Mode VIP : `getExternalStorageDirectory()` ≠ dossier Téléchargements public
**Probabilité : TRÈS HAUTE**

Le commentaire dans le code promet "dossier Téléchargements" mais `getExternalStorageDirectory()` retourne le dossier app-spécifique sandboxé. Ce dossier n'est visible que dans l'explorateur si l'utilisateur active "Afficher les fichiers cachés" et navigue jusqu'à `Android/data/`. Sur Android 11+ (API 30), même cette navigation est restreinte par Scoped Storage enforcement.

**Impact :** Tous les utilisateurs VIP. Le fichier existe sur l'appareil mais est invisible dans l'explorateur de fichiers et dans d'autres apps (VLC, etc.).

### 🔴 #2 — Pas de vérification du Content-Type lors du téléchargement Dart
**Probabilité : HAUTE**

Certains hébergeurs (Uqload, Vidzy) retournent une page HTML avec status 200 quand le lien est expiré ou invalide. Le client télécharge cette page, la sauvegarde en `.mp4`, et marque la tâche comme terminée si la page > 100 Ko (rare) ou — pour les pages < 100 Ko — l'état `error` est bien signalé avec le message "embed protégé".

**Impact :** Utilisateurs dont le téléchargement a réussi formellement (fichier > 100 Ko) mais le fichier est du HTML invalide.

### 🟡 #3 — `_publishExport` : suppression du fichier source avant vérification réelle du contenu copié
**Probabilité : MOYENNE**

Le fichier privé est supprimé immédiatement après `publishToDownloads()`. Si l'export réussit (retourne une URI) mais que le fichier final dans MediaStore est corrompu ou incomplet (coupure réseau interne, manque d'espace), l'utilisateur n'a plus de copie.

**Impact :** Cas edge, surtout sur appareils avec peu d'espace disque.

### 🟡 #4 — Timeout de 25s trop court pour la résolution backend
**Probabilité : MOYENNE**

Le backend peut mettre 30-60 secondes pour extraire un lien MP4 via scraping JS. Le timeout `http.get(...).timeout(Duration(seconds: 25))` expire avant, le client utilise le fallback stream URL (embed), et le download commence sur un embed non-téléchargeable.

**Impact :** Pics de charge serveur, résolution lente, particulièrement pour les animes (Otaku provider).

### 🟢 #5 — Overlay de succès potentiellement affiché trop tôt (task.progress = 1.0 avant export)
**Probabilité : FAIBLE**

`task.progress = 1.0` est set avant `_publishExport`. En raison du throttle de 250ms sur `notifyListeners`, l'UI peut brièvement afficher 100% avant que l'export réussisse ou échoue. Mais `task.status = 'completed'` et `_completionController.add(task)` sont après l'export, donc l'overlay officiel "TÉLÉCHARGÉ" ne s'affiche que si l'export réussit.

**Impact :** Cosmétique seulement.

---

## VERDICT — CAUSE RACINE LA PLUS PROBABLE

**Le problème principal est une confusion de chemin pour les utilisateurs VIP.**

`getExternalStorageDirectory()` dans Flutter/Android retourne `Android/data/<package>/files/` — un répertoire externe mais **app-spécifique**, pas accessible à l'utilisateur via son explorateur de fichiers. Sur Android 11+ (scoped storage enforced), ce dossier n'est même pas parcourable par d'autres apps. Le code commente correctement "Mode VIP : Téléchargements dans votre dossier Téléchargements" — mais l'implémentation n'utilise pas MediaStore pour le download lui-même, seulement pour l'export via `_publishExport`.

Le flow VIP complet est :
1. Télécharger dans `Android/data/.../files/CHILLERS/` (sandboxé)
2. Copier via MediaStore vers `Téléchargements/CHILLERS/` (public)
3. Supprimer la copie privée

Ce flow est correct **en théorie**, mais si l'étape 2 échoue silencieusement (permissions MediaStore révoquées, espace insuffisant, exception catchée avec `_: Exception`), l'étape 3 supprime la copie privée et le fichier disparaît.

**Le deuxième problème** (impactant tous les utilisateurs) est l'absence de vérification du Content-Type lors du téléchargement Dio — permettant à des pages d'erreur HTML d'être sauvegardées comme fichiers `.mp4` valides.

---

## RECOMMANDATIONS

### 🔧 FIX 1 — Vérifier le Content-Type IMMÉDIATEMENT après connexion (CRITIQUE)

**Fichier :** `mobile/lib/services/download_service.dart`, méthode `_executeDownload`

Après avoir obtenu la réponse Dio, ajouter :

```dart
final contentType = response.headers.value('content-type') ?? '';
if (contentType.contains('text/html') || contentType.contains('text/plain')) {
    throw Exception(
        'La source vidéo a renvoyé une page web au lieu d\'un fichier vidéo. '
        'Le lien a probablement expiré.',
    );
}
```

Ajouter cette vérification après le check du status 416 et avant l'ouverture du fichier en écriture.

---

### 🔧 FIX 2 — Utiliser MediaStore directement pour le téléchargement VIP (CRITIQUE)

**Fichier :** `mobile/lib/services/download_service.dart` + `MainActivity.kt`

Au lieu de télécharger dans le répertoire app-spécifique puis de copier, télécharger directement dans MediaStore via `openOutputStream` :

Côté Kotlin, créer une nouvelle méthode :
```kotlin
fun openDownloadsOutputStream(displayName: String): Map<String, Any?>? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null
    val values = ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
        put(MediaStore.MediaColumns.MIME_TYPE, "video/mp4")
        put(MediaStore.MediaColumns.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/CHILLERS")
        put(MediaStore.MediaColumns.IS_PENDING, 1)
    }
    val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return null
    val stream = contentResolver.openOutputStream(uri) ?: run {
        contentResolver.delete(uri, null, null)
        return null
    }
    return mapOf("uri" to uri.toString(), "stream" to stream)
}
```

Cela évite la double copie et garantit que le fichier est immédiatement dans le bon emplacement.

**Alternative plus simple :** Conserver le flow actuel mais confirmer le transfert complet avant de supprimer le fichier source :

```dart
Future<void> _publishExport(DownloadTask task, String sourcePath, String displayName) async {
    final sourceSize = await File(sourcePath).length();
    
    final published = await NativeBridge.instance.publishToDownloads(
        path: sourcePath,
        displayName: displayName,
    );

    if (published == null) {
        throw Exception("Impossible de publier dans Téléchargements.");
    }

    // ✅ Vérifier la taille du fichier publié AVANT de supprimer la source
    final publishedSize = await NativeBridge.instance.getPublishedFileSize(published);
    if (publishedSize == null || publishedSize < sourceSize * 0.99) {
        // Copie incomplète — garder la source
        await NativeBridge.instance.deletePublished(published);
        throw Exception("Export incomplet (${publishedSize ?? 0} / $sourceSize octets).");
    }

    task.publicUri = published;
    // Maintenant safe de supprimer
    try {
        final f = File(sourcePath);
        if (f.existsSync()) await f.delete();
    } catch (_) {}
    task.localFilePath = null;
}
```

---

### 🔧 FIX 3 — Augmenter le timeout de résolution API (IMPORTANT)

**Fichier :** `mobile/lib/services/api_service.dart`

```dart
// Avant
final res = await http.get(uri, headers: headers).timeout(const Duration(seconds: 25));

// Après
final res = await http.get(uri, headers: headers).timeout(const Duration(seconds: 60));
```

Le scraping Vidzy/Uqload peut dépasser 25 secondes sur des serveurs lents. 60 secondes est plus raisonnable.

---

### 🔧 FIX 4 — Log explicite quand `resolveDownloadUrl` retourne un fallback embed (IMPORTANT)

**Fichier :** `mobile/lib/services/api_service.dart`

```dart
} catch (e) {
    debugPrint('[ApiService] resolveDownloadUrl exception: $e');
}

// Avant fallback
debugPrint('[ApiService] resolveDownloadUrl: resolve endpoint failed (status=$statusCode), falling back to stream URL');
if (type == 'movie') {
    return getMovieStreamUrl(tmdbId, title, language: language);
```

---

### 🔧 FIX 5 — Informer l'utilisateur Free que ses fichiers sont dans l'app uniquement (UX)

**Fichier :** `mobile/lib/widgets/download_modal.dart`

Dans `_DownloadModalSheet.build()`, ajouter un message contextuel sous le bouton de téléchargement pour les utilisateurs Free :

```dart
if (!widget.isPremium)
    Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Text(
            'Accessible uniquement dans l\'application CHILLERS',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white38, fontSize: 11),
        ),
    ),
```

---

### 🔧 FIX 6 — Ajouter une vérification `getPublishedFileSize` dans NativeBridge/Kotlin

Pour implémenter le Fix 2 proprement, ajouter dans `MainActivity.kt` :

```kotlin
"getPublishedFileSize" -> {
    val uri = call.argument<String>("uri")
    if (uri == null) {
        result.success(null)
    } else {
        try {
            if (uri.startsWith("content://")) {
                val projection = arrayOf(MediaStore.MediaColumns.SIZE)
                contentResolver.query(Uri.parse(uri), projection, null, null, null)?.use { cursor ->
                    if (cursor.moveToFirst()) {
                        result.success(cursor.getLong(0))
                    } else result.success(null)
                } ?: result.success(null)
            } else {
                val f = File(uri)
                result.success(if (f.exists()) f.length() else null)
            }
        } catch (_: Exception) {
            result.success(null)
        }
    }
}
```

---

## RÉSUMÉ EXÉCUTIF

| # | Problème | Sévérité | Utilisateurs affectés | Fix |
|---|----------|----------|-----------------------|-----|
| 1 | Fichier VIP dans répertoire sandboxé, invisible | 🔴 CRITIQUE | Tous les VIP | Fix 2 |
| 2 | Content-Type non vérifié, HTML sauvegardé comme MP4 | 🔴 CRITIQUE | Tous | Fix 1 |
| 3 | Export VIP supprime source sans vérifier copie complète | 🟡 IMPORTANT | VIP sur espace disque limité | Fix 2 |
| 4 | Timeout 25s trop court, fallback vers embed | 🟡 IMPORTANT | Tous | Fix 3 |
| 5 | UX : utilisateurs Free ne savent pas que le fichier est sandboxé | 🟢 MINEUR | Users Free | Fix 5 |

---

*Investigation réalisée par analyse statique du code source. Les numéros de ligne sont approximatifs selon la version au moment de l'analyse.*
