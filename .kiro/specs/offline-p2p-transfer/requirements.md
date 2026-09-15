# Requirements Document - Transfert Média P2P Hors Ligne

## Introduction

Cette fonctionnalité permet aux utilisateurs de l'application mobile CHILLERS de transférer des films et séries téléchargés entre deux appareils sans connexion Internet, en utilisant une communication peer-to-peer via NFC/QR Code pour l'appairage et Wi-Fi Direct pour le transfert rapide des fichiers. L'expérience doit être fluide, moderne et sans friction, similaire à AirDrop d'Apple.

## Glossary

- **Sender_Device**: L'appareil (Mobile: Android/iOS ou Desktop: Windows/Linux/macOS) qui possède le fichier média et initie le partage
- **Receiver_Device**: L'appareil (Mobile: Android/iOS ou Desktop: Windows/Linux/macOS) qui reçoit le fichier média
- **NFC_Service**: Service de communication Near Field Communication pour l'appairage des appareils (Mobile uniquement)
- **QR_Generator**: Composant générant le QR code contenant les informations de connexion
- **QR_Scanner**: Composant scannant le QR code pour récupérer les informations de connexion
- **WiFi_Direct_Manager**: Service gérant la connexion Wi-Fi Direct peer-to-peer (Mobile)
- **Connection_Manager**: Gestionnaire unifié de connexion (Wi-Fi Direct pour Mobile OU Local Network pour Desktop)
- **Local_HTTP_Server**: Serveur HTTP éphémère créé sur le Sender_Device pour servir le fichier
- **Transfer_Manager**: Composant orchestrant le transfert de fichiers en chunks
- **Integrity_Checker**: Composant vérifiant l'intégrité du fichier via SHA-256
- **Media_Library**: Base de données locale contenant les médias téléchargés avec métadonnées
- **Transfer_UI**: Interface utilisateur affichant la progression et l'état du transfert
- **Connection_Credentials**: Objet contenant SSID, mot de passe, IP et port pour la connexion
- **Media_Chunk**: Fragment de fichier média de taille fixe pour le transfert progressif
- **Transfer_Session**: Session active de transfert entre deux appareils
- **Platform_Detector**: Service détectant la plateforme d'exécution (Android/iOS/Windows/Linux/macOS)
- **Subscription_Tier**: Niveau d'abonnement (FREE ou PRO)
- **Transfer_Quota**: Nombre de partages restants pour un utilisateur FREE

## Requirements

### Requirement 1: Sélection et Partage de Média

**User Story:** En tant qu'utilisateur possédant un média téléchargé, je veux pouvoir sélectionner ce média et initier un partage hors ligne, afin de le transférer à un ami sans utiliser Internet.

#### Acceptance Criteria

1. WHEN un utilisateur ouvre un média téléchargé, THE Media_Library SHALL afficher un bouton "Partager Hors Ligne"
2. WHEN l'utilisateur clique sur "Partager Hors Ligne", THE Transfer_Manager SHALL vérifier que le fichier média existe localement
3. IF le fichier média n'existe pas localement, THEN THE Transfer_UI SHALL afficher un message d'erreur "Média non disponible hors ligne"
4. WHEN le fichier est confirmé disponible, THE Transfer_Manager SHALL initier le mode émetteur
5. THE Transfer_UI SHALL afficher les options d'appairage (NFC et QR Code) sur le Sender_Device

### Requirement 2: Appairage par NFC

**User Story:** En tant qu'utilisateur émetteur, je veux pouvoir taper mon téléphone contre celui du destinataire pour transférer automatiquement les informations de connexion, afin d'établir rapidement une connexion sans saisie manuelle.

#### Acceptance Criteria

1. WHEN le mode émetteur est activé, THE NFC_Service SHALL vérifier la disponibilité du matériel NFC
2. WHERE le matériel NFC est disponible, THE NFC_Service SHALL activer l'émission NFC
3. WHEN le Sender_Device génère les Connection_Credentials, THE WiFi_Direct_Manager SHALL créer un point d'accès Wi-Fi Direct avec SSID unique et mot de passe aléatoire
4. WHEN les Connection_Credentials sont prêts, THE NFC_Service SHALL encoder les informations (SSID, mot de passe, IP locale, port) au format NDEF
5. WHEN un Receiver_Device entre en contact NFC, THE NFC_Service SHALL transmettre les Connection_Credentials en moins de 2 secondes
6. WHEN le Receiver_Device reçoit les Connection_Credentials via NFC, THE WiFi_Direct_Manager SHALL automatiquement initier la connexion Wi-Fi Direct
7. WHERE le sender est un Desktop, THE NFC_Service SHALL être désactivé (pas de NFC sur PC)

