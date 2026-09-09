# 📱 Fonctionnalités Exclusives à l'Application Mobile (Non faisables sur le Web)

Ce document répertorie l'ensemble des fonctionnalités et superpouvoirs natifs qu'une application mobile (**CHILLERS Mobile**) peut offrir, et qui sont impossibles ou extrêmement limités sur la version Web en raison des restrictions des navigateurs (sandbox, mémoire, sécurité, politique de mise en veille).

---

## 1. 💾 Véritable Téléchargement Hors-Ligne & Gestion du Stockage Physique
* **Limitation Web :** Le stockage web (IndexedDB / CacheStorage) est soumis à des quotas arbitraires du navigateur (50 Mo - 500 Mo selon le navigateur) et est régulièrement purgé automatiquement lorsque le téléphone ou le PC manque d'espace disque. De plus, le web ne peut pas enregistrer de flux vidéo HLS/m3u8 dans le système de fichiers.
* **Avantage Mobile :**
  * **Téléchargement Physique Complet (.MP4) :** Enregistrement local sans aucune restriction de taille, utilisable à 100% en mode avion (dans les transports, les zones sans réseau ou à l'étranger).
  * **Double Emplacement de Stockage :**
    1. *Stockage Privé Sécurisé (In-App Sandbox)* : Les vidéos restent protégées au sein de l'application.
    2. *Exportation dans la Galerie / Dossier Téléchargements* : Permet à l'utilisateur de transférer ses films sur une clé USB ou carte SD.
  * **Téléchargement en tâche de fond (Background Service)** même si l'application est minimisée ou si l'écran est éteint.

---

## 2. 🔲 Mode Picture-in-Picture (PiP) Flottant Système
* **Limitation Web :** Le PiP web ne fonctionne que dans l'onglet actif et se coupe fréquemment dès qu'on change d'application ou qu'on verrouille l'écran sur mobile.
* **Avantage Mobile :**
  * Le flux vidéo ou le match de foot en direct continue de tourner dans une petite fenêtre flottante déplaçable au-dessus de **WhatsApp, Instagram, TikTok ou Google Maps**.
  * Contrôles rapides (Play, Pause, Fermer) directement sur la fenêtre flottante.

---

## 3. 👆 Contrôles Gestuels Tactiles Professionnels (Style VLC / Netflix / MX Player)
* **Limitation Web :** Le navigateur intercepte les gestes tactiles (défilement de page, zoom de page, pull-to-refresh) ce qui rend les contrôles gestuels fluides impossibles.
* **Avantage Mobile :**
  * **Glissement vertical sur la gauche de l'écran :** Réglage instantané de la luminosité de l'écran sans passer par le panneau Android/iOS.
  * **Glissement vertical sur la droite de l'écran :** Réglage du volume audio matériel.
  * **Double-Tap gauche / droite :** Saut rapide de +10s / -10s avec animation ripple.
  * **Pincement pour Zoomer (Pinch-to-Zoom / Aspect Ratio) :** Zoom instantané pour adapter les films au format panoramique (18:9, 19.5:9, 20:9) et supprimer les bandes noires latérales sur les écrans modernes OLED.

---

## 4. 🔔 Notifications Push Natives en Temps Réel (FCM / APNs)
* **Limitation Web :** Les notifications Web Push sont souvent bloquées par les navigateurs (notamment Safari iOS qui requiert une installation PWA manuelle complexe) et ont un taux de délivrabilité très faible.
* **Avantage Mobile :**
  * **Alertes Matchs en Direct :** Notification 15 minutes avant le coup d'envoi d'un match favori (*"Le match Real Madrid vs FC Barcelone va commencer !"*).
  * **Nouveaux Épisodes :** Alerte instantanée lors de la sortie d'un nouvel épisode d'une série ou d'un animé suivi.
  * **Alertes de Téléchargement :** Notification sonore et vibratoire dès qu'un téléchargement est terminé.

---

## 5. 🔒 Mode Verrouillage de l'Écran (Screen Lock / Child Lock)
* **Limitation Web :** Impossible d'interdire les clics ou les gestes système du navigateur.
* **Avantage Mobile :**
  * Bouton "Cadenas" qui désactive toutes les interactions tactiles sur l'écran pendant le visionnage.
  * Idéal pour regarder un film au lit ou laisser les enfants regarder sans risque de pause ou de changement de vidéo inopiné.

---

## 6. 📺 Détection et Diffusion TV Native (Google Cast / AirPlay / DLNA)
* **Limitation Web :** Dépend du navigateur Chrome pour Chromecast; ne fonctionne pas sur la majorité des navigateurs mobiles comme Firefox Mobile ou Safari sans matériel Apple.
* **Avantage Mobile :**
  * Scanner automatique des Smart TV (Samsung Tizen, LG webOS, Android TV, Apple TV, Fire TV) sur le réseau local Wi-Fi.
  * Télécommande intégrée dans l'application pour contrôler le volume, la timeline et les pistes audio de la TV depuis le téléphone.

---

## 7. 🎧 Contrôle Multimédia en Arrière-Plan & Écran de Verrouillage
* **Limitation Web :** Les navigateurs coupent l'audio/vidéo après quelques minutes d'inactivité en arrière-plan pour économiser l'énergie.
* **Avantage Mobile :**
  * Intégration avec `MediaSession` Android et iOS `NowPlayingInfo`.
  * Affichage de la pochette, du titre du film/match et de la barre de progression sur l'écran de verrouillage et le centre de contrôle du smartphone.

---

## 8. ⚡ Décodage Matériel Haute Performance (GPU Direct / MediaKit / ExoPlayer)
* **Limitation Web :** Le navigateur subit les limites du moteur de rendu HTML5 Canvas/Video et des limitations de codecs (certains profils H.265 / HEVC ou audio AC3/E-AC3 ne sont pas lus nativement par les navigateurs).
* **Avantage Mobile :**
  * Accès direct au décodage matériel GPU (libmpv / ExoPlayer / AVPlayer).
  * Lecture fluide de vidéos 4K 60fps et flux IPTV HLS / RTMP à faible latence sans faire chauffer le smartphone ni vider la batterie.
  * Support d'un éventail beaucoup plus large de codecs audio et vidéo.

---

## 9. 📳 Retour Haptique Immersif (Vibrations Subtiles)
* **Limitation Web :** L'API `navigator.vibrate` est désactivée sur iOS Safari et limitée sur Android.
* **Avantage Mobile :**
  * Vibrations haptiques légères lors du clic sur les boutons d'action (Téléchargement, Favoris, Like, Changement de serveur), offrant une sensation d'application native haut de gamme.

---

## 10. 🔐 Authentification Biométrique (Empreinte Digitale / Face ID)
* **Limitation Web :** WebAuthn nécessite des étapes de configuration et de clés de sécurité lourdes.
* **Avantage Mobile :**
  * Connexion instantanée et sécurisée via `LocalAuth` (Touch ID, Face ID, Empreinte digitale) pour protéger le profil ou les achats d'abonnements.
