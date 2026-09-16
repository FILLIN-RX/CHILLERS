library;

/// Offline P2P Transfer Feature Module
/// 
/// This module provides peer-to-peer file transfer functionality for offline media sharing.
/// It supports NFC/QR code pairing and Wi-Fi Direct/Local Network transfers.
/// 
/// ## Features
/// - NFC tap-to-pair (Mobile only)
/// - QR code pairing (Mobile and Desktop)
/// - Wi-Fi Direct transfers (Mobile-to-Mobile)
/// - Local network transfers (Desktop support)
/// - Chunked file transfer with resume support
/// - SHA-256 integrity verification
/// - Real-time progress tracking
/// - Multi-platform support (Android, iOS, Windows, Linux, macOS)
/// 
/// ## Usage
/// ```dart
/// import 'package:chillers_mobile/features/offline_transfer/offline_transfer.dart';
/// 
/// // Initialize transfer manager
/// final transferManager = TransferManager();
/// 
/// // Start sharing (Sender)
/// final session = await transferManager.initiateShare(mediaItem);
/// 
/// // Receive file (Receiver)
/// final session = await transferManager.initiateReceive(credentials);
/// ```
/// 
/// ## Requirements
/// This feature implements requirements 12.1 and 12.2:
/// - 12.1: Multi-platform support (Mobile ↔ Desktop)
/// - 12.2: Platform-specific connection strategies

// Export all public APIs
export 'models/models.dart';
export 'services/services.dart';
export 'ui/ui.dart';
export 'utils/utils.dart';
