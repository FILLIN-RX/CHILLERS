/// Enumerations for the offline P2P transfer feature
library;

/// Role of the device in a transfer session
enum TransferRole {
  /// Device sending the media file
  sender,

  /// Device receiving the media file
  receiver,
}

/// Current state of a transfer session
/// 
/// State machine transitions:
/// - Idle → PairingMode (user initiates share)
/// - PairingMode → AwaitingConnection (pairing successful)
/// - PairingMode → Error (timeout after 60s)
/// - AwaitingConnection → Connected (WiFi Direct established)
/// - AwaitingConnection → Error (connection failed after 3 retries)
/// - Connected → Transferring (HTTP session started)
/// - Transferring → Verifying (all chunks downloaded)
/// - Transferring → Interrupted (connection lost)
/// - Transferring → Cancelled (user cancelled)
/// - Interrupted → Transferring (auto-reconnect within 60s)
/// - Interrupted → Error (reconnect failed)
/// - Verifying → Completed (SHA-256 match)
/// - Verifying → Error (SHA-256 mismatch)
/// - Completed → Integrating (moving to library)
/// - Integrating → Success (media added to library)
enum TransferState {
  /// No active transfer
  idle,

  /// Waiting for pairing (NFC tap or QR scan)
  pairingMode,

  /// Pairing successful, waiting for network connection
  awaitingConnection,

  /// Network connection established
  connected,

  /// File transfer in progress
  transferring,

  /// Transfer temporarily interrupted (connection lost)
  interrupted,

  /// Verifying file integrity (SHA-256 check)
  verifying,

  /// Transfer completed successfully, integrating into library
  integrating,

  /// Transfer completed and integrated
  completed,

  /// Transfer cancelled by user
  cancelled,

  /// Transfer failed with error
  error,

  /// Final success state
  success,
}

/// Status of a download chunk
enum ChunkStatus {
  /// Chunk not yet downloaded
  pending,

  /// Chunk currently being downloaded
  downloading,

  /// Chunk downloaded successfully
  completed,

  /// Chunk download failed
  failed,
}

/// Connection status for WiFi Direct or Local Network
enum ConnectionStatus {
  /// Not connected
  disconnected,

  /// Connection in progress
  connecting,

  /// Connected and ready
  connected,

  /// Connection lost
  connectionLost,

  /// Connection failed
  failed,
}
