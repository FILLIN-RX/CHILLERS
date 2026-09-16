library;

import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../models/connection_credentials.dart';
import '../models/media_metadata.dart';
import '../models/transfer_enums.dart';
import '../models/transfer_progress.dart';
import '../models/transfer_session.dart';
import 'http_download_client.dart';
import 'integrity_checker.dart';
import 'local_http_server.dart';
import 'media_library_adapter.dart';
import 'nfc_service.dart';
import 'wifi_direct_manager.dart';

/// Central coordinator and state machine orchestrating P2P offline media transfers
class TransferManager {
  static TransferManager? _instance;

  final Map<String, TransferSession> _sessions = {};
  final Map<String, StreamController<TransferProgress>> _progressControllers = {};
  final Map<String, StreamController<TransferState>> _statusControllers = {};

  final WiFiDirectManager _wifiDirectManager = WiFiDirectManager();
  final LocalHTTPServer _httpServer = LocalHTTPServer();
  final HTTPDownloadClient _downloadClient = HTTPDownloadClient();
  final NFCService _nfcService = NFCService();
  final IntegrityChecker _integrityChecker = IntegrityChecker();
  final MediaLibraryAdapter _mediaLibrary = MediaLibraryAdapter();

  TransferManager._();

  /// Gets singleton instance of TransferManager
  factory TransferManager() {
    _instance ??= TransferManager._();
    return _instance!;
  }

  WiFiDirectManager get wifiDirectManager => _wifiDirectManager;
  LocalHTTPServer get httpServer => _httpServer;
  HTTPDownloadClient get downloadClient => _downloadClient;
  NFCService get nfcService => _nfcService;
  IntegrityChecker get integrityChecker => _integrityChecker;
  MediaLibraryAdapter get mediaLibrary => _mediaLibrary;

  /// Progress stream for a given transfer session
  Stream<TransferProgress> progressStream(String sessionId) {
    _progressControllers.putIfAbsent(
      sessionId,
      () => StreamController<TransferProgress>.broadcast(),
    );
    return _progressControllers[sessionId]!.stream;
  }

  /// Status stream for a given transfer session
  Stream<TransferState> statusStream(String sessionId) {
    _statusControllers.putIfAbsent(
      sessionId,
      () => StreamController<TransferState>.broadcast(),
    );
    return _statusControllers[sessionId]!.stream;
  }

  /// Gets active session by ID
  TransferSession? getSession(String sessionId) => _sessions[sessionId];

  /// Initiates sender flow for a local media file
  Future<TransferSession> initiateShare({
    required MediaMetadata metadata,
    required String localFilePath,
  }) async {
    final sessionId = const Uuid().v4();

    // 1. Create Wi-Fi access point / Direct group
    final credentials = await _wifiDirectManager.createAccessPoint();

    // 2. Start local HTTP server
    await _httpServer.start(
      filePath: localFilePath,
      metadata: metadata,
      minPort: credentials.port,
      maxPort: credentials.port,
    );

    // 3. Create session
    final session = TransferSession(
      id: sessionId,
      role: TransferRole.sender,
      media: metadata,
      credentials: credentials,
      state: TransferState.pairingMode,
      startedAt: DateTime.now(),
      totalBytes: metadata.fileSize,
    );

    _sessions[sessionId] = session;
    _emitState(sessionId, TransferState.pairingMode);

    // 4. Start NFC broadcast if available in background
    _nfcService.startEmission(credentials);

    return session;
  }

  /// Initiates receiver flow given credentials
  Future<TransferSession> initiateReceive({
    required ConnectionCredentials credentials,
    required String destinationFilePath,
  }) async {
    final sessionId = const Uuid().v4();

    // Initial placeholder metadata (will be fetched via HTTP)
    final initialMetadata = MediaMetadata(
      title: 'Transfert en cours...',
      mediaType: 'movie',
      fileSize: 0,
      sha256: '',
    );

    final session = TransferSession(
      id: sessionId,
      role: TransferRole.receiver,
      media: initialMetadata,
      credentials: credentials,
      state: TransferState.awaitingConnection,
      startedAt: DateTime.now(),
      totalBytes: 0,
    );

    _sessions[sessionId] = session;
    _emitState(sessionId, TransferState.awaitingConnection);

    // Start background receiver routine
    _runReceiverTransfer(
      sessionId: sessionId,
      credentials: credentials,
      destinationFilePath: destinationFilePath,
    );

    return session;
  }

