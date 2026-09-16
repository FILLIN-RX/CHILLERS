library;

/// Barrel file for offline transfer services
/// 
/// This file exports all service classes used in the offline P2P transfer feature.
/// Import this file to access all services: `import 'package:chillers_mobile/features/offline_transfer/services/services.dart';`

// Core transfer management
export 'transfer_manager.dart';

// Pairing & Networking
export 'nfc_service.dart';
export 'qr_generator.dart';
export 'qr_scanner.dart';
export 'wifi_direct_manager.dart';

// HTTP Transfer
export 'local_http_server.dart';
export 'http_download_client.dart';

// Integrity & Library Integration
export 'integrity_checker.dart';
export 'media_library_adapter.dart';