### Requirement 3: Appairage par QR Code

**User Story:** En tant qu'utilisateur émetteur dont l'appareil ne possède pas de NFC, je veux générer un QR code contenant les informations de connexion, afin que le destinataire puisse le scanner et se connecter.

#### Acceptance Criteria

1. WHEN le mode émetteur est activé, THE QR_Generator SHALL être affiché par défaut si le NFC n'est pas disponible
2. WHEN l'utilisateur choisit l'option QR Code, THE QR_Generator SHALL créer un QR code contenant les Connection_Credentials (SSID, mot de passe, IP, port)
3. THE QR_Generator SHALL afficher le QR code avec une animation fluide et un design moderne
4. WHEN le Receiver_Device scanne le QR code, THE QR_Scanner SHALL extraire les Connection_Credentials
5. WHEN les Connection_Credentials sont extraites, THE WiFi_Direct_Manager SHALL automatiquement initier la connexion Wi-Fi Direct
6. THE Transfer_UI SHALL afficher un indicateur visuel "En attente de scan" pendant l'affichage du QR code
7. WHERE le receiver est un Desktop, THE QR_Scanner SHALL utiliser la webcam pour scanner le QR Code
8. IF la webcam n'est pas disponible, THEN THE QR_Scanner SHALL permettre l'upload d'une image du QR Code
9. WHERE le receiver est un Desktop, THE Transfer_UI SHALL proposer l'entrée d'un code manuel à 6 chiffres
10. WHEN le sender génère le QR Code, THE QR_Generator SHALL également afficher le code manuel à 6 chiffres

### Requirement 4: Établissement de la Connexion Wi-Fi Direct

**User Story:** En tant qu'utilisateur récepteur, je veux que mon appareil se connecte automatiquement au point d'accès Wi-Fi Direct de l'émetteur après l'appairage, afin d'éviter toute configuration manuelle.

#### Acceptance Criteria

1. WHEN le Receiver_Device reçoit les Connection_Credentials, THE WiFi_Direct_Manager SHALL désactiver temporairement la connexion Wi-Fi actuelle
2. THE WiFi_Direct_Manager SHALL se connecter au réseau Wi-Fi Direct en utilisant le SSID et le mot de passe fournis
3. THE WiFi_Direct_Manager SHALL établir la connexion en moins de 10 secondes
4. IF la connexion échoue après 3 tentatives, THEN THE Transfer_UI SHALL afficher un message d'erreur "Impossible de se connecter"
5. WHEN la connexion est établie, THE Transfer_Manager SHALL notifier les deux appareils du succès de la connexion
6. THE Transfer_UI SHALL afficher un indicateur de connexion réussie sur les deux appareils

### Requirement 5: Transfert de Fichier par Serveur HTTP Local

**User Story:** En tant qu'utilisateur émetteur, je veux que mon appareil serve le fichier média via un serveur local, afin que le destinataire puisse le télécharger rapidement.

#### Acceptance Criteria

1. WHEN la connexion Wi-Fi Direct est établie, THE Local_HTTP_Server SHALL démarrer sur le Sender_Device
2. THE Local_HTTP_Server SHALL écouter sur un port disponible entre 8000 et 9000
3. THE Local_HTTP_Server SHALL servir le fichier média en chunks de 1 MB
4. WHEN le Receiver_Device envoie une requête HTTP GET, THE Local_HTTP_Server SHALL répondre avec les en-têtes appropriés (Content-Length, Content-Type, Accept-Ranges)
5. THE Local_HTTP_Server SHALL supporter les reprises de téléchargement via Range Requests
6. WHEN le transfert est terminé ou annulé, THE Local_HTTP_Server SHALL s'arrêter automatiquement

### Requirement 6: Téléchargement et Assemblage sur le Récepteur

**User Story:** En tant qu'utilisateur récepteur, je veux que mon appareil télécharge le fichier média en chunks et l'assemble automatiquement, afin d'obtenir un fichier complet et fonctionnel.

#### Acceptance Criteria

1. WHEN la connexion est établie, THE Transfer_Manager SHALL récupérer les métadonnées du média (titre, affiche, durée, sous-titres)
2. WHEN le téléchargement démarre, THE Transfer_Manager SHALL télécharger le fichier en Media_Chunks de 1 MB
3. THE Transfer_Manager SHALL maintenir un débit minimum de 10 Mo/s et un débit cible de 20-60 Mo/s
4. WHEN un Media_Chunk est téléchargé, THE Transfer_Manager SHALL le sauvegarder temporairement dans un dossier cache
5. THE Transfer_Manager SHALL assembler les Media_Chunks dans l'ordre correct
6. IF un Media_Chunk échoue au téléchargement, THEN THE Transfer_Manager SHALL réessayer jusqu'à 3 fois avant de signaler une erreur

