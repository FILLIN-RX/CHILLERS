# Implementation Plan: Transfert Média P2P Hors Ligne Multi-Plateforme

## Overview

Ce plan d'implémentation couvre le développement complet de la fonctionnalité de transfert P2P hors ligne pour CHILLERS, en trois phases principales:

1. **Phase 1 (Sprints 1-12):** Implémentation du P2P Mobile complet (Android/iOS) avec NFC, QR Code, Wi-Fi Direct, transfert chunked, vérification d'intégrité
2. **Phase 2 (Sprints 13-16):** Extension Desktop (Windows/Linux/macOS) avec webcam QR scan, code manuel, connexion local network
3. **Phase 3 (Sprints 17-18):** Tests d'intégration, polissage UI, optimisations finales

**Technologies:** Flutter, Dart, platform channels (Android/iOS), desktop plugins

**Estimation totale:** 18 sprints (18 semaines avec 1 sprint = 1 semaine)

---

## Tasks

### Phase 1: Core Mobile P2P Implementation

#### Epic 1: Project Setup and Core Architecture

- [x] 1.1 Create Flutter module structure for P2P transfer feature
  - Create `lib/features/offline_transfer/` directory structure
  - Define folder organization: `models/`, `services/`, `ui/`, `utils/`
  - Set up barrel exports for clean imports
  - _Requirements: 12.1, 12.2_
  - _Complexity: Low_
  - _Sprint: 1_

- [x] 1.2 Add required Flutter dependencies to pubspec.yaml
  - Add `network_info_plus`, `wifi_iot`, `nfc_manager`, `qr_flutter`, `mobile_scanner`
  - Add `shelf`, `crypto`, `path_provider`, `uuid`
  - Configure version constraints and platform compatibility
  - _Requirements: 12.1_
  - _Complexity: Low_
  - _Sprint: 1_

- [x] 1.3 Create data models (ConnectionCredentials, TransferSession, MediaMetadata)
  - Implement `ConnectionCredentials` with JSON serialization and NDEF encoding
  - Implement `TransferSession` with state management and progress tracking
  - Implement `MediaMetadata` with all required fields
  - Implement `TransferProgress` and `DownloadChunk` models
  - Add validation methods and factory constructors
  - _Requirements: 2.4, 8.2_
  - _Complexity: Medium_
  - _Sprint: 1_

- [x] 1.4 Create TransferManager core class with state machine
  - Implement state machine with 11 states (Idle, PairingMode, AwaitingConnection, etc.)
  - Create methods: `initiateShare()`, `initiateReceive()`, `cancelTransfer()`
  - Implement state transition logic and validation
  - Add `progressStream` and `statusStream` for reactive updates
  - _Requirements: 1.4, 10.1_
  - _Complexity: High_
  - _Sprint: 1_

- [x] 1.5 Checkpoint - Core architecture review
  - Ensure all models compile without errors
  - Verify TransferManager state transitions are logical
  - Ask the user if questions arise about architecture decisions

#### Epic 2: NFC Service Implementation

- [x] 2.1 Implement NFCService for pairing
  - [x] 2.1.1 Create NFCService class with platform channel setup
    - Implement `isNFCAvailable()` using `nfc_manager` package
    - Add permission checks for Android (NFC permission)
    - _Requirements: 2.1, 11.1_
    - _Complexity: Medium_
    - _Sprint: 2_

  - [x] 2.1.2 Implement NFC emission mode (Sender)
    - Create `startEmission()` method with NDEF message creation
    - Encode ConnectionCredentials to NDEF format
    - Handle NFC session lifecycle
    - _Requirements: 2.4_
    - _Complexity: Medium_
    - _Sprint: 2_

  - [x] 2.1.3 Implement NFC reception mode (Receiver)
    - Create `startReception()` method with NDEF parsing
    - Decode ConnectionCredentials from NDEF payload
    - Emit credentials via Stream
    - _Requirements: 2.6_
    - _Complexity: Medium_
    - _Sprint: 2_

  - [x] 2.1.4 Write unit tests for NFCService
    - Test NDEF encoding/decoding
    - Test availability checks
    - Mock platform channel responses
    - _Requirements: 2.1, 2.4, 2.6_
    - _Complexity: Low_
    - _Sprint: 2_

- [x] 2.2 Create error handling for NFC failures
  - Implement `PairingError.nfcUnavailable` with fallback to QR Code
  - Implement `PairingError.nfcDisabled` with user guidance
  - Add error recovery strategy
  - _Requirements: 10.6, 11.2_
  - _Complexity: Low_
  - _Sprint: 2_

#### Epic 3: QR Code Generation and Scanning

- [x] 3.1 Implement QRGenerator for credential sharing
  - [x] 3.1.1 Create QRGenerator class
    - Implement `generateQRCode()` using `qr_flutter`
    - Serialize ConnectionCredentials to JSON for QR payload
    - Add expiration timestamp validation
    - _Requirements: 3.2_
    - _Complexity: Low_
    - _Sprint: 3_

  - [x] 3.1.2 Create QR code display widget
    - Build `QRDisplayWidget` with full-screen display
    - Add manual 6-digit code display below QR
    - Implement animations and modern design
    - _Requirements: 3.3, 3.10_
    - _Complexity: Medium_
    - _Sprint: 3_

- [x] 3.2 Implement QRScanner for credential reception
  - [x] 3.2.1 Create QRScanner class with mobile_scanner
    - Implement `startScanning()` with camera activation
    - Parse QR data and validate JSON structure
    - Extract ConnectionCredentials from QR payload
    - _Requirements: 3.4, 3.5_
    - _Complexity: Medium_
    - _Sprint: 3_

  - [x] 3.2.2 Create scanner UI widget
    - Build camera preview with scanning overlay
    - Add "waiting for scan" indicator
    - Handle camera permissions
    - _Requirements: 3.6, 11.1_
    - _Complexity: Medium_
    - _Sprint: 3_

  - [x] 3.2.3 Write unit tests for QR encoding/decoding
    - Test JSON serialization of credentials
    - Test QR data parsing
    - Test expiration validation
    - _Requirements: 3.2, 3.4_
    - _Complexity: Low_
    - _Sprint: 3_

- [x] 3.3 Checkpoint - Pairing mechanisms complete
  - Ensure NFC and QR Code both work end-to-end
  - Test fallback from NFC to QR Code
  - Ask the user if questions arise

#### Epic 4: Wi-Fi Direct Manager (Mobile)

