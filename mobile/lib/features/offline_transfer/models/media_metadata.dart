/// Metadata for a media file being transferred
/// 
/// Contains all information about the media, including title, poster,
/// file information, and content details.
class MediaMetadata {
  /// Media title
  final String title;
  
  /// Base64 encoded poster image or URL
  final String? poster;
  
  /// Media description/synopsis
  final String? synopsis;
  
  /// Duration in seconds
  final int? duration;
  
  /// Rating (e.g., "8.5")
  final String? rating;
  
  /// Comma-separated genres
  final String? genre;
  
  /// Release year
  final int? year;
  
  /// Media type: "movie", "serie", "anime"
  final String mediaType;
  
  /// File size in bytes
  final int fileSize;
  
  /// SHA-256 hash of the file for integrity verification
  final String sha256;
  
  /// Available subtitles languages (comma-separated)
  final String? subtitlesLanguage;
  
  /// Season number (for series)
  final int? season;
  
  /// Episode number (for series)
  final int? episode;

  MediaMetadata({
    required this.title,
    required this.mediaType,
    required this.fileSize,
    required this.sha256,
    this.poster,
    this.synopsis,
    this.duration,
    this.rating,
    this.genre,
    this.year,
    this.subtitlesLanguage,
    this.season,
    this.episode,
  });

  /// Validates required fields
  bool isValid() {
    return title.isNotEmpty &&
        mediaType.isNotEmpty &&
        fileSize > 0 &&
        sha256.isNotEmpty &&
        sha256.length == 64; // SHA-256 is 64 hex characters
  }

  /// Formats file size for display (e.g., "1.5 GB")
  String get formattedFileSize {
    if (fileSize < 1024) return '$fileSize B';
    if (fileSize < 1024 * 1024) {
      return '${(fileSize / 1024).toStringAsFixed(1)} KB';
    }
    if (fileSize < 1024 * 1024 * 1024) {
      return '${(fileSize / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(fileSize / (1024 * 1024 * 1024)).toStringAsFixed(2)} GB';
  }

  /// Formats duration for display (e.g., "2h 15m")
  String get formattedDuration {
    if (duration == null) return 'Unknown';
    final hours = duration! ~/ 3600;
    final minutes = (duration! % 3600) ~/ 60;
    if (hours > 0) {
      return '${hours}h ${minutes}m';
    }
    return '${minutes}m';
  }

  /// Gets display title with season/episode for series
  String get displayTitle {
    if (season != null && episode != null) {
      return '$title - S${season!.toString().padLeft(2, '0')}E${episode!.toString().padLeft(2, '0')}';
    }
    return title;
  }

  /// Serializes to JSON
  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'poster': poster,
      'synopsis': synopsis,
      'duration': duration,
      'rating': rating,
      'genre': genre,
      'year': year,
      'mediaType': mediaType,
      'fileSize': fileSize,
      'sha256': sha256,
      'subtitlesLanguage': subtitlesLanguage,
      'season': season,
      'episode': episode,
    };
  }

  /// Deserializes from JSON
  factory MediaMetadata.fromJson(Map<String, dynamic> json) {
    return MediaMetadata(
      title: json['title'] as String,
      mediaType: json['mediaType'] as String,
      fileSize: json['fileSize'] as int,
      sha256: json['sha256'] as String,
      poster: json['poster'] as String?,
      synopsis: json['synopsis'] as String?,
      duration: json['duration'] as int?,
      rating: json['rating'] as String?,
      genre: json['genre'] as String?,
      year: json['year'] as int?,
      subtitlesLanguage: json['subtitlesLanguage'] as String?,
      season: json['season'] as int?,
      episode: json['episode'] as int?,
    );
  }

  @override
  String toString() {
    return 'MediaMetadata(title: $title, type: $mediaType, size: $formattedFileSize)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is MediaMetadata &&
        other.title == title &&
        other.mediaType == mediaType &&
        other.fileSize == fileSize &&
        other.sha256 == sha256 &&
        other.season == season &&
        other.episode == episode;
  }

  @override
  int get hashCode {
    return Object.hash(title, mediaType, fileSize, sha256, season, episode);
  }

  /// Creates a copy with optional field updates
  MediaMetadata copyWith({
    String? title,
    String? poster,
    String? synopsis,
    int? duration,
    String? rating,
    String? genre,
    int? year,
    String? mediaType,
    int? fileSize,
    String? sha256,
    String? subtitlesLanguage,
    int? season,
    int? episode,
  }) {
    return MediaMetadata(
      title: title ?? this.title,
      poster: poster ?? this.poster,
      synopsis: synopsis ?? this.synopsis,
      duration: duration ?? this.duration,
      rating: rating ?? this.rating,
      genre: genre ?? this.genre,
      year: year ?? this.year,
      mediaType: mediaType ?? this.mediaType,
      fileSize: fileSize ?? this.fileSize,
      sha256: sha256 ?? this.sha256,
      subtitlesLanguage: subtitlesLanguage ?? this.subtitlesLanguage,
      season: season ?? this.season,
      episode: episode ?? this.episode,
    );
  }
}