### Requirement 7: Affichage de la Progression du Transfert

**User Story:** En tant qu'utilisateur (émetteur ou récepteur), je veux voir la progression du transfert en temps réel avec des métriques détaillées, afin de savoir combien de temps il reste.

#### Acceptance Criteria

1. WHEN un Transfer_Session est actif, THE Transfer_UI SHALL afficher le pourcentage de progression (0-100%)
2. THE Transfer_UI SHALL afficher la vitesse de transfert actuelle en Mo/s avec une mise à jour toutes les 500ms
3. THE Transfer_UI SHALL afficher la taille totale du fichier et la quantité déjà transférée
4. THE Transfer_UI SHALL calculer et afficher le temps restant estimé en secondes ou minutes
5. THE Transfer_UI SHALL afficher une barre de progression animée de manière fluide
6. WHEN le transfert est terminé, THE Transfer_UI SHALL afficher une animation de succès avec un message de confirmation

### Requirement 8: Vérification d'Intégrité du Fichier

**User Story:** En tant qu'utilisateur récepteur, je veux que l'application vérifie automatiquement l'intégrité du fichier reçu, afin de m'assurer que le média est complet et non corrompu.

#### Acceptance Criteria

1. WHEN le Sender_Device prépare le transfert, THE Integrity_Checker SHALL calculer le hash SHA-256 du fichier média
2. THE Transfer_Manager SHALL inclure le hash SHA-256 dans les métadonnées transmises au Receiver_Device
3. WHEN le téléchargement est terminé, THE Integrity_Checker SHALL calculer le hash SHA-256 du fichier reçu
4. THE Integrity_Checker SHALL comparer le hash calculé avec le hash reçu
5. IF les hashs correspondent, THEN THE Transfer_Manager SHALL marquer le transfert comme réussi
6. IF les hashs ne correspondent pas, THEN THE Transfer_Manager SHALL supprimer le fichier corrompu et afficher un message d'erreur "Fichier corrompu"

### Requirement 9: Intégration dans la Bibliothèque Média

**User Story:** En tant qu'utilisateur récepteur, je veux que le média reçu soit automatiquement ajouté à ma bibliothèque avec toutes ses métadonnées, afin de pouvoir le regarder immédiatement comme un téléchargement normal.

#### Acceptance Criteria

1. WHEN la vérification d'intégrité réussit, THE Media_Library SHALL créer une entrée pour le nouveau média
2. THE Media_Library SHALL sauvegarder les métadonnées (titre, affiche, synopsis, durée, note, genre, année)
3. THE Media_Library SHALL déplacer le fichier du dossier cache vers le dossier de téléchargements permanent
4. THE Media_Library SHALL marquer le média comme "Disponible Hors Ligne"
5. WHEN l'intégration est terminée, THE Transfer_UI SHALL afficher le média dans la section "Téléchargements"
6. THE Media_Library SHALL permettre la lecture immédiate du média reçu

### Requirement 10: Gestion des Erreurs et Annulation

**User Story:** En tant qu'utilisateur, je veux pouvoir annuler un transfert en cours et recevoir des messages d'erreur clairs en cas de problème, afin de comprendre ce qui s'est passé.

#### Acceptance Criteria

1. WHEN un Transfer_Session est actif, THE Transfer_UI SHALL afficher un bouton "Annuler"
2. WHEN l'utilisateur clique sur "Annuler", THE Transfer_Manager SHALL arrêter immédiatement le transfert
3. WHEN un transfert est annulé, THE Transfer_Manager SHALL nettoyer les ressources (arrêter le serveur, déconnecter Wi-Fi Direct, supprimer les fichiers temporaires)
4. IF la connexion Wi-Fi Direct est perdue pendant le transfert, THEN THE Transfer_Manager SHALL tenter de reconnecter automatiquement pendant 30 secondes
5. IF la reconnexion échoue, THEN THE Transfer_UI SHALL afficher un message "Connexion perdue - Transfert interrompu"
6. IF une erreur survient, THEN THE Transfer_UI SHALL afficher un message d'erreur descriptif et logger l'erreur pour le débogage

### Requirement 11: Gestion des Permissions et Sécurité

**User Story:** En tant qu'utilisateur, je veux que l'application demande les permissions nécessaires et sécurise la connexion, afin de protéger mes données et ma vie privée.

