import '../config/constants.dart';

class MediaItem {
  final String id;
  final String title;
  final String? poster;
  final String? backdrop;
  final String? description;
  final String? tagline;
  final String? year;
  final String? quality;
  final String? rating;
  final String type; // 'movie', 'serie', 'anime'
  final String? streamUrl;
  final int? runtime;
  final int? numberOfSeasons;
  final int? numberOfEpisodes;
  final List<EpisodeItem>? episodes;
  final List<SeasonItem>? seasons;
  final List<CastItem>? cast;
  final List<String>? genres;
  final String? trailerUrl;
  final List<MediaItem>? recommendations;

  MediaItem({
    required this.id,
    required this.title,
    this.poster,
    this.backdrop,
    this.description,
    this.tagline,
    this.year,
    this.quality,
    this.rating,
    required this.type,
    this.streamUrl,
    this.runtime,
    this.numberOfSeasons,
    this.numberOfEpisodes,
    this.episodes,
    this.seasons,
    this.cast,
    this.genres,
    this.trailerUrl,
    this.recommendations,
  });

  static String? _parseImageUrl(dynamic rawUrl, {bool isBackdrop = false}) {
    if (rawUrl == null) return null;
    String str = rawUrl.toString().trim();
    if (str.isEmpty) return null;

    if (str.startsWith('http://') || str.startsWith('https://')) {
      return str;
    }
    if (str.startsWith('/uploads/') || str.startsWith('/affiches/') || str.startsWith('/api/')) {
      return '${AppConstants.baseUrl}$str';
    }
    if (str.startsWith('/')) {
      final size = isBackdrop ? 'original' : 'w500';
      return 'https://image.tmdb.org/t/p/$size$str';
    }
    return str;
  }

  static String? _parseYear(dynamic rawDate) {
    if (rawDate == null) return null;
    String str = rawDate.toString().trim();
    if (str.isEmpty) return null;
    if (str.length >= 4) {
      return str.substring(0, 4);
    }
    return str;
  }

  static String? _parseRating(dynamic rawRating) {
    if (rawRating == null) return null;
    if (rawRating is num) {
      return rawRating.toStringAsFixed(1);
    }
    return rawRating.toString();
  }

  factory MediaItem.fromJson(Map<String, dynamic> json) {
    List<EpisodeItem>? eps;
    if (json['episodes'] is List) {
      eps = (json['episodes'] as List)
          .whereType<Map<String, dynamic>>()
          .map((e) => EpisodeItem.fromJson(e))
          .toList();
    }

    List<SeasonItem>? parsedSeasons;
    if (json['seasons'] is List) {
      parsedSeasons = (json['seasons'] as List)
          .whereType<Map<String, dynamic>>()
          .where((s) => (s['season_number'] ?? s['seasonNumber'] ?? 0) >= 0)
          .map((s) => SeasonItem.fromJson(s))
          .toList();
    }

    List<CastItem>? parsedCast;
    final rawCast = json['credits']?['cast'] ?? json['cast'];
    if (rawCast is List) {
      parsedCast = rawCast
          .whereType<Map<String, dynamic>>()
          .take(15)
          .map((c) => CastItem.fromJson(c))
          .toList();
    }

    List<MediaItem>? recs;
    final rawRecs = json['recommendations']?['results'] ?? json['recommendations'] ?? json['similar']?['results'];
    if (rawRecs is List) {
      recs = rawRecs
          .whereType<Map<String, dynamic>>()
          .take(10)
          .map((e) => MediaItem.fromJson(e))
          .toList();
    }

    List<String>? parsedGenres;
    if (json['genres'] is List) {
      parsedGenres = (json['genres'] as List)
          .map((g) => g is Map ? (g['name']?.toString() ?? '') : g.toString())
          .where((g) => g.isNotEmpty)
          .toList();
    }

    final rawPoster = json['poster'] ?? json['posterUrl'] ?? json['poster_path'];
    final rawBackdrop = json['backdrop'] ?? json['backdrop_path'] ?? json['backdropUrl'];
    final rawDate = json['year'] ?? json['release_date'] ?? json['first_air_date'];

    final rawRuntime = json['runtime'] ??
        (json['episode_run_time'] is List && (json['episode_run_time'] as List).isNotEmpty
            ? (json['episode_run_time'] as List).first
            : null);

    return MediaItem(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      title: json['title'] ?? json['titre'] ?? json['name'] ?? 'Sans titre',
      poster: _parseImageUrl(rawPoster, isBackdrop: false),
      backdrop: _parseImageUrl(rawBackdrop, isBackdrop: true),
      description: json['description'] ?? json['overview'],
      tagline: json['tagline'],
      year: _parseYear(rawDate),
      quality: json['quality'] ?? json['qualite'] ?? 'HD',
      rating: _parseRating(json['rating'] ?? json['vote_average']),
      type: json['type'] ??
          (json['media_type'] == 'tv' ||
                  json['media_type'] == 'serie' ||
                  json['first_air_date'] != null ||
                  (json['name'] != null && json['title'] == null)
              ? 'serie'
              : 'movie'),
      streamUrl: json['lien'] ?? json['streamUrl'] ?? json['uqloadLink'],
      runtime: rawRuntime is int ? rawRuntime : (int.tryParse(rawRuntime?.toString() ?? '')),
      numberOfSeasons: json['number_of_seasons'] is int ? json['number_of_seasons'] : null,
      numberOfEpisodes: json['number_of_episodes'] is int ? json['number_of_episodes'] : null,
      episodes: eps,
      seasons: parsedSeasons,
      cast: parsedCast,
      genres: parsedGenres,
      trailerUrl: json['trailerUrl'] ?? json['trailer'],
      recommendations: recs,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'poster': poster,
      'backdrop': backdrop,
      'description': description,
      'tagline': tagline,
      'year': year,
      'quality': quality,
      'rating': rating,
      'type': type,
      'streamUrl': streamUrl,
      'runtime': runtime,
      'number_of_seasons': numberOfSeasons,
      'number_of_episodes': numberOfEpisodes,
      'genres': genres,
      'trailerUrl': trailerUrl,
    };
  }
}

