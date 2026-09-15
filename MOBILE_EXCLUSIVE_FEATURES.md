# 📱 Fonctionnalités Exclusives à l'Application Mobile (Non faisables sur le Web)

Ce document répertorie l'ensemble des fonctionnalités et superpouvoirs natifs qu'une application mobile (**CHILLERS Mobile**) peut offrir, et qui sont impossibles ou extrêmement limités sur la version Web en raison des restrictions des navigateurs (sandbox, mémoire, sécurité, politique de mise en veille).

---

## 1. 💾 Véritable Téléchargement Hors-Ligne & Gestion du Stockage Physique — ✅ **IMPLÉMENTÉ**
* **Limitation Web :** Le stockage web (IndexedDB / CacheStorage) est soumis à des quotas arbitraires du navigateur (50 Mo - 500 Mo selon le navigateur) et est régulièrement purgé automatiquement lorsque le téléphone ou le PC manque d'espace disque. De plus, le web ne peut pas enregistrer de flux vidéo HLS/m3u8 dans le système de fichiers.
* **Avantage Mobile :**
  * **Téléchargement Physique Complet (.MP4) :** Enregistrement local sans aucune restriction de taille, utilisable à 100% en mode avion (dans les transports, les zones sans réseau ou à l'étranger).
  * **Double Emplacement de Stockage :**
    1. *Stockage Privé Sécurisé (In-App Sandbox)* : Les vidéos restent protégées au sein de l'application.
    2. *Exportation dans la Galerie / Dossier Téléchargements* : Permet à l'utilisateur de transférer ses films sur une clé USB ou carte SD via `DownloadService` et `DownloadForegroundService.kt`.
  * **Téléchargement en tâche de fond (Background Service)** même si l'application est minimisée ou si l'écran est éteint.

---

## 2. 🔲 Mode Picture-in-Picture (PiP) Flottant Système — ✅ **IMPLÉMENTÉ**
* **Limitation Web :** Le PiP web ne fonctionne que dans l'onglet actif et se coupe fréquemment dès qu'on change d'application ou qu'on verrouille l'écran sur mobile.
* **Avantage Mobile :**
  * Le flux vidéo ou le match de foot en direct continue de tourner dans une petite fenêtre flottante déplaçable au-dessus de **WhatsApp, Instagram, TikTok ou Google Maps** via `NativeBridge.enterPipMode()`.
  * Contrôles rapides (Play, Pause, Fermer) directement sur la fenêtre flottante.

---

## 3. 👆 Contrôles Gestuels Tactiles Professionnels (Style VLC / Netflix / MX Player) — ✅ **IMPLÉMENTÉ**
* **Limitation Web :** Le navigateur intercepte les gestes tactiles (défilement de page, zoom de page, pull-to-refresh) ce qui rend les contrôles gestuels fluides impossibles.
* **Avantage Mobile :**
  * **Glissement vertical sur la gauche de l'écran :** Réglage instantané de la luminosité de l'écran sans passer par le panneau Android/iOS (`NativeBridge.setScreenBrightness`).
  * **Glissement vertical sur la droite de l'écran :** Réglage du volume audio matériel (`NativeBridge.setVolume`).
  * **Double-Tap gauche / droite :** Saut rapide de +10s / -10s avec animation ripple.
  * **Aspect Ratio & Zoom :** Bascule instantanée entre formats d'image (Original, Zoom Plein Écran 18:9 / 20:9 sans bandes noires, Étiré).

---

## 4. 🔔 Notifications Push Natives en Temps Réel — ✅ **IMPLÉMENTÉ**
* **Limitation Web :** Les notifications Web Push sont souvent bloquées par les navigateurs et ont un taux de délivrabilité très faible.
* **Avantage Mobile :**
  * **Alertes Matchs en Direct :** Rappel planifié avec son et vibration (`NotificationService.scheduleMatchReminder`) 15 minutes avant le coup d'envoi.
  * **Nouveaux Épisodes & Téléchargements terminés :** Notifications locales et push instantanées.

---

## 5. 🔒 Mode Verrouillage de l'Écran (Screen Lock / Child Lock) — ✅ **IMPLÉMENTÉ**
* **Limitation Web :** Impossible d'interdire les clics ou les gestes système du navigateur.
* **Avantage Mobile :**
  * Bouton "Cadenas" dans `AppVideoPlayer` qui désactive toutes les interactions tactiles pendant le visionnage.

---

## 6. 📺 Détection et Diffusion TV Native (Google Cast / Smart TV / DLNA) — ✅ **IMPLÉMENTÉ**
* **Limitation Web :** Dépend du navigateur Chrome pour Chromecast; ne fonctionne pas sur la majorité des navigateurs mobiles.
* **Avantage Mobile :**
  * Scanner automatique SSDP Multicast (`CastService`) avec verrouillage Wi-Fi `MulticastLock`.
  * Détection des Smart TV (Samsung Tizen, LG webOS, Sony Bravia, Android TV, Roku).
  * Modale de télécommande intégrée (`CastModal`) avec contrôle du volume TV, Play/Pause et redirection externe (VLC / MX Player).

---

## 7. 🎧 Contrôle Multimédia en Arrière-Plan & Écran de Verrouillage — ✅ **IMPLÉMENTÉ**
* **Avantage Mobile :**
  * Intégration MediaSession / AudioService pour le contrôle de lecture en arrière-plan.

---

## 8. ⚡ Décodage Matériel Haute Performance (libmpv / ExoPlayer) — ✅ **IMPLÉMENTÉ**
* **Avantage Mobile :**
  * Accès direct au décodage matériel GPU via `media_kit` (libmpv) et `video_player` (ExoPlayer).

---

## 9. 📳 Retour Haptique Immersif (Vibrations Subtiles) — ✅ **IMPLÉMENTÉ**
* **Avantage Mobile :**
  * Vibrations haptiques légères, moyennes et sélection (`NativeBridge.lightHaptic`, `mediumHaptic`, `selectionHaptic`) sur toutes les actions clés.

---

## 10. 🔐 Authentification Biométrique (Empreinte Digitale / Face ID) — ✅ **IMPLÉMENTÉ**
* **Avantage Mobile :**
  * Connexion instantanée via `LocalAuth` (Touch ID, Face ID, Empreinte digitale) dans `BiometricService` et `ProfileScreen`.