#### Acceptance Criteria

1. WHEN l'utilisateur active le partage pour la première fois, THE Transfer_Manager SHALL demander les permissions (Wi-Fi, Localisation, NFC, Stockage)
2. IF une permission est refusée, THEN THE Transfer_UI SHALL afficher un message explicatif et désactiver les fonctionnalités concernées
3. THE WiFi_Direct_Manager SHALL générer un mot de passe aléatoire de 16 caractères pour chaque Transfer_Session
4. THE WiFi_Direct_Manager SHALL utiliser WPA2 ou WPA3 pour sécuriser le point d'accès
5. WHEN le Transfer_Session se termine, THE WiFi_Direct_Manager SHALL supprimer immédiatement le point d'accès Wi-Fi Direct
6. THE Transfer_Manager SHALL ne partager que les médias téléchargés localement et ne jamais exposer d'autres fichiers de l'appareil

### Requirement 12: Compatibilité Multi-Plateforme

**User Story:** En tant qu'utilisateur Android, iOS ou Desktop, je veux pouvoir transférer des médias vers n'importe quel autre appareil (Mobile ou Desktop), afin de ne pas être limité par la plateforme.

#### Acceptance Criteria

1. THE Transfer_Manager SHALL supporter Mobile → Mobile (Android ↔ iOS)
2. THE Transfer_Manager SHALL supporter Desktop → Desktop (Windows/Linux/macOS)
3. THE Transfer_Manager SHALL supporter Mobile → Desktop
4. THE Transfer_Manager SHALL supporter Desktop → Mobile
5. WHERE Mobile → Mobile, THE WiFi_Direct_Manager SHALL utiliser Wi-Fi Direct (Android) ou Hotspot (iOS)
6. WHERE Desktop impliqué, THE Connection_Manager SHALL utiliser Local Network (LAN/WiFi)
7. THE Transfer_Manager SHALL détecter automatiquement la plateforme et choisir la stratégie appropriée

### Requirement 13: Optimisation des Performances

**User Story:** En tant qu'utilisateur, je veux que le transfert soit le plus rapide possible et n'épuise pas la batterie de mon appareil, afin de transférer des fichiers volumineux efficacement.

#### Acceptance Criteria

1. THE Transfer_Manager SHALL utiliser des buffers de 1 MB pour minimiser les opérations I/O
2. THE Transfer_Manager SHALL utiliser le multithreading pour le téléchargement de chunks en parallèle (maximum 4 threads)
3. THE Transfer_Manager SHALL utiliser la compression gzip UNIQUEMENT si le fichier n'est pas déjà compressé (détection via extension)
4. WHEN la batterie de l'appareil est inférieure à 15%, THE Transfer_UI SHALL afficher un avertissement mais permettre de continuer
5. THE Transfer_Manager SHALL libérer immédiatement la mémoire des chunks après leur écriture sur le disque
6. THE WiFi_Direct_Manager SHALL utiliser la bande 5 GHz si disponible pour de meilleures performances

### Requirement 14: Expérience Utilisateur Premium

**User Story:** En tant qu'utilisateur, je veux une interface moderne et fluide avec des animations élégantes, afin d'avoir une expérience similaire à AirDrop.

#### Acceptance Criteria

1. THE Transfer_UI SHALL afficher une animation de "recherche d'appareil" pendant l'attente de connexion
2. WHEN un appareil est détecté, THE Transfer_UI SHALL afficher une animation de "connexion en cours"
3. WHEN la connexion est établie, THE Transfer_UI SHALL afficher une animation de succès avec un effet visuel (confettis ou checkmark animé)
4. THE Transfer_UI SHALL utiliser des transitions fluides (minimum 60 FPS) pour tous les changements d'état
5. THE Transfer_UI SHALL afficher les avatars/noms des appareils connectés pour humaniser l'expérience
6. WHEN le transfert est terminé, THE Transfer_UI SHALL permettre de "Regarder Maintenant" directement depuis l'écran de succès

### Requirement 15: Reprise de Transfert Interrompu

**User Story:** En tant qu'utilisateur, je veux que le transfert puisse reprendre automatiquement en cas d'interruption temporaire, afin de ne pas perdre la progression en cas de problème réseau.

#### Acceptance Criteria