class SeasonItem {
  final int seasonNumber;
  final String name;
  final int episodeCount;
  final String? posterPath;
  final String? overview;

  SeasonItem({
    required this.seasonNumber,
    required this.name,
    required this.episodeCount,
    this.posterPath,
    this.overview,
  });

  factory SeasonItem.fromJson(Map<String, dynamic> json) {
    return SeasonItem(
      seasonNumber: json['season_number'] is int
          ? json['season_number']
          : (json['seasonNumber'] is int ? json['seasonNumber'] : 1),
      name: json['name'] ?? 'Saison ${json['season_number'] ?? json['seasonNumber'] ?? 1}',
      episodeCount: json['episode_count'] is int
          ? json['episode_count']
          : (json['episodeCount'] is int ? json['episodeCount'] : 0),
      posterPath: json['poster_path'] != null ? 'https://image.tmdb.org/t/p/w500${json['poster_path']}' : null,
      overview: json['overview'],
    );
  }
}

class CastItem {
  final int id;
  final String name;
  final String character;
  final String? profileUrl;

  CastItem({
    required this.id,
    required this.name,
    required this.character,
    this.profileUrl,
  });

  factory CastItem.fromJson(Map<String, dynamic> json) {
    final profile = json['profile_path'];
    return CastItem(
      id: json['id'] is int ? json['id'] : (int.tryParse(json['id']?.toString() ?? '0') ?? 0),
      name: json['name'] ?? '',
      character: json['character'] ?? '',
      profileUrl: profile != null && profile.toString().isNotEmpty
          ? 'https://image.tmdb.org/t/p/w200$profile'
          : null,
    );
  }
}

class EpisodeItem {
  final String episode;
  final int season;
  final int episodeNumber;
  final String streamUrl;
  final String? title;
  final String? stillPath;
  final String? overview;
  final int? runtime;
  final String? rating;

  EpisodeItem({
    required this.episode,
    required this.season,
    required this.episodeNumber,
    required this.streamUrl,
    this.title,
    this.stillPath,
    this.overview,
    this.runtime,
    this.rating,
  });

  factory EpisodeItem.fromJson(Map<String, dynamic> json) {
    String? still = json['still_path'] ?? json['stillPath'];
    if (still != null && still.startsWith('/')) {
      still = 'https://image.tmdb.org/t/p/w500$still';
    }

    final rawVote = json['vote_average'];
    String? parsedRating;
    if (rawVote is num && rawVote > 0) {
      parsedRating = rawVote.toStringAsFixed(1);
    }

    return EpisodeItem(
      episode: json['name'] != null && json['name'].toString().isNotEmpty
          ? json['name']
          : (json['episode'] ?? 'Épisode ${json['episode_number'] ?? json['episodeNumber'] ?? 1}'),
      season: json['season'] is int
          ? json['season']
          : (json['season_number'] is int ? json['season_number'] : 1),
      episodeNumber: json['episodeNumber'] is int
          ? json['episodeNumber']
          : (json['episode_number'] is int ? json['episode_number'] : 1),
      streamUrl: json['lien'] ?? json['streamUrl'] ?? '',
      title: json['title'] ?? json['name'],
      stillPath: still,
      overview: json['overview'],
      runtime: json['runtime'] is int ? json['runtime'] : null,
      rating: parsedRating,
    );
  }
}