- [x] 4.1 Implement WiFiDirectManager for Android
  - [x] 4.1.1 Create WiFiDirectManager class with platform channels
    - Set up method channel for Android WifiP2pManager
    - Implement permission checks (Location, Nearby Devices)
    - _Requirements: 4.1, 11.1_
    - _Complexity: High_
    - _Sprint: 4_

  - [x] 4.1.2 Implement createAccessPoint() for Sender
    - Generate random SSID with format `CHILLERS_P2P_{6chars}`
    - Generate 16-character random password
    - Create Wi-Fi Direct group using Android API
    - Get local IP address (typically 192.168.49.1)
    - Return ConnectionCredentials object
    - _Requirements: 2.3, 11.3_
    - _Complexity: High_
    - _Sprint: 4_

  - [x] 4.1.3 Implement connect() for Receiver
    - Accept ConnectionCredentials as parameter
    - Temporarily disable current Wi-Fi connection
    - Connect to Wi-Fi Direct network using SSID/password
    - Verify connection establishment (< 10 seconds)
    - _Requirements: 4.2, 4.3, 4.6_
    - _Complexity: High_
    - _Sprint: 4_

  - [x] 4.1.4 Add Android native code for Wi-Fi Direct
    - Write Kotlin code for WifiP2pManager integration
    - Handle Wi-Fi Direct group creation and connection
    - Implement broadcast receivers for connection events
    - _Requirements: 4.1, 4.2_
    - _Complexity: Very High_
    - _Sprint: 4-5_

- [x] 4.2 Implement WiFiDirectManager for iOS
  - [x] 4.2.1 Create iOS-specific implementation with Hotspot API
    - Use NEHotspotConfiguration for iOS hotspot creation
    - Implement platform channel for iOS
    - Handle iOS-specific permissions
    - _Requirements: 12.1_
    - _Complexity: High_
    - _Sprint: 5_

  - [x] 4.2.2 Add iOS native code (Swift)
    - Write Swift code for NEHotspotConfiguration
    - Handle iOS hotspot lifecycle
    - Implement error handling for iOS limitations
    - _Requirements: 12.1_
    - _Complexity: High_
    - _Sprint: 5_

- [x] 4.3 Implement connection status monitoring
  - Add `connectionStatusStream` with real-time updates
  - Implement `testConnectivity()` with HTTP ping
  - Add automatic reconnection logic (3 retries with backoff)
  - _Requirements: 4.4, 4.5, 15.2_
  - _Complexity: Medium_
  - _Sprint: 5_

- [x] 4.4 Implement disconnect() and network restoration
  - Restore previous Wi-Fi connection after transfer
  - Clean up Wi-Fi Direct group on Sender
  - Handle edge cases (app backgrounded, system interruptions)
  - _Requirements: 10.3_
  - _Complexity: Medium_
  - _Sprint: 5_

- [x] 4.5 Write integration tests for Wi-Fi Direct flow
  - Test createAccessPoint() credentials generation
  - Test connect() with valid credentials
  - Test reconnection logic
  - _Requirements: 4.2, 4.3, 15.2_
  - _Complexity: Medium_
  - _Sprint: 5_

- [x] 4.6 Checkpoint - Wi-Fi Direct fully functional
  - Test Android ↔ Android connection
  - Test iOS ↔ iOS connection (if hotspot API works)
  - Test Android ↔ iOS cross-platform connection
  - Ask the user if questions arise

#### Epic 5: Local HTTP Server (Sender)

- [x] 5.1 Implement LocalHTTPServer using shelf package
  - [x] 5.1.1 Create LocalHTTPServer class with server lifecycle
    - Implement `start()` method with port range scanning (8000-9000)
    - Set up shelf server with request routing
    - Store file path and metadata for serving
    - _Requirements: 5.1, 5.2_
    - _Complexity: Medium_
    - _Sprint: 6_

  - [x] 5.1.2 Implement /metadata endpoint
    - Create handler returning MediaMetadata as JSON
    - Include title, poster (base64), duration, fileSize, sha256
    - Add CORS headers for cross-origin requests
    - _Requirements: 6.1, 8.2_
    - _Complexity: Low_
    - _Sprint: 6_

  - [x] 5.1.3 Implement /file endpoint with chunked serving
    - Parse Range header for chunk requests
    - Read file in 1 MB chunks using RandomAccessFile
    - Return appropriate headers (Content-Range, Accept-Ranges, Content-Type)
    - Support partial content (HTTP 206 status)
    - _Requirements: 5.3, 5.4, 5.5_
    - _Complexity: High_
    - _Sprint: 6_

  - [x] 5.1.4 Implement stop() method and cleanup
    - Close server and release port
    - Clean up file handles
    - Emit server stopped event
    - _Requirements: 5.6, 10.3_
    - _Complexity: Low_
    - _Sprint: 6_

  - [x] 5.1.5 Write unit tests for HTTP server
    - Test metadata endpoint response
    - Test chunked file serving with Range requests
    - Test port scanning logic
    - _Requirements: 5.3, 5.4_
    - _Complexity: Medium_
    - _Sprint: 6_

- [x] 5.2 Add request logging and error handling
  - Log all incoming requests with timestamp
  - Handle file not found errors gracefully
  - Return appropriate HTTP error codes (404, 416, 500)
  - _Requirements: 10.6_
  - _Complexity: Low_
  - _Sprint: 6_

#### Epic 6: HTTP Download Client (Receiver)

- [x] 6.1 Implement HTTPDownloadClient for chunked downloading
  - [x] 6.1.1 Create HTTPDownloadClient class
    - Implement `downloadFile()` with chunk strategy
    - Calculate total chunks based on file size (1 MB per chunk)
    - Set up parallel download queue (max 4 concurrent)
    - _Requirements: 6.2, 6.3_
    - _Complexity: High_
    - _Sprint: 7_

  - [x] 6.1.2 Implement chunk download worker
    - Create method to download single chunk with Range request
    - Write chunk to temporary file immediately after download
    - Update progress tracking after each chunk
    - _Requirements: 6.4_
    - _Complexity: Medium_
    - _Sprint: 7_

  - [x] 6.1.3 Implement retry logic with exponential backoff
    - Retry failed chunks up to 3 times
    - Use backoff: 1s, 2s, 4s delays
    - Track retry count per chunk
    - _Requirements: 6.6_
    - _Complexity: Medium_
    - _Sprint: 7_

  - [x] 6.1.4 Implement progress tracking and speed calculation
    - Update `progressStream` every 500ms
    - Calculate current speed based on bytes transferred
    - Estimate time remaining using average speed
    - _Requirements: 7.2, 7.3, 7.4_
    - _Complexity: Medium_
    - _Sprint: 7_

  - [x] 6.1.5 Implement pause(), resume(), cancel() methods
    - Save download state to disk on pause
    - Resume from last completed chunk
    - Clean up temporary files on cancel
    - _Requirements: 10.2, 15.3_
    - _Complexity: Medium_
    - _Sprint: 7_

  - [x] 6.1.6 Write unit tests for download client
    - Test chunk calculation logic
    - Test retry mechanism with mock server
    - Test progress calculation accuracy
    - _Requirements: 6.3, 6.6_
    - _Complexity: Medium_
    - _Sprint: 7_

