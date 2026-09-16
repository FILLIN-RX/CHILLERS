import 'transfer_enums.dart';

/// Progress information for an active transfer
/// 
/// Emitted by TransferManager via progressStream to track
/// real-time transfer status and metrics.
class TransferProgress {
  /// Session ID this progress belongs to
  final String sessionId;
  
  /// Current transfer state
  final TransferState state;
  
  /// Progress as a value from 0.0 to 1.0
  final double progress;
  
  /// Number of bytes transferred so far
  final int transferredBytes;
  
  /// Total file size in bytes
  final int totalBytes;
  
  /// Current transfer speed in bytes per second
  final double currentSpeed;
  
  /// Estimated time remaining
  final Duration? estimatedTimeRemaining;
  
  /// Optional status message
  final String? statusMessage;

  TransferProgress({
    required this.sessionId,
    required this.state,
    required this.progress,
    required this.transferredBytes,
    required this.totalBytes,
    required this.currentSpeed,
    this.estimatedTimeRemaining,
    this.statusMessage,
  });

  /// Creates initial progress with no transfer started
  factory TransferProgress.initial(String sessionId, int totalBytes) {
    return TransferProgress(
      sessionId: sessionId,
      state: TransferState.idle,
      progress: 0.0,
      transferredBytes: 0,
      totalBytes: totalBytes,
      currentSpeed: 0.0,
    );
  }

  /// Validates progress values are within expected ranges
  bool isValid() {
    return progress >= 0.0 &&
        progress <= 1.0 &&
        transferredBytes >= 0 &&
        transferredBytes <= totalBytes &&
        currentSpeed >= 0.0;
  }

  /// Checks if transfer is complete
  bool get isComplete {
    return state == TransferState.completed;
  }

  /// Checks if transfer is in progress
  bool get isInProgress {
    return state == TransferState.transferring;
  }

  /// Checks if transfer has failed
  bool get hasFailed {
    return state == TransferState.error;
  }

  /// Checks if transfer was cancelled
  bool get wasCancelled {
    return state == TransferState.cancelled;
  }

  /// Formatted speed string (e.g., "25.3 MB/s")
  String get formattedSpeed {
    if (currentSpeed < 1024) {
      return '${currentSpeed.toStringAsFixed(0)} B/s';
    }
    if (currentSpeed < 1024 * 1024) {
      return '${(currentSpeed / 1024).toStringAsFixed(1)} KB/s';
    }
    return '${(currentSpeed / (1024 * 1024)).toStringAsFixed(1)} MB/s';
  }

  /// Formatted time remaining (e.g., "2m 35s")
  String get formattedTimeRemaining {
    if (estimatedTimeRemaining == null) return 'Calculating...';
    final seconds = estimatedTimeRemaining!.inSeconds;
    if (seconds < 60) return '${seconds}s';
    final minutes = seconds ~/ 60;
    final remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return '${minutes}m ${remainingSeconds}s';
    }
    final hours = minutes ~/ 60;
    final remainingMinutes = minutes % 60;
    return '${hours}h ${remainingMinutes}m';
  }

  /// Formatted bytes transferred (e.g., "512 MB / 1.2 GB")
  String get formattedBytesTransferred {
    return '${_formatBytes(transferredBytes)} / ${_formatBytes(totalBytes)}';
  }

  /// Progress percentage (0-100)
  int get progressPercentage {
    return (progress * 100).round();
  }

  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(0)} KB';
    }
    if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(0)} MB';
    }
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(2)} GB';
  }

  /// Serializes to JSON
  Map<String, dynamic> toJson() {
    return {
      'sessionId': sessionId,
      'state': state.name,
      'progress': progress,
      'transferredBytes': transferredBytes,
      'totalBytes': totalBytes,
      'currentSpeed': currentSpeed,
      'estimatedTimeRemaining': estimatedTimeRemaining?.inSeconds,
      'statusMessage': statusMessage,
    };
  }

  /// Deserializes from JSON
  factory TransferProgress.fromJson(Map<String, dynamic> json) {
    return TransferProgress(
      sessionId: json['sessionId'] as String,
      state: TransferState.values.firstWhere(
        (e) => e.name == json['state'],
        orElse: () => TransferState.idle,
      ),
      progress: (json['progress'] as num).toDouble(),
      transferredBytes: json['transferredBytes'] as int,
      totalBytes: json['totalBytes'] as int,
      currentSpeed: (json['currentSpeed'] as num).toDouble(),
      estimatedTimeRemaining: json['estimatedTimeRemaining'] != null
          ? Duration(seconds: json['estimatedTimeRemaining'] as int)
          : null,
      statusMessage: json['statusMessage'] as String?,
    );
  }

  @override
  String toString() {
    return 'TransferProgress(session: $sessionId, state: ${state.name}, progress: $progressPercentage%, speed: $formattedSpeed)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is TransferProgress &&
        other.sessionId == sessionId &&
        other.state == state &&
        other.progress == progress &&
        other.transferredBytes == transferredBytes;
  }

  @override
  int get hashCode {
    return Object.hash(sessionId, state, progress, transferredBytes);
  }

  /// Creates a copy with updated fields
  TransferProgress copyWith({
    String? sessionId,
    TransferState? state,
    double? progress,
    int? transferredBytes,
    int? totalBytes,
    double? currentSpeed,
    Duration? estimatedTimeRemaining,
    String? statusMessage,
  }) {
    return TransferProgress(
      sessionId: sessionId ?? this.sessionId,
      state: state ?? this.state,
      progress: progress ?? this.progress,
      transferredBytes: transferredBytes ?? this.transferredBytes,
      totalBytes: totalBytes ?? this.totalBytes,
      currentSpeed: currentSpeed ?? this.currentSpeed,
      estimatedTimeRemaining:
          estimatedTimeRemaining ?? this.estimatedTimeRemaining,
      statusMessage: statusMessage ?? this.statusMessage,
    );
  }
}
