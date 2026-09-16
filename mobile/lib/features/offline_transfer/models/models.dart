library;

/// Barrel file for offline transfer models
/// 
/// This file exports all model classes used in the offline P2P transfer feature.
/// Import this file to access all models: `import 'package:chillers_mobile/features/offline_transfer/models/models.dart';`

// Connection and transfer session models
export 'connection_credentials.dart';
export 'transfer_session.dart';
export 'transfer_progress.dart';

// Media and chunk models
export 'media_metadata.dart';
export 'download_chunk.dart';

// Enums
export 'transfer_enums.dart';