- [x] 6.2 Implement chunk assembly after download
  - Verify all chunks are present and complete
  - Concatenate chunks in correct order
  - Write final file to destination path
  - Clean up chunk files from cache
  - _Requirements: 6.5_
  - _Complexity: Medium_
  - _Sprint: 7_

- [x] 6.3 Checkpoint - File transfer end-to-end working
  - Test complete file transfer (small test file ~10 MB)
  - Verify chunk assembly produces valid file
  - Test pause/resume functionality
  - Ask the user if questions arise

#### Epic 7: Integrity Checker

- [x] 7.1 Implement IntegrityChecker with SHA-256
  - [x] 7.1.1 Create IntegrityChecker class
    - Implement `calculateFileHash()` using crypto package
    - Read file in 1 MB chunks to avoid memory issues
    - Use Isolate for background computation
    - _Requirements: 8.1, 8.3_
    - _Complexity: Medium_
    - _Sprint: 8_

  - [x] 7.1.2 Implement hash calculation with progress reporting
    - Create `calculateFileHashWithProgress()` variant
    - Emit progress updates during calculation
    - Show progress in UI (0-100%)
    - _Requirements: 8.1_
    - _Complexity: Low_
    - _Sprint: 8_

  - [x] 7.1.3 Implement verifyFileIntegrity()
    - Compare calculated hash with expected hash
    - Return boolean result
    - Log comparison results
    - _Requirements: 8.4, 8.5_
    - _Complexity: Low_
    - _Sprint: 8_

  - [x] 7.1.4 Write unit tests for integrity checker
    - Test hash calculation for known files
    - Test hash comparison logic
    - Test Isolate-based computation
    - _Requirements: 8.3, 8.4_
    - _Complexity: Low_
    - _Sprint: 8_

- [x] 7.2 Add error handling for integrity failures
  - Implement `TransferError.integrityCheckFailed`
  - Delete corrupted file on hash mismatch
  - Display user-friendly error message
  - Allow retry option
  - _Requirements: 8.6, 10.6_
  - _Complexity: Low_
  - _Sprint: 8_

#### Epic 8: Media Library Integration

- [x] 8.1 Extend MediaLibrary with P2P transfer methods
  - [x] 8.1.1 Add getMediaItem() and getMediaFilePath()
    - Query local database for media by ID
    - Return file path for sharing
    - Validate file existence before transfer
    - _Requirements: 1.2, 1.3_
    - _Complexity: Low_
    - _Sprint: 8_

  - [x] 8.1.2 Implement addMedia() for received files
    - Create database entry with all metadata
    - Move file from cache to permanent storage
    - Update UI to show new media
    - _Requirements: 9.1, 9.2, 9.3_
    - _Complexity: Medium_
    - _Sprint: 8_

  - [x] 8.1.3 Add "Disponible Hors Ligne" marker
    - Mark media as locally available
    - Update UI indicators
    - Allow immediate playback
    - _Requirements: 9.4, 9.6_
    - _Complexity: Low_
    - _Sprint: 8_

  - [x] 8.1.4 Write unit tests for media library integration
    - Test addMedia() with complete metadata
    - Test file movement to permanent storage
    - Test duplicate detection
    - _Requirements: 9.1, 9.3_
    - _Complexity: Low_
    - _Sprint: 8_

- [x] 8.2 Update downloads UI section
  - Display received media in "Téléchargements" section
  - Show P2P transfer indicator (badge or icon)
  - Enable immediate playback of received media
  - _Requirements: 9.5, 14.6_
  - _Complexity: Low_
  - _Sprint: 8_

#### Epic 9: Transfer UI - Sender Flow

- [x] 9.1 Create Share Offline button and entry point
  - Add "Partager Hors Ligne" button to media detail screen
  - Validate media is downloaded before showing button
  - Implement button click handler
  - _Requirements: 1.1, 1.2_
  - _Complexity: Low_
  - _Sprint: 9_

- [x] 9.2 Create PairingModeScreen (Sender)
  - [x] 9.2.1 Design and implement UI layout
    - Display NFC and QR Code options with tabs
    - Show device name/avatar for sender
    - Add "waiting for connection" animation
    - _Requirements: 1.5, 3.3, 14.1_
    - _Complexity: Medium_
    - _Sprint: 9_

  - [x] 9.2.2 Implement NFC tab
    - Show NFC icon and "Tap to connect" message
    - Display animation when NFC is active
    - Handle NFCService events
    - _Requirements: 2.1, 14.2_
    - _Complexity: Low_
    - _Sprint: 9_

  - [x] 9.2.3 Implement QR Code tab
    - Display QR code from QRGenerator
    - Show 6-digit manual code below QR
    - Add copy button for manual code
    - _Requirements: 3.2, 3.3, 3.10_
    - _Complexity: Low_
    - _Sprint: 9_

- [x] 9.3 Create TransferProgressScreen (Sender)
  - Display connection status ("Connecté à [Device Name]")
  - Show static message "Envoi en cours..."
  - Display file name and size
  - Show number of connected receivers
  - Add "Annuler" button
  - _Requirements: 7.1, 10.1_
  - _Complexity: Low_
  - _Sprint: 9_

- [x] 9.4 Create TransferCompleteScreen (Sender)
  - Show success animation (checkmark)
  - Display "Transfert terminé" message
  - Show receiver device name
  - Add "Partager à nouveau" and "Fermer" buttons
  - _Requirements: 7.6, 14.3_
  - _Complexity: Low_
  - _Sprint: 9_

#### Epic 10: Transfer UI - Receiver Flow

- [x] 10.1 Create ReceiveModeScreen
  - Add "Recevoir Hors Ligne" entry point in app
  - Display NFC and QR Scanner options
  - Show device name/avatar for receiver
  - _Requirements: 1.5_
  - _Complexity: Low_
  - _Sprint: 10_

- [x] 10.2 Implement NFC reception UI
  - Show "Tap to receive" message with animation
  - Display status when NFC detects sender
  - Transition to connection screen automatically
  - _Requirements: 2.6, 14.2_
  - _Complexity: Low_
  - _Sprint: 10_

- [x] 10.3 Implement QR Scanner UI
  - Display camera preview with scanning overlay
  - Show instructions "Scannez le QR code"
  - Handle QR detection and credential extraction
  - Transition to connection screen on successful scan
  - _Requirements: 3.4, 3.5, 3.6_
  - _Complexity: Medium_
  - _Sprint: 10_

- [x] 10.4 Create ConnectionEstablishingScreen
  - Show "Connexion en cours..." animation
  - Display sender device info (name, media title)
  - Show connection progress indicator
  - Handle connection errors with retry option
  - _Requirements: 4.3, 14.2_
  - _Complexity: Medium_
  - _Sprint: 10_