  /// Background receiver routine coordinating connection, download, verification and saving
  Future<void> _runReceiverTransfer({
    required String sessionId,
    required ConnectionCredentials credentials,
    required String destinationFilePath,
  }) async {
    try {
      // 1. Connect to sender AP
      _emitState(sessionId, TransferState.awaitingConnection);
      final connected = await _wifiDirectManager.connect(credentials);
      if (!connected) {
        _failSession(sessionId, 'Échec de connexion au point d\'accès Wi-Fi');
        return;
      }

      _emitState(sessionId, TransferState.connected);

      // 2. Fetch metadata from sender
      final metadata = await _downloadClient.fetchMetadata(
        credentials.ip,
        credentials.port,
      );

      _sessions[sessionId] = _sessions[sessionId]!.copyWith(
        media: metadata,
        totalBytes: metadata.fileSize,
      );

      // 3. Start chunked file download
      _emitState(sessionId, TransferState.transferring);

      final downloadSubscription = _downloadClient.progressStream.listen((progress) {
        _emitProgress(sessionId, progress);
      });

      final success = await _downloadClient.downloadFile(
        sessionId: sessionId,
        ip: credentials.ip,
        port: credentials.port,
        metadata: metadata,
        destinationPath: destinationFilePath,
      );

      await downloadSubscription.cancel();

      if (!success) {
        _failSession(sessionId, 'Téléchargement interrompu ou annulé');
        return;
      }

      // 4. Verify file integrity (SHA-256)
      _emitState(sessionId, TransferState.verifying);
      final isValid = await _integrityChecker.verifyFileIntegrity(
        destinationFilePath,
        metadata.sha256,
        onProgress: (p) {
          _emitProgress(
            sessionId,
            TransferProgress(
              sessionId: sessionId,
              state: TransferState.verifying,
              progress: p,
              transferredBytes: (metadata.fileSize * p).round(),
              totalBytes: metadata.fileSize,
              currentSpeed: 0,
              statusMessage: 'Vérification de l\'intégrité (SHA-256)...',
            ),
          );
        },
      );

      if (!isValid) {
        _failSession(sessionId, 'Erreur d\'intégrité : Le fichier reçu est corrompu');
        return;
      }

      // 5. Integrate into media library
      _emitState(sessionId, TransferState.integrating);
      await _mediaLibrary.saveReceivedMedia(
        tempFilePath: destinationFilePath,
        metadata: metadata,
      );

      // 6. Complete & Success
      _emitState(sessionId, TransferState.completed);
      _emitState(sessionId, TransferState.success);
    } catch (e) {
      _failSession(sessionId, 'Erreur de transfert : $e');
    } finally {
      // Disconnect Wi-Fi
      await _wifiDirectManager.disconnect();
    }
  }

  /// Cancels an active transfer session
  Future<void> cancelTransfer(String sessionId) async {
    final session = _sessions[sessionId];
    if (session == null || !session.isActive) return;

    _downloadClient.cancel();
    await _httpServer.stop();
    await _nfcService.stopSession();
    await _wifiDirectManager.disconnect();

    _emitState(sessionId, TransferState.cancelled);
  }

  /// Pauses an active transfer
  void pauseTransfer(String sessionId) {
    _downloadClient.pause();
    _emitState(sessionId, TransferState.interrupted);
  }

  /// Resumes a paused transfer
  void resumeTransfer(String sessionId) {
    _downloadClient.resume();
    _emitState(sessionId, TransferState.transferring);
  }

  void _emitState(String sessionId, TransferState state, {String? error}) {
    if (_sessions.containsKey(sessionId)) {
      _sessions[sessionId] = _sessions[sessionId]!.transitionTo(
        state,
        errorMessage: error,
      );
    }
    _statusControllers[sessionId]?.add(state);
  }

  void _emitProgress(String sessionId, TransferProgress progress) {
    if (_sessions.containsKey(sessionId)) {
      _sessions[sessionId] = _sessions[sessionId]!.updateProgress(
        transferredBytes: progress.transferredBytes,
        currentSpeed: progress.currentSpeed,
        estimatedTimeRemaining: progress.estimatedTimeRemaining,
      );
    }
    _progressControllers[sessionId]?.add(progress);
  }

  void _failSession(String sessionId, String errorMessage) {
    debugPrint('[TransferManager] Session $sessionId failed: $errorMessage');
    _emitState(sessionId, TransferState.error, error: errorMessage);
    _emitProgress(
      sessionId,
      TransferProgress(
        sessionId: sessionId,
        state: TransferState.error,
        progress: 0,
        transferredBytes: 0,
        totalBytes: _sessions[sessionId]?.totalBytes ?? 0,
        currentSpeed: 0,
        statusMessage: errorMessage,
      ),
    );
  }

  /// Cleans up all sessions and controllers
  void dispose() {
    _nfcService.dispose();
    _wifiDirectManager.dispose();
    _downloadClient.dispose();
    _httpServer.stop();
    for (final c in _progressControllers.values) {
      c.close();
    }
    for (final c in _statusControllers.values) {
      c.close();
    }
    _progressControllers.clear();
    _statusControllers.clear();
    _sessions.clear();
  }
}
