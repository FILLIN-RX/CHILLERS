# Guide d'installation des fichiers audio

## Location des fichiers audio

Les fichiers audio doivent être placés dans le répertoire:
```
mobile/assets/sounds/
```

## Fichiers requis

### 1. `success.mp3`
- **Durée:** 100-300 ms
- **Type:** Son positif/triomphant
- **Utilisé pour:** Like/Favorite actions
- **Format:** MP3 ou WAV
- **Niveau de volume:** -6dB à -3dB

Suggestions:
- Un "ding" haut et clair
- Une tonalité positive
- Exemple: Utilisez un synthesizer pour générer une note haute (ex: C6 ou D6)

### 2. `add.mp3`
- **Durée:** 100-300 ms
- **Type:** Son distinct/notifications
- **Utilisé pour:** Ajouter à playlist actions
- **Format:** MP3 ou WAV
- **Niveau de volume:** -6dB à -3dB

Suggestions:
- Un "pop" ou "chord" léger
- Une tonalité différente du success.mp3
- Exemple: Deux notes (ex: C4 + E4 en accord)

## Instructions de création audio

### Option 1: Utiliser une ressource en ligne gratuite
1. Allez sur [freesound.org](https://freesound.org)
2. Cherchez "success sound" ou "notification sound"
3. Téléchargez les fichiers MP3 courts
4. Renommez-les en `success.mp3` et `add.mp3`
5. Placez-les dans `mobile/assets/sounds/`

### Option 2: Générer avec un synthesizer (Recomendé)
1. Utilisez [bfxr](https://www.bfxr.net/) - outil de génération de sons rétro
   - Perfect pour les petits effets sonores
   - Export en MP3
   
2. Ou utilisez [jsfxr](https://sfxr.me/) - version web
   - Entièrement gratuit
   - Pas d'installation requise

### Option 3: Utiliser FFmpeg (pour générer des tonalités)
```bash
# Générer success.mp3 (note C6 - 1047 Hz)
ffmpeg -f lavfi -i sine=f=1047:d=0.2 -b:a 192k success.mp3

# Générer add.mp3 (chord C4+E4)
ffmpeg -f lavfi -i sine=f=262:d=0.15 -b:a 192k temp.mp3
# Puis mélanger avec la note E4 (330 Hz)
```

### Option 4: Utiliser Audacity (Application gratuite)
1. Téléchargez [Audacity](https://www.audacityteam.org/)
2. Générer → Tones
3. Créez une tonalité simple (100-300ms)
4. Export en MP3
5. Répétez pour add.mp3 avec une fréquence différente

## Vérification de la structure

Après avoir ajouté les fichiers, votre structure doit être:
```
mobile/
├── assets/
│   ├── sounds/
│   │   ├── success.mp3
│   │   └── add.mp3
│   ├── logo.png
│   ├── brand/
│   └── posters/
├── pubspec.yaml
└── ...
```

## Prochaines étapes

1. **Placez les fichiers audio** dans `mobile/assets/sounds/`
2. **Vérifiez pubspec.yaml** que le dossier assets/sounds/ est déclaré
3. **Exécutez les commandes:**
   ```bash
   cd mobile
   flutter pub get
   flutter clean
   flutter pub get
   ```

4. **Testez sur appareil physique:**
   ```bash
   flutter run
   ```
   
   > ⚠️ **Note:** Les vibrations haptic ne fonctionnent QUE sur appareil physique, pas sur émulateur

5. **Vérifiez le fonctionnement:**
   - Appuyez sur le bouton "Like" → Vous devez sentir la vibration ET entendre le son
   - Ajouter à playlist → Vous devez sentir la vibration ET entendre un son différent
   - Scroll dans les sections media → Vous devez sentir des vibrations légères

## Dépannage

### Les sons ne jouent pas
1. Vérifiez que les fichiers sont bien dans `mobile/assets/sounds/`
2. Vérifiez le chemin dans `feedback_service.dart` : `AssetSource('sounds/success.mp3')`
3. Vérifiez que pubspec.yaml contient `assets: - assets/sounds/`
4. Exécutez `flutter pub get` et `flutter clean`

### Pas de vibration
1. Testez sur appareil physique (pas d'émulateur)
2. Vérifiez que la vibration est activée dans les paramètres du téléphone
3. Vérifiez les permissions dans AndroidManifest.xml (doit inclure `VIBRATE`)

### Erreurs de compilation
1. Assurez-vous que `audioplayers: ^5.2.0` est dans pubspec.yaml
2. Assurez-vous que `visibility_detector: ^0.7.0` est dans pubspec.yaml
3. Exécutez `flutter pub get`

## Personnalisation ultérieure

### Réduire le volume
Si les sons sont trop forts, vous pouvez réduire le volume dans `feedback_service.dart`:
```dart
await _audioPlayer.setVolume(0.5); // Réduire à 50% du volume
```

### Désactiver le feedback utilisateur
Pour permettre aux utilisateurs de désactiver le feedback:
```dart
// À ajouter dans settings/preferences
bool hapticEnabled = true;
bool audioEnabled = true;

void feedbackLike() async {
  if (hapticEnabled) await hapticMedium();
  if (audioEnabled) await playSuccessSound();
}
```

## Ressources recommandées

- **Sounds:**
  - https://freesound.org/ (Gratuit, CC License)
  - https://www.zapsplat.com/ (Gratuit)
  - https://mixkit.co/free-sound-effects/notification/ (Gratuit)

- **Outils de création:**
  - https://www.bfxr.net/ (Rétro Sound Generator - Gratuit)
  - https://sfxr.me/ (Web Version - Gratuit)
  - https://www.audacityteam.org/ (Audio Editor - Gratuit)

- **Documentation:**
  - https://pub.dev/packages/audioplayers (AudioPlayers Docs)
  - https://api.flutter.dev/flutter/services/HapticFeedback-class.html (HapticFeedback Docs)

---

**Status:** ✅ Prêt pour intégration
**Dernière mise à jour:** 2024
