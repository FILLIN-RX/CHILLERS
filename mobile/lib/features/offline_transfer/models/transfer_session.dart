import 'connection_credentials.dart';
import 'media_metadata.dart';
import 'transfer_enums.dart';

/// Represents an active transfer session between two devices
/// 
/// Tracks all state, progress, and metadata for a P2P file transfer.
class TransferSession {
  /// Unique session identifier (UUID)
  final String id;
  
  /// Role of this device (sender or receiver)
  final TransferRole role;
  
  /// Media being transferred
  final MediaMetadata media;
  
  /// Connection information
  final ConnectionCredentials credentials;
  
  /// Current transfer state
  final TransferState state;
  
  /// When the session started
  final DateTime startedAt;
  
  /// When the session completed (if finished)
  final DateTime? completedAt;
  
  /// Total file size in bytes
  final int totalBytes;
  
  /// Number of bytes transferred so far
  final int transferredBytes;
  
  /// Current transfer speed in bytes per second
  final double currentSpeed;
  
  /// Estimated time remaining
  final Duration? estimatedTimeRemaining;
  
  /// Error message if failed
  final String? errorMessage;
  
  /// Number of retry attempts made
  final int retryCount;

  TransferSession({
    required this.id,
    required this.role,
    required this.media,
    required this.credentials,
    required this.state,
    required this.startedAt,
    this.completedAt,
    required this.totalBytes,
    this.transferredBytes = 0,
    this.currentSpeed = 0.0,
    this.estimatedTimeRemaining,
    this.errorMessage,
    this.retryCount = 0,
  });

  /// Creates a new sender session
  factory TransferSession.sender({
    required String id,
    required MediaMetadata media,
    required ConnectionCredentials credentials,
  }) {
    return TransferSession(
      id: id,
      role: TransferRole.sender,
      media: media,
      credentials: credentials,
      state: TransferState.pairingMode,
      startedAt: DateTime.now(),
      totalBytes: media.fileSize,
    );
  }

  /// Creates a new receiver session
  factory TransferSession.receiver({
    required String id,
    required MediaMetadata media,
    required ConnectionCredentials credentials,
  }) {
    return TransferSession(
      id: id,
      role: TransferRole.receiver,
      media: media,
      credentials: credentials,
      state: TransferState.awaitingConnection,
      startedAt: DateTime.now(),
      totalBytes: media.fileSize,
    );
  }

  /// Progress as a value from 0.0 to 1.0
  double get progress {
    if (totalBytes == 0) return 0.0;
    return (transferredBytes / totalBytes).clamp(0.0, 1.0);
  }

  /// Progress percentage (0-100)
  int get progressPercentage {
    return (progress * 100).round();
  }

  /// Checks if the session has expired
  bool get isExpired {
    return credentials.expiresAt.isBefore(DateTime.now());
  }

  /// Checks if the transfer can be resumed
  bool get canResume {
    return state == TransferState.interrupted && retryCount < 5;
  }

  /// Checks if the session is in a terminal state
  bool get isFinished {
    return state == TransferState.completed ||
        state == TransferState.cancelled ||
        state == TransferState.error;
  }

  /// Checks if actively transferring
  bool get isTransferring {
    return state == TransferState.transferring;
  }

  /// Checks if the session is currently active (not in terminal state)
  bool get isActive => !isFinished;

  /// Checks if the session is in a terminal state
  bool get isTerminal => isFinished;

  /// Checks if waiting for connection
  bool get isWaitingForConnection {
    return state == TransferState.pairingMode ||
        state == TransferState.awaitingConnection;
  }

  /// Duration of the transfer so far
  Duration get duration {
    final endTime = completedAt ?? DateTime.now();
    return endTime.difference(startedAt);
  }

  /// Average transfer speed in bytes per second
  double get averageSpeed {
    final durationSeconds = duration.inMilliseconds / 1000;
    if (durationSeconds == 0) return 0.0;
    return transferredBytes / durationSeconds;
  }

  /// Formatted average speed
  String get formattedAverageSpeed {
    if (averageSpeed < 1024) {
      return '${averageSpeed.toStringAsFixed(0)} B/s';
    }
    if (averageSpeed < 1024 * 1024) {
      return '${(averageSpeed / 1024).toStringAsFixed(1)} KB/s';
    }
    return '${(averageSpeed / (1024 * 1024)).toStringAsFixed(1)} MB/s';
  }

  /// Validates session data
  bool isValid() {
    return id.isNotEmpty &&
        media.isValid() &&
        credentials.isValid() &&
        totalBytes > 0 &&
        transferredBytes >= 0 &&
        transferredBytes <= totalBytes &&
        currentSpeed >= 0.0 &&
        retryCount >= 0;
  }