- [x] 10.5 Create TransferProgressScreen (Receiver)
  - [x] 10.5.1 Implement progress bar and percentage display
    - Show animated progress bar (0-100%)
    - Display percentage text
    - Update smoothly every 500ms
    - _Requirements: 7.1, 7.2, 14.4_
    - _Complexity: Low_
    - _Sprint: 10_

  - [x] 10.5.2 Display transfer metrics
    - Show current speed (MB/s)
    - Show transferred / total size
    - Show estimated time remaining
    - Format numbers for readability (MB, GB)
    - _Requirements: 7.2, 7.3, 7.4_
    - _Complexity: Low_
    - _Sprint: 10_

  - [x] 10.5.3 Add media preview card
    - Display media poster image
    - Show title, year, genre
    - Show file size
    - _Requirements: 6.1_
    - _Complexity: Low_
    - _Sprint: 10_

  - [x] 10.5.4 Add control buttons
    - Implement "Pause" / "Resume" button with state
    - Implement "Annuler" button with confirmation dialog
    - Handle button states based on transfer status
    - _Requirements: 10.1, 10.2_
    - _Complexity: Low_
    - _Sprint: 10_

- [x] 10.6 Create VerifyingScreen
  - Show "Vérification en cours..." message
  - Display spinning loader with hash calculation progress
  - Show checkmark animation on success
  - _Requirements: 8.3, 8.4_
  - _Complexity: Low_
  - _Sprint: 10_

- [x] 10.7 Create TransferCompleteScreen (Receiver)
  - Show success animation with confetti effect
  - Display "Transfert réussi !" message
  - Show media card with "Regarder Maintenant" button
  - Add "Fermer" button
  - Navigate to media player on "Regarder Maintenant"
  - _Requirements: 7.6, 9.5, 14.3, 14.6_
  - _Complexity: Medium_
  - _Sprint: 10_

- [x] 10.8 Checkpoint - Complete mobile UI flow
  - Test sender flow from start to finish
  - Test receiver flow from start to finish
  - Verify all animations work smoothly (60 FPS)
  - Ask the user if questions arise

#### Epic 11: Error Handling and Recovery

- [x] 11.1 Implement error dialog system
  - Create reusable ErrorDialog widget
  - Display user-friendly error messages
  - Show recovery actions (Retry, Cancel, Open Settings)
  - _Requirements: 10.6_
  - _Complexity: Low_
  - _Sprint: 11_

- [x] 11.2 Implement error recovery strategies
  - [x] 11.2.1 Create ErrorRecoveryStrategy class
    - Implement `isRecoverable()` check
    - Implement `getRecoveryAction()` mapper
    - Define recovery actions for each error type
    - _Requirements: 10.4, 10.5_
    - _Complexity: Medium_
    - _Sprint: 11_

  - [x] 11.2.2 Implement auto-retry for connection lost
    - Detect connection loss during transfer
    - Attempt reconnection with exponential backoff (2s, 4s, 8s)
    - Retry up to 5 times
    - Display "Reconnexion..." message
    - _Requirements: 10.4, 15.2_
    - _Complexity: Medium_
    - _Sprint: 11_

  - [x] 11.2.3 Implement manual retry for user-facing errors
    - Show "Réessayer" button for connection timeouts
    - Show "Ouvrir les paramètres" for permission errors
    - Allow restart of transfer for integrity failures
    - _Requirements: 10.5, 11.2_
    - _Complexity: Low_
    - _Sprint: 11_

- [x] 11.3 Add transfer logging for debugging
  - Implement TransferLogger class
  - Log all state transitions with timestamps
  - Log errors with full context (sessionId, progress, retry count)
  - Store logs locally for troubleshooting
  - _Requirements: 10.6_
  - _Complexity: Low_
  - _Sprint: 11_

- [x] 11.4 Write integration tests for error scenarios
  - Test connection timeout handling
  - Test connection lost during transfer
  - Test integrity check failure
  - Test insufficient storage error
  - _Requirements: 10.4, 10.5_
  - _Complexity: Medium_
  - _Sprint: 11_

#### Epic 12: Permissions Management

- [x] 12.1 Implement PermissionsManager service
  - [x] 12.1.1 Create PermissionsManager class
    - Check permissions: Wi-Fi, Location, NFC, Storage, Camera
    - Request permissions with rationale dialogs
    - Handle permission denial gracefully
    - _Requirements: 11.1, 11.2_
    - _Complexity: Medium_
    - _Sprint: 11_

  - [x] 12.1.2 Add Android-specific permission handling
    - Request NEARBY_WIFI_DEVICES (Android 13+)
    - Request ACCESS_FINE_LOCATION for Wi-Fi Direct
    - Request NFC permission
    - Add permissions to AndroidManifest.xml
    - _Requirements: 11.1_
    - _Complexity: Low_
    - _Sprint: 11_

  - [x] 12.1.3 Add iOS-specific permission handling
    - Request Local Network permission
    - Request Camera permission (for QR scanner)
    - Request NFC permission
    - Add entries to Info.plist with usage descriptions
    - _Requirements: 11.1_
    - _Complexity: Low_
    - _Sprint: 11_

- [x] 12.2 Create permission request UI flow
  - Show rationale dialog before requesting permissions
  - Display helpful message explaining why permission is needed
  - Handle "Don't ask again" scenario with "Open Settings" option
  - _Requirements: 11.2_
  - _Complexity: Low_
  - _Sprint: 11_

- [x] 12.3 Implement feature fallbacks for missing permissions
  - Fallback to QR Code if NFC permission denied
  - Disable P2P transfer if Wi-Fi permission denied
  - Show appropriate error messages
  - _Requirements: 11.2_
  - _Complexity: Low_
  - _Sprint: 11_

#### Epic 13: Performance Optimizations

- [~] 13.1 Optimize chunk download with parallel workers
  - Implement worker pool with 4 concurrent downloads
  - Distribute chunks evenly across workers
  - Monitor memory usage during parallel downloads
  - _Requirements: 13.2_
  - _Complexity: Medium_
  - _Sprint: 12_

- [~] 13.2 Optimize memory management
  - Release chunk buffers immediately after disk write
  - Use streaming for file reads/writes
  - Limit in-memory chunk size to 1 MB
  - Monitor heap size during transfers
  - _Requirements: 13.5_
  - _Complexity: Medium_
  - _Sprint: 12_

- [~] 13.3 Implement battery optimization
  - Detect low battery state (< 15%)
  - Show warning dialog but allow continuation
  - Reduce chunk parallelism on low battery
  - _Requirements: 13.4_
  - _Complexity: Low_
  - _Sprint: 12_

- [~] 13.4 Optimize Wi-Fi band selection
  - Prefer 5 GHz band if supported
  - Fall back to 2.4 GHz if 5 GHz unavailable
  - Detect band support via platform channels
  - _Requirements: 13.6_
  - _Complexity: Low_
  - _Sprint: 12_

