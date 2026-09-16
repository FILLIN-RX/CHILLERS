library;

/// Constants used across the offline P2P transfer module
class TransferConstants {
  /// Default chunk size in bytes (1 MB)
  static const int chunkSize = 1024 * 1024;

  /// Default timeout for HTTP requests (seconds)
  static const int httpTimeoutSeconds = 15;

  /// Maximum retry attempts for failed chunks
  static const int maxChunkRetries = 3;

  /// Maximum concurrent chunk downloads
  static const int maxConcurrentChunks = 4;

  /// Default HTTP port range
  static const int defaultMinPort = 8000;
  static const int defaultMaxPort = 9000;

  /// SSID prefix for Wi-Fi Direct
  static const String ssidPrefix = 'CHILLERS_P2P_';
}