  /// Serializes to JSON for persistence
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'role': role.name,
      'media': media.toJson(),
      'credentials': credentials.toJson(),
      'state': state.name,
      'startedAt': startedAt.millisecondsSinceEpoch,
      'completedAt': completedAt?.millisecondsSinceEpoch,
      'totalBytes': totalBytes,
      'transferredBytes': transferredBytes,
      'currentSpeed': currentSpeed,
      'estimatedTimeRemaining': estimatedTimeRemaining?.inSeconds,
      'errorMessage': errorMessage,
      'retryCount': retryCount,
    };
  }

  /// Deserializes from JSON
  factory TransferSession.fromJson(Map<String, dynamic> json) {
    return TransferSession(
      id: json['id'] as String,
      role: TransferRole.values.firstWhere(
        (e) => e.name == json['role'],
        orElse: () => TransferRole.receiver,
      ),
      media: MediaMetadata.fromJson(json['media'] as Map<String, dynamic>),
      credentials: ConnectionCredentials.fromJson(
          json['credentials'] as Map<String, dynamic>),
      state: TransferState.values.firstWhere(
        (e) => e.name == json['state'],
        orElse: () => TransferState.idle,
      ),
      startedAt:
          DateTime.fromMillisecondsSinceEpoch(json['startedAt'] as int),
      completedAt: json['completedAt'] != null
          ? DateTime.fromMillisecondsSinceEpoch(json['completedAt'] as int)
          : null,
      totalBytes: json['totalBytes'] as int,
      transferredBytes: json['transferredBytes'] as int? ?? 0,
      currentSpeed: (json['currentSpeed'] as num?)?.toDouble() ?? 0.0,
      estimatedTimeRemaining: json['estimatedTimeRemaining'] != null
          ? Duration(seconds: json['estimatedTimeRemaining'] as int)
          : null,
      errorMessage: json['errorMessage'] as String?,
      retryCount: json['retryCount'] as int? ?? 0,
    );
  }

  @override
  String toString() {
    return 'TransferSession(id: $id, role: ${role.name}, state: ${state.name}, progress: $progressPercentage%)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is TransferSession &&
        other.id == id &&
        other.role == role &&
        other.state == state;
  }

  @override
  int get hashCode {
    return Object.hash(id, role, state);
  }

  /// Creates a copy with updated fields
  TransferSession copyWith({
    String? id,
    TransferRole? role,
    MediaMetadata? media,
    ConnectionCredentials? credentials,
    TransferState? state,
    DateTime? startedAt,
    DateTime? completedAt,
    int? totalBytes,
    int? transferredBytes,
    double? currentSpeed,
    Duration? estimatedTimeRemaining,
    String? errorMessage,
    int? retryCount,
  }) {
    return TransferSession(
      id: id ?? this.id,
      role: role ?? this.role,
      media: media ?? this.media,
      credentials: credentials ?? this.credentials,
      state: state ?? this.state,
      startedAt: startedAt ?? this.startedAt,
      completedAt: completedAt ?? this.completedAt,
      totalBytes: totalBytes ?? this.totalBytes,
      transferredBytes: transferredBytes ?? this.transferredBytes,
      currentSpeed: currentSpeed ?? this.currentSpeed,
      estimatedTimeRemaining:
          estimatedTimeRemaining ?? this.estimatedTimeRemaining,
      errorMessage: errorMessage ?? this.errorMessage,
      retryCount: retryCount ?? this.retryCount,
    );
  }

  /// Updates progress and speed metrics
  TransferSession updateProgress({
    required int transferredBytes,
    required double currentSpeed,
    Duration? estimatedTimeRemaining,
  }) {
    return copyWith(
      transferredBytes: transferredBytes,
      currentSpeed: currentSpeed,
      estimatedTimeRemaining: estimatedTimeRemaining,
    );
  }

  /// Transitions to a new state
  TransferSession transitionTo(TransferState newState, {String? errorMessage}) {
    return copyWith(
      state: newState,
      errorMessage: errorMessage,
      completedAt: newState == TransferState.completed ||
              newState == TransferState.cancelled ||
              newState == TransferState.error
          ? DateTime.now()
          : null,
    );
  }

  /// Increments retry count
  TransferSession incrementRetry() {
    return copyWith(retryCount: retryCount + 1);
  }

  /// Resets retry count
  TransferSession resetRetry() {
    return copyWith(retryCount: 0);
  }
}