- [~] 13.5 Implement compression detection
  - Check file extension to detect pre-compressed formats (.mp4, .mkv)
  - Skip gzip compression for already compressed files
  - Apply compression only for uncompressed formats
  - _Requirements: 13.3_
  - _Complexity: Low_
  - _Sprint: 12_

- [ ]* 13.6 Write performance benchmarks
  - Benchmark transfer speed with different chunk sizes
  - Benchmark parallel download performance
  - Measure memory usage under load
  - _Requirements: 13.1, 13.2_
  - _Complexity: Medium_
  - _Sprint: 12_

- [~] 13.7 Checkpoint - Mobile P2P feature complete
  - End-to-end test with real devices (Android ↔ Android)
  - End-to-end test with real devices (iOS ↔ iOS if possible)
  - End-to-end test with cross-platform (Android ↔ iOS)
  - Measure transfer speed (target > 20 MB/s)
  - Verify success rate > 95%
  - Ask the user if questions arise

---

### Phase 2: Desktop Support Extension

#### Epic 14: Platform Detection and Abstraction

- [~] 14.1 Add desktop dependencies to pubspec.yaml
  - Add `webcam` (^0.2.0) for webcam access
  - Add `image_picker` (^1.0.4) for QR image upload
  - Add `universal_io` (^2.2.2) for platform detection
  - Add `window_manager` (^0.3.7) for desktop window control
  - Add `multicast_dns` (^0.3.2) for local network discovery
  - Configure desktop platform support (Windows, Linux, macOS)
  - _Requirements: 12.2, 17.1_
  - _Complexity: Low_
  - _Sprint: 13_

- [~] 14.2 Create PlatformDetector service
  - Implement `isDesktop()`, `isMobile()`, `getCurrentPlatform()`
  - Return enum: Android, iOS, Windows, Linux, macOS
  - Use `universal_io` for detection
  - _Requirements: 12.7, 17.1_
  - _Complexity: Low_
  - _Sprint: 13_

- [~] 14.3 Refactor ConnectionManager for multi-platform
  - Create abstract `ConnectionManager` interface
  - Implement `WiFiDirectConnectionManager` for mobile
  - Implement `LocalNetworkConnectionManager` for desktop
  - Use factory pattern based on PlatformDetector
  - _Requirements: 12.2, 12.6, 17.5_
  - _Complexity: High_
  - _Sprint: 13_

#### Epic 15: Local Network Connection (Desktop)

- [ ] 15.1 Implement LocalNetworkConnectionManager
  - [~] 15.1.1 Create LocalNetworkConnectionManager class
    - Implement `createAccessPoint()` for desktop sender
    - Get local IP address from network interface
    - Start HTTP server on local network
    - Generate ConnectionCredentials with local IP
    - _Requirements: 12.6, 17.5_
    - _Complexity: Medium_
    - _Sprint: 13_

  - [~] 15.1.2 Implement connect() for desktop receiver
    - Accept ConnectionCredentials with sender's local IP
    - Verify receiver is on same network (subnet check)
    - Test connectivity with HTTP ping to sender
    - Return success/failure result
    - _Requirements: 17.6, 17.7_
    - _Complexity: Medium_
    - _Sprint: 13_

  - [~] 15.1.3 Add network validation
    - Implement subnet comparison (sender vs receiver IPs)
    - Check if both devices are on same local network
    - Display error if not on same network
    - _Requirements: 17.6, 17.7_
    - _Complexity: Medium_
    - _Sprint: 13_

  - [ ]* 15.1.4 Write unit tests for local network manager
    - Test IP address extraction
    - Test subnet validation logic
    - Mock network interfaces
    - _Requirements: 17.5, 17.6_
    - _Complexity: Low_
    - _Sprint: 13_

- [~] 15.2 Implement mDNS service discovery (optional enhancement)
  - Use `multicast_dns` for automatic peer discovery
  - Broadcast service on local network
  - Discover peers automatically
  - Display discovered devices in UI
  - _Requirements: 12.6_
  - _Complexity: Medium_
  - _Sprint: 13_

#### Epic 16: Desktop QR Code Support

- [~] 16.1 Extend QRGenerator for desktop display
  - Create desktop-specific QR display widget
  - Show QR code in large window (full screen or modal)
  - Display 6-digit manual code prominently
  - Add "Copy Code" button with clipboard integration
  - _Requirements: 17.2, 17.3_
  - _Complexity: Low_
  - _Sprint: 14_

- [ ] 16.2 Implement QRScanner with webcam support
  - [~] 16.2.1 Create DesktopQRScanner class
    - Use `webcam` package for camera access
    - Implement webcam preview widget
    - Integrate QR detection library for desktop
    - Parse QR code data and extract credentials
    - _Requirements: 17.3_
    - _Complexity: High_
    - _Sprint: 14_

  - [~] 16.2.2 Add webcam selection dropdown
    - List available webcams using `webcam` package
    - Allow user to select specific camera
    - Save camera preference locally
    - _Requirements: 17.3_
    - _Complexity: Low_
    - _Sprint: 14_

  - [~] 16.2.3 Implement QR image upload fallback
    - Add "Upload QR Image" button
    - Use `image_picker` to select image file
    - Process image with QR detection
    - Extract credentials from uploaded image
    - _Requirements: 17.4_
    - _Complexity: Medium_
    - _Sprint: 14_

- [ ] 16.3 Implement manual code entry
  - [~] 16.3.1 Create manual code input UI
    - Display 6 input fields for 6-digit code
    - Auto-focus next field on digit entry
    - Validate code format (numeric only)
    - _Requirements: 17.4_
    - _Complexity: Low_
    - _Sprint: 14_

  - [~] 16.3.2 Add code validation and lookup
    - Send code to sender for validation
    - Retrieve full ConnectionCredentials from sender
    - Handle invalid code errors
    - _Requirements: 17.4_
    - _Complexity: Medium_
    - _Sprint: 14_

  - [ ]* 16.3.3 Write unit tests for manual code system
    - Test code generation (sender)
    - Test code validation logic
    - Test credential retrieval
    - _Requirements: 17.4_
    - _Complexity: Low_
    - _Sprint: 14_

#### Epic 17: Desktop UI Adaptation

- [~] 17.1 Create desktop-specific layouts
  - Design desktop window sizes (800x600 minimum)
  - Adapt mobile screens to desktop layouts
  - Use responsive design patterns
  - _Requirements: 17.1_
  - _Complexity: Medium_
  - _Sprint: 14_

- [~] 17.2 Implement desktop PairingModeScreen
  - Show QR code prominently in center
  - Display 6-digit code below QR with large font
  - Add "Copy Code" button
  - Show "Waiting for connection..." status
  - Remove NFC option (not available on desktop)
  - _Requirements: 17.2_
  - _Complexity: Low_
  - _Sprint: 14_