1. WHEN un Transfer_Session est interrompu, THE Transfer_Manager SHALL sauvegarder l'état de progression (chunks téléchargés)
2. IF la connexion est rétablie dans les 60 secondes, THEN THE Transfer_Manager SHALL reprendre automatiquement le transfert
3. THE Transfer_Manager SHALL utiliser les Range Requests HTTP pour reprendre au dernier chunk réussi
4. WHEN le transfert reprend, THE Transfer_UI SHALL afficher un message "Reprise du transfert..."
5. IF le transfert ne peut pas reprendre après 3 tentatives, THEN THE Transfer_Manager SHALL proposer de recommencer ou annuler
6. THE Transfer_Manager SHALL conserver les fichiers temporaires pendant 24 heures pour permettre une reprise manuelle

### Requirement 16: Vérification d'Abonnement et Quotas

**User Story:** En tant qu'utilisateur FREE ou PRO, je veux que mes quotas de partage soient respectés selon mon abonnement, afin de maintenir un modèle économique équitable.

#### Acceptance Criteria

1. WHEN un utilisateur FREE clique sur "Partager Hors Ligne", THE Transfer_Manager SHALL vérifier le quota de partages restants (3 par mois)
2. IF le quota FREE est atteint, THEN THE Transfer_UI SHALL afficher un message "Quota atteint - Passez à PRO pour partages illimités"
3. WHEN un utilisateur PRO clique sur "Partager Hors Ligne", THE Transfer_Manager SHALL autoriser le partage sans limite
4. THE Transfer_Manager SHALL synchroniser les quotas avec le backend lors de la vérification
5. WHEN un transfert est complété avec succès, THE Transfer_Manager SHALL décrémenter le quota FREE
6. IF le transfert échoue ou est annulé, THEN THE Transfer_Manager SHALL ne PAS décrémenter le quota

### Requirement 17: Support Desktop

**User Story:** En tant qu'utilisateur Desktop (Windows/Linux/macOS), je veux pouvoir partager et recevoir des médias via mon ordinateur, afin de profiter du P2P sur toutes mes plateformes.

#### Acceptance Criteria

1. WHEN l'application est lancée sur Desktop, THE Platform_Detector SHALL identifier la plateforme (Windows/Linux/macOS)
2. WHERE le sender est Desktop, THE QR_Generator SHALL afficher le QR Code en plein écran avec code manuel
3. WHERE le receiver est Desktop, THE QR_Scanner SHALL activer la webcam pour scanner
4. IF aucune webcam n'est disponible, THEN THE Transfer_UI SHALL afficher un champ de saisie pour code manuel
5. WHERE Desktop impliqué, THE Connection_Manager SHALL utiliser le réseau local (LAN/WiFi)
6. THE Connection_Manager SHALL vérifier que les deux appareils sont sur le même réseau avant de commencer
7. IF les appareils ne sont pas sur le même réseau, THEN THE Transfer_UI SHALL afficher "Les appareils doivent être sur le même réseau WiFi"
8. WHEN le transfert démarre sur Desktop, THE Transfer_Manager SHALL utiliser les mêmes mécanismes (chunks, SHA-256, etc.)

## Notes Techniques

### Architecture Recommandée

**Flutter Packages:**
- `network_info_plus`: Pour obtenir l'adresse IP locale
- `wifi_iot` (Android) / `network_info_plus` (iOS): Pour gérer Wi-Fi Direct / Hotspot
- `nfc_manager`: Pour la communication NFC
- `qr_flutter`: Pour générer les QR codes
- `mobile_scanner`: Pour scanner les QR codes
- `shelf` ou `dart:io HttpServer`: Pour le serveur HTTP local
- `crypto`: Pour les calculs SHA-256
- `path_provider`: Pour gérer les chemins de fichiers
- `webcam` (^0.2.0): Webcam pour QR scan (Desktop)
- `image_picker` (^1.0.4): Upload image QR (Desktop)
- `universal_io` (^2.2.2): Détection plateforme
- `window_manager` (^0.3.7): Gestion fenêtres Desktop
- `multicast_dns` (^0.3.2): mDNS pour découverte local network

**Considérations de Sécurité:**
- Chiffrement optionnel des données (AES-256) pour les utilisateurs premium
- Expiration automatique des credentials après 10 minutes
- Validation stricte des métadonnées reçues pour éviter les injections

**Limites de Transfert:**
- Taille maximale de fichier: 5 GB
- Temps maximum de transfert: 30 minutes
- Nombre maximum de tentatives de reconnexion: 5
- FREE users: 3 partages par mois
- PRO users: Partages illimités
- Desktop transfers nécessitent même réseau local (LAN/WiFi)

**Métriques de Succès:**
- Temps moyen de connexion: < 15 secondes
- Débit moyen: > 20 Mo/s
- Taux de réussite de transfert: > 95%
- Note utilisateur: > 4.5/5

