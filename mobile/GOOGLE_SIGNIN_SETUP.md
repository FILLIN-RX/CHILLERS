# Google Sign-In Setup pour Chillers Mobile

L'intégration Google Sign-In est maintenant prête! Voici les étapes pour la configurer correctement.

## Configuration Requise

### 1. Web Client ID ✅
- **Web Client ID**: `215274091436-goperpshmrj7hhr5ou8hio17npi12l8d.apps.googleusercontent.com`
- Déjà configuré dans `lib/screens/auth/auth_screen.dart`

### 2. Configuration Android

#### Étape 1: Obtenir le SHA-1 de votre clé de debug
```bash
cd android && ./gradlew signingReport
```

Cherche la ligne `SHA1` sous `debugAndroidApp`. Elle ressemble à:
```
SHA1: AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12
```

#### Étape 2: Ajouter la clé OAuth à Google Cloud
1. Va sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionne ton projet
3. Credentials → Create Credentials → OAuth Client ID
4. Type: Android
5. Package name: `com.chillers.chillers_mobile`
6. SHA-1 fingerprint: Colle le SHA-1 que tu viens d'obtenir
7. Clique "Create"

#### Étape 3: Configuration de l'app Flutter
Ajoute au `android/app/build.gradle.kts`:
```gradle
defaultConfig {
    // ...
    manifestPlaceholders = [
        "com.google.android.gms.version": "@integer/google_play_services_version"
    ]
}
```

### 3. Configuration iOS

#### Étape 1: Pod install
```bash
cd ios && pod install --repo-update && cd ..
```

#### Étape 2: Ajouter URL Scheme
1. Ouvre `ios/Runner/Info.plist`
2. Ajoute cette section:
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.215274091436-goperpshmrj7hhr5ou8hio17npi12l8d</string>
    </array>
  </dict>
</array>
```

#### Étape 3: Ajouter Google Sign-In au Podfile
Le package `google_sign_in` ajoute automatiquement la dépendance.

### 4. Configuration Web (Desktop/Linux)

Pour tester sur Linux/Desktop, le Web Client ID est utilisé. Aucune configuration supplémentaire n'est nécessaire.

## Architecture

### Backend Endpoint
- **Route**: `POST /api/auth/google`
- **Payload**:
  ```json
  {
    "email": "user@example.com",
    "username": "user_name",
    "avatarUrl": "https://...",
    "deviceId": "uuid-v4",
    "deviceName": "Mobile App"
  }
  ```
- **Réponse**:
  ```json
  {
    "success": true,
    "token": "jwt_token",
    "user": { /* user object */ }
  }
  ```

### Mobile Implementation
- **Service**: `lib/services/api_service.dart` → `googleLogin()`
- **UI**: `lib/screens/auth/auth_screen.dart` → Bouton Google
- **Logic**: `_handleGoogleLogin()` déclenche Google Sign-In popup

### Flux Utilisateur
1. User clique "Continuer avec Google"
2. Google Sign-In popup s'ouvre
3. User sélectionne/connecte un compte Google
4. Google retourne: email, displayName, photoUrl
5. App génère un UUID pour deviceId
6. API envoie au backend
7. Backend crée ou met à jour l'utilisateur
8. JWT token retourné et sauvegardé localement
9. App navigue vers home screen

## Troubleshooting

### "Sign in failed" sur Android
- Vérifie que le SHA-1 est correct et configuré dans Google Cloud
- Vérifie que `com.chillers.chillers_mobile` est le bon package name

### "Missing scopes" ou "Permission denied"
- Assure-toi que `google_sign_in` a les bonnes permissions dans AndroidManifest.xml
- Le package ajoute automatiquement les permissions requises

### Web Client ID invalide
- Copie exactement: `215274091436-goperpshmrj7hhr5ou8hio17npi12l8d.apps.googleusercontent.com`
- Vérifie qu'il n'y a pas d'espaces supplémentaires

## Commandes de Test

### Linux/Desktop
```bash
flutter run -d linux
```

### Android
```bash
# Assure-toi que tu as un émulateur ou device connecté
flutter run -d android
```

### iOS
```bash
flutter run -d ios
```

## Ressources

- [Google Sign-In for Flutter](https://pub.dev/packages/google_sign_in)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Android OAuth Setup](https://developers.google.com/identity/protocols/oauth2/native-app)