- [~] 17.3 Implement desktop ReceiveModeScreen
  - Show webcam scanner as primary option
  - Add webcam selection dropdown
  - Add "Upload QR Image" button
  - Add "Enter Code Manually" button
  - Display receiver status
  - _Requirements: 17.3, 17.4_
  - _Complexity: Medium_
  - _Sprint: 14_

- [~] 17.4 Adapt TransferProgressScreen for desktop
  - Use larger UI elements for desktop
  - Display more detailed metrics
  - Show network info (IP addresses)
  - Keep same progress bar and metrics logic
  - _Requirements: 17.8_
  - _Complexity: Low_
  - _Sprint: 14_

- [~] 17.5 Implement desktop window management
  - Set minimum window size constraints
  - Make transfer window stay on top (optional)
  - Handle window close events gracefully
  - Confirm cancel when closing during transfer
  - _Requirements: 17.1_
  - _Complexity: Low_
  - _Sprint: 14_

#### Epic 18: Cross-Platform Testing

- [ ] 18.1 Test Mobile → Desktop transfers
  - [~] 18.1.1 Test Android → Windows transfer
    - QR scan with webcam
    - Manual code entry
    - Complete file transfer
    - _Requirements: 12.3, 12.4_
    - _Complexity: Manual Testing_
    - _Sprint: 15_

  - [~] 18.1.2 Test iOS → macOS transfer
    - QR scan with webcam
    - Complete file transfer
    - _Requirements: 12.4_
    - _Complexity: Manual Testing_
    - _Sprint: 15_

  - [~] 18.1.3 Test Android → Linux transfer
    - QR scan or manual code
    - Complete file transfer
    - _Requirements: 12.3_
    - _Complexity: Manual Testing_
    - _Sprint: 15_

- [ ] 18.2 Test Desktop → Mobile transfers
  - [~] 18.2.1 Test Windows → Android transfer
    - Mobile scans desktop QR code
    - Complete file transfer
    - _Requirements: 12.4_
    - _Complexity: Manual Testing_
    - _Sprint: 15_

  - [~] 18.2.2 Test macOS → iOS transfer
    - Mobile scans desktop QR code
    - Complete file transfer
    - _Requirements: 12.4_
    - _Complexity: Manual Testing_
    - _Sprint: 15_

- [ ] 18.3 Test Desktop → Desktop transfers
  - [~] 18.3.1 Test Windows → Windows transfer
    - Webcam QR scan
    - Local network connection
    - Complete file transfer
    - _Requirements: 12.2_
    - _Complexity: Manual Testing_
    - _Sprint: 15_

  - [~] 18.3.2 Test macOS → Linux transfer
    - Cross-OS desktop transfer
    - Verify local network compatibility
    - _Requirements: 12.2_
    - _Complexity: Manual Testing_
    - _Sprint: 15_

- [~] 18.4 Checkpoint - Desktop support complete
  - Verify all platform combinations work
  - Measure transfer speeds on desktop
  - Ensure network validation works correctly
  - Ask the user if questions arise

---

### Phase 3: Subscription System and Final Polish

#### Epic 19: Subscription Integration and Quotas

- [ ] 19.1 Implement SubscriptionManager service
  - [~] 19.1.1 Create SubscriptionManager class
    - Fetch user subscription tier from backend
    - Cache subscription info locally
    - Expose `isProUser()` and `isFreeUser()` methods
    - _Requirements: 16.1, 16.3_
    - _Complexity: Low_
    - _Sprint: 16_

  - [~] 19.1.2 Implement quota tracking for FREE users
    - Track monthly P2P shares count
    - Store quota usage in local database
    - Sync with backend on app start
    - Reset quota on month rollover
    - _Requirements: 16.1, 16.5_
    - _Complexity: Medium_
    - _Sprint: 16_

  - [~] 19.1.3 Add quota validation before transfer
    - Check quota before initiating share (Sender)
    - Display quota remaining in UI
    - Block transfer if quota exceeded
    - _Requirements: 16.1_
    - _Complexity: Low_
    - _Sprint: 16_

  - [~] 19.1.4 Implement quota decrement on success
    - Decrement quota only after successful transfer
    - Do not decrement if transfer fails or is cancelled
    - Sync quota update with backend
    - _Requirements: 16.5, 16.6_
    - _Complexity: Low_
    - _Sprint: 16_

  - [ ]* 19.1.5 Write unit tests for quota system
    - Test quota validation logic
    - Test decrement on success only
    - Test quota reset on month rollover
    - _Requirements: 16.1, 16.5_
    - _Complexity: Low_
    - _Sprint: 16_

- [~] 19.2 Create quota exhausted UI flow
  - Display "Quota atteint" dialog when limit reached
  - Show "Passez à PRO" upgrade call-to-action
  - Link to subscription upgrade screen
  - Show quota reset date (next month)
  - _Requirements: 16.2_
  - _Complexity: Low_
  - _Sprint: 16_

- [~] 19.3 Add quota indicator in transfer UI
  - Show "X partages restants ce mois" for FREE users
  - Hide quota indicator for PRO users
  - Update count after each transfer
  - _Requirements: 16.1_
  - _Complexity: Low_
  - _Sprint: 16_

- [~] 19.4 Implement backend API endpoints for quotas
  - Create GET /api/transfer/quota endpoint
  - Create POST /api/transfer/quota/decrement endpoint
  - Add authentication middleware
  - Store quota usage per user in database
  - _Requirements: 16.4, 16.5_
  - _Complexity: Medium_
  - _Sprint: 16_

- [ ]* 19.5 Write integration tests for subscription system
  - Test FREE user quota enforcement
  - Test PRO user unlimited transfers
  - Test quota sync with backend
  - _Requirements: 16.1, 16.3_
  - _Complexity: Medium_
  - _Sprint: 16_

#### Epic 20: Resume Transfer Functionality

- [~] 20.1 Implement transfer state persistence
  - Save TransferSession state to local database
  - Store chunk completion status
  - Save credentials and metadata
  - Persist state every 10 chunks
  - _Requirements: 15.1_
  - _Complexity: Medium_
  - _Sprint: 17_

- [~] 20.2 Implement auto-resume on reconnection
  - Detect connection restoration within 60 seconds
  - Load saved transfer state
  - Resume download from last completed chunk
  - Display "Reprise du transfert..." message
  - _Requirements: 15.2, 15.3, 15.4_
  - _Complexity: Medium_
  - _Sprint: 17_

- [~] 20.3 Implement manual resume UI
  - Show "Reprendre" button for interrupted transfers
  - Display interrupted transfers in a "Reprises Disponibles" section
  - Allow user to manually restart interrupted transfer
  - Expire saved state after 24 hours
  - _Requirements: 15.5, 15.6_
  - _Complexity: Medium_
  - _Sprint: 17_

