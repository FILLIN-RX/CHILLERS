import 'transfer_enums.dart';

/// Represents a single chunk of file data during download
/// 
/// Files are transferred in 1 MB chunks for progress tracking
/// and resume capability.
class DownloadChunk {
  /// Chunk index (0-based)
  final int index;
  
  /// Byte offset in the file where this chunk starts
  final int offset;
  
  /// Size of this chunk in bytes
  final int length;
  
  /// Current status of the chunk
  final ChunkStatus status;
  
  /// Number of times this chunk has been retried
  final int retryCount;
  
  /// When the download of this chunk started
  final DateTime? startedAt;
  
  /// When the download of this chunk completed
  final DateTime? completedAt;

  DownloadChunk({
    required this.index,
    required this.offset,
    required this.length,
    this.status = ChunkStatus.pending,
    this.retryCount = 0,
    this.startedAt,
    this.completedAt,
  });

  /// Validates that chunk parameters are correct
  bool isValid() {
    return index >= 0 && offset >= 0 && length > 0;
  }

  /// Checks if this chunk has exceeded max retry attempts
  bool hasExceededMaxRetries({int maxRetries = 3}) {
    return retryCount >= maxRetries;
  }

  /// Calculates download duration if completed
  Duration? get downloadDuration {
    if (startedAt == null || completedAt == null) return null;
    return completedAt!.difference(startedAt!);
  }

  /// Calculates download speed for this chunk in bytes/second
  double? get downloadSpeed {
    final duration = downloadDuration;
    if (duration == null || duration.inMilliseconds == 0) return null;
    return length / (duration.inMilliseconds / 1000);
  }

  /// Serializes to JSON for persistence
  Map<String, dynamic> toJson() {
    return {
      'index': index,
      'offset': offset,
      'length': length,
      'status': status.name,
      'retryCount': retryCount,
      'startedAt': startedAt?.millisecondsSinceEpoch,
      'completedAt': completedAt?.millisecondsSinceEpoch,
    };
  }

  /// Deserializes from JSON
  factory DownloadChunk.fromJson(Map<String, dynamic> json) {
    return DownloadChunk(
      index: json['index'] as int,
      offset: json['offset'] as int,
      length: json['length'] as int,
      status: ChunkStatus.values.firstWhere(
        (e) => e.name == json['status'],
        orElse: () => ChunkStatus.pending,
      ),
      retryCount: json['retryCount'] as int? ?? 0,
      startedAt: json['startedAt'] != null
          ? DateTime.fromMillisecondsSinceEpoch(json['startedAt'] as int)
          : null,
      completedAt: json['completedAt'] != null
          ? DateTime.fromMillisecondsSinceEpoch(json['completedAt'] as int)
          : null,
    );
  }

  @override
  String toString() {
    return 'DownloadChunk(index: $index, offset: $offset, length: $length, status: ${status.name}, retries: $retryCount)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is DownloadChunk &&
        other.index == index &&
        other.offset == offset &&
        other.length == length;
  }

  @override
  int get hashCode {
    return Object.hash(index, offset, length);
  }

  /// Creates a copy with updated fields
  DownloadChunk copyWith({
    int? index,
    int? offset,
    int? length,
    ChunkStatus? status,
    int? retryCount,
    DateTime? startedAt,
    DateTime? completedAt,
  }) {
    return DownloadChunk(
      index: index ?? this.index,
      offset: offset ?? this.offset,
      length: length ?? this.length,
      status: status ?? this.status,
      retryCount: retryCount ?? this.retryCount,
      startedAt: startedAt ?? this.startedAt,
      completedAt: completedAt ?? this.completedAt,
    );
  }

  /// Creates a chunk marked as downloading
  DownloadChunk markAsDownloading() {
    return copyWith(
      status: ChunkStatus.downloading,
      startedAt: DateTime.now(),
    );
  }

  /// Creates a chunk marked as completed
  DownloadChunk markAsCompleted() {
    return copyWith(
      status: ChunkStatus.completed,
      completedAt: DateTime.now(),
    );
  }

  /// Creates a chunk marked as failed with incremented retry count
  DownloadChunk markAsFailed() {
    return copyWith(
      status: ChunkStatus.failed,
      retryCount: retryCount + 1,
    );
  }

  /// Resets chunk for retry
  DownloadChunk resetForRetry() {
    return copyWith(
      status: ChunkStatus.pending,
      startedAt: null,
      completedAt: null,
    );
  }
}
