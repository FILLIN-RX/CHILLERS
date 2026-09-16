library;

/// Formatting utilities for offline transfer metrics
class TransferFormatters {
  /// Formats byte count to human readable string (KB, MB, GB)
  static String formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(1)} KB';
    }
    if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(2)} GB';
  }

  /// Formats speed in bytes/sec to readable string
  static String formatSpeed(double bytesPerSecond) {
    return '${formatBytes(bytesPerSecond.round())}/s';
  }

  /// Formats remaining duration
  static String formatDuration(Duration? duration) {
    if (duration == null) return 'Calcul en cours...';
    final seconds = duration.inSeconds;
    if (seconds < 60) return '${seconds}s';
    final minutes = seconds ~/ 60;
    final remainingSecs = seconds % 60;
    if (minutes < 60) {
      return '${minutes}m ${remainingSecs}s';
    }
    final hours = minutes ~/ 60;
    final remainingMins = minutes % 60;
    return '${hours}h ${remainingMins}m';
  }
}