- [~] 20.4 Add cleanup for expired transfer states
  - Remove transfer states older than 24 hours
  - Delete temporary chunk files for expired transfers
  - Run cleanup on app start
  - _Requirements: 15.6_
  - _Complexity: Low_
  - _Sprint: 17_

- [ ]* 20.5 Write unit tests for resume functionality
  - Test state persistence and restoration
  - Test auto-resume logic
  - Test chunk offset calculation on resume
  - _Requirements: 15.1, 15.3_
  - _Complexity: Medium_
  - _Sprint: 17_

#### Epic 21: Advanced Error Handling and Edge Cases

- [~] 21.1 Handle insufficient storage error
  - Check available storage before starting download
  - Display "Espace insuffisant" error if not enough space
  - Show storage requirement vs available space
  - _Requirements: 10.6_
  - _Complexity: Low_
  - _Sprint: 17_

- [~] 21.2 Handle app backgrounding during transfer
  - Continue transfer when app goes to background (Android)
  - Show persistent notification with progress (Android)
  - Pause transfer on iOS background (iOS limitations)
  - Resume when app returns to foreground
  - _Requirements: 10.4_
  - _Complexity: High_
  - _Sprint: 17_

- [~] 21.3 Handle network type changes
  - Detect if user manually switches networks during transfer
  - Pause transfer if network changes
  - Prompt user to reconnect to correct network
  - _Requirements: 10.4_
  - _Complexity: Medium_
  - _Sprint: 17_

- [~] 21.4 Handle credentials expiration
  - Check credential validity before connection
  - Display "Credentials expirés" error if expired
  - Prompt user to restart sharing process
  - _Requirements: 2.3, 11.3_
  - _Complexity: Low_
  - _Sprint: 17_

- [~] 21.5 Handle file size limits
  - Validate file size < 5 GB before transfer
  - Display error if file exceeds limit
  - Show file size and limit in error message
  - _Requirements: System Limits_
  - _Complexity: Low_
  - _Sprint: 17_

- [~] 21.6 Handle transfer timeout
  - Implement 30-minute maximum transfer time
  - Cancel transfer if timeout exceeded
  - Display "Transfert trop long" error
  - Allow retry option
  - _Requirements: System Limits_
  - _Complexity: Low_
  - _Sprint: 17_

#### Epic 22: UI Polish and Animations

- [~] 22.1 Polish all screen transitions
  - Implement smooth fade/slide transitions between screens
  - Ensure 60 FPS performance for all animations
  - Add shared element transitions for media cards
  - _Requirements: 14.4_
  - _Complexity: Medium_
  - _Sprint: 18_

- [~] 22.2 Add device avatars and naming
  - Generate device avatars based on device model
  - Display device names (user-configurable)
  - Show sender/receiver devices with avatars in UI
  - _Requirements: 14.5_
  - _Complexity: Low_
  - _Sprint: 18_

- [~] 22.3 Implement success animation with confetti
  - Use Lottie or custom animation for success screen
  - Trigger confetti/particle effect on completion
  - Add checkmark animation
  - _Requirements: 14.3_
  - _Complexity: Low_
  - _Sprint: 18_

- [~] 22.4 Improve connection animations
  - Add pulsing animation during "searching for device"
  - Add connecting animation (devices approaching)
  - Add "locked in" animation when connected
  - _Requirements: 14.1, 14.2_
  - _Complexity: Medium_
  - _Sprint: 18_

- [~] 22.5 Improve progress bar visualization
  - Use gradient progress bar with animation
  - Add particle effects moving along progress bar
  - Smooth interpolation of progress updates
  - _Requirements: 7.5, 14.4_
  - _Complexity: Low_
  - _Sprint: 18_

- [~] 22.6 Add haptic feedback
  - Vibrate on successful NFC tap
  - Vibrate on QR code detection
  - Vibrate on transfer completion
  - Use platform-appropriate haptic patterns
  - _Requirements: 14.1_
  - _Complexity: Low_
  - _Sprint: 18_

#### Epic 23: Final Integration and Testing

- [~] 23.1 End-to-end testing with real devices
  - Test all platform combinations (Mobile ↔ Mobile, Mobile ↔ Desktop, Desktop ↔ Desktop)
  - Test with various file sizes (10 MB, 100 MB, 1 GB, 5 GB)
  - Test with different network conditions (strong, weak signal)
  - Test interruption and resume scenarios
  - _Requirements: All_
  - _Complexity: Manual Testing_
  - _Sprint: 18_

- [ ]* 23.2 Write widget tests for UI components
  - Test PairingModeScreen rendering
  - Test TransferProgressScreen updates
  - Test error dialog display
  - _Requirements: UI Components_
  - _Complexity: Medium_
  - _Sprint: 18_

- [~] 23.3 Performance profiling and optimization
  - Profile memory usage during transfers
  - Profile CPU usage during hash calculation
  - Optimize any bottlenecks found
  - Ensure no memory leaks
  - _Requirements: 13.1, 13.5_
  - _Complexity: Medium_
  - _Sprint: 18_

- [~] 23.4 Security audit
  - Review credential generation for randomness
  - Review SHA-256 implementation
  - Verify no sensitive data leaks in logs
  - Test credential expiration enforcement
  - _Requirements: 11.3, 11.4, 11.5, 11.6_
  - _Complexity: Manual Review_
  - _Sprint: 18_

- [~] 23.5 Final checkpoint - Feature complete and ready for production
  - All automated tests passing
  - Manual testing completed for all platforms
  - Performance metrics meet targets (> 20 MB/s, > 95% success rate)
  - UI/UX polished and animations smooth
  - Error handling robust and user-friendly
  - Documentation complete
  - Ask the user for final approval

---

## Notes

### Implementation Strategy

- **Incremental Development**: Each epic builds on previous work. Complete epics sequentially within each phase.
- **Platform-Specific Code**: Use platform channels for Android/iOS native features (Wi-Fi Direct, NFC). Use conditional imports for desktop-specific packages.
- **Testing Strategy**: Unit tests are optional (marked with `*`) but highly recommended. Integration tests are critical for E2E flows. Manual testing is required for cross-platform scenarios.
- **UI/UX Priority**: Smooth animations and intuitive flows are essential. Target 60 FPS for all animations.

### Complexity Estimation

- **Low**: 1-2 days
- **Medium**: 3-5 days
- **High**: 5-10 days
- **Very High**: 10-15 days
- **Manual Testing**: Variable duration

### Dependencies and Prerequisites

- **Epic Dependencies**: 
  - Epic 4 (Wi-Fi Direct) requires Epic 3 (QR Code) and Epic 2 (NFC) for credential exchange
  - Epic 6 (Download Client) requires Epic 5 (HTTP Server) to be functional
  - Epic 8 (Media Library) requires Epic 7 (Integrity Checker) for validation
  - Epic 15 (Local Network) requires Epic 14 (Platform Detection)
  - Epic 19 (Subscriptions) can be developed in parallel with other epics

- **Platform Requirements**:
  - Android: Min SDK 21 (Lollipop), Target SDK 34
  - iOS: Min iOS 13.0
  - Desktop: Windows 10+, Ubuntu 20.04+, macOS 11+

### Risk Mitigation

- **Wi-Fi Direct on iOS**: iOS doesn't support true Wi-Fi Direct. We use Hotspot mode as alternative. This may have limitations.
- **NFC on Desktop**: NFC is not available on desktop. QR Code + webcam is the primary pairing method.
- **Local Network Restrictions**: Desktop transfers require devices on same local network. This is a hard requirement and cannot be bypassed without Internet.

### Success Criteria

- **Transfer Speed**: Average > 20 MB/s on Wi-Fi Direct
- **Success Rate**: > 95% for transfers without user cancellation
- **Connection Time**: < 15 seconds from NFC tap to transfer start
- **User Rating**: Target 4.5+/5 stars for feature
- **Quota Enforcement**: 100% accuracy for FREE user limits

---

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1", "1.2"]
    },
    {
      "id": 1,
      "tasks": ["1.3", "1.4"]
    },
    {
      "id": 2,
      "tasks": ["2.1.1", "3.1.1", "12.1.1"]
    },
    {
      "id": 3,
      "tasks": ["2.1.2", "2.1.3", "2.1.4", "2.2", "3.1.2", "3.2.1"]
    },
    {
      "id": 4,
      "tasks": ["3.2.2", "3.2.3", "4.1.1"]
    },
    {
      "id": 5,
      "tasks": ["4.1.2", "4.1.3"]
    },
    {
      "id": 6,
      "tasks": ["4.1.4"]
    },
    {
      "id": 7,
      "tasks": ["4.2.1", "4.2.2", "4.3"]
    },
    {
      "id": 8,
      "tasks": ["4.4", "4.5", "5.1.1"]
    },
    {
      "id": 9,
      "tasks": ["5.1.2", "5.1.3", "5.1.4"]
    },
    {
      "id": 10,
      "tasks": ["5.1.5", "5.2", "6.1.1"]
    },
    {
      "id": 11,
      "tasks": ["6.1.2", "6.1.3", "6.1.4"]
    },
    {
      "id": 12,
      "tasks": ["6.1.5", "6.1.6", "6.2"]
    },
    {
      "id": 13,
      "tasks": ["7.1.1", "7.1.2"]
    },
    {
      "id": 14,
      "tasks": ["7.1.3", "7.1.4", "7.2"]
    },
    {
      "id": 15,
      "tasks": ["8.1.1", "8.1.2", "8.1.3"]
    },
    {
      "id": 16,
      "tasks": ["8.1.4", "8.2", "9.1"]
    },
    {
      "id": 17,
      "tasks": ["9.2.1"]
    },
    {
      "id": 18,
      "tasks": ["9.2.2", "9.2.3", "9.3"]
    },
    {
      "id": 19,
      "tasks": ["9.4", "10.1", "10.2"]
    },
    {
      "id": 20,
      "tasks": ["10.3", "10.4"]
    },
    {
      "id": 21,
      "tasks": ["10.5.1", "10.5.2", "10.5.3"]
    },
    {
      "id": 22,
      "tasks": ["10.5.4", "10.6", "10.7"]
    },
    {
      "id": 23,
      "tasks": ["11.1", "11.2.1"]
    },
    {
      "id": 24,
      "tasks": ["11.2.2", "11.2.3", "11.3"]
    },
    {
      "id": 25,
      "tasks": ["11.4", "12.1.2", "12.1.3"]
    },
    {
      "id": 26,
      "tasks": ["12.2", "12.3", "13.1"]
    },
    {
      "id": 27,
      "tasks": ["13.2", "13.3", "13.4", "13.5"]
    },
    {
      "id": 28,
      "tasks": ["13.6"]
    },
    {
      "id": 29,
      "tasks": ["14.1", "14.2"]
    },
    {
      "id": 30,
      "tasks": ["14.3"]
    },
    {
      "id": 31,
      "tasks": ["15.1.1", "15.1.2"]
    },
    {
      "id": 32,
      "tasks": ["15.1.3", "15.1.4", "15.2"]
    },
    {
      "id": 33,
      "tasks": ["16.1", "16.2.1"]
    },
    {
      "id": 34,
      "tasks": ["16.2.2", "16.2.3", "16.3.1"]
    },
    {
      "id": 35,
      "tasks": ["16.3.2", "16.3.3"]
    },
    {
      "id": 36,
      "tasks": ["17.1", "17.2", "17.3"]
    },
    {
      "id": 37,
      "tasks": ["17.4", "17.5"]
    },
    {
      "id": 38,
      "tasks": ["19.1.1", "19.1.2"]
    },
    {
      "id": 39,
      "tasks": ["19.1.3", "19.1.4", "19.1.5"]
    },
    {
      "id": 40,
      "tasks": ["19.2", "19.3", "19.4"]
    },
    {
      "id": 41,
      "tasks": ["19.5", "20.1"]
    },
    {
      "id": 42,
      "tasks": ["20.2", "20.3", "20.4"]
    },
    {
      "id": 43,
      "tasks": ["20.5", "21.1", "21.2"]
    },
    {
      "id": 44,
      "tasks": ["21.3", "21.4", "21.5", "21.6"]
    },
    {
      "id": 45,
      "tasks": ["22.1", "22.2", "22.3"]
    },
    {
      "id": 46,
      "tasks": ["22.4", "22.5", "22.6"]
    },
    {
      "id": 47,
      "tasks": ["23.2", "23.3"]
    }
  ]
}
```

### Dependency Graph Notes

- **Wave 0**: Initial project setup (folder structure, dependencies)
- **Waves 1-2**: Core architecture and models
- **Waves 2-8**: NFC, QR Code, and Wi-Fi Direct implementation (critical path for mobile P2P)
- **Waves 9-12**: HTTP server and download client (file transfer core)
- **Waves 13-16**: Integrity checking and media library integration
- **Waves 17-22**: UI implementation (sender and receiver flows)
- **Waves 23-28**: Error handling, permissions, and optimizations
- **Waves 29-37**: Desktop support extension (platform detection, local network, desktop UI)
- **Waves 38-44**: Subscription system, resume functionality, advanced error handling
- **Waves 45-47**: Final polish (animations, performance, testing)

### Parallelization Strategy

- **Early waves** (0-5): High parallelization potential - multiple services can be developed simultaneously
- **Middle waves** (6-22): Moderate parallelization - UI components can be built in parallel with backend services
- **Late waves** (23-47): Lower parallelization - many tasks depend on integration and testing of previous work

**Estimated Total Development Time**: 18 weeks (with 1 sprint = 1 week)
