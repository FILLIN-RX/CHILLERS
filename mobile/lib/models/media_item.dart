class MediaItem {
  final String id;
  final String title;
  final String? poster;
  final String? backdrop;
  final String? description;
  final String? year;
  final String? quality;
  final String? rating;
  final String type; // 'movie', 'serie', 'anime'
  final String? streamUrl;
  final List<EpisodeItem>? episodes;

  MediaItem({
    required this.id,
    required this.title,
    this.poster,
    this.backdrop,
    this.description,
    this.year,
    this.quality,
    this.rating,
    required this.type,
    this.streamUrl,
    this.episodes,
  });

  factory MediaItem.fromJson(Map<String, dynamic> json) {
    List<EpisodeItem>? eps;
    if (json['episodes'] is List) {
      eps = (json['episodes'] as List)
          .map((e) => EpisodeItem.fromJson(e as Map<String, dynamic>))
          .toList();
    }

    return MediaItem(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      title: json['title'] ?? json['titre'] ?? 'Sans titre',
      poster: json['poster'] ?? json['posterUrl'] ?? json['poster_path'],
      backdrop: json['backdrop'] ?? json['backdrop_path'],
      description: json['description'] ?? json['overview'],
      year: json['year']?.toString(),
      quality: json['quality'] ?? json['qualite'] ?? 'HD',
      rating: json['rating']?.toString() ?? json['vote_average']?.toString(),
      type: json['type'] ?? 'movie',
      streamUrl: json['lien'] ?? json['streamUrl'] ?? json['uqloadLink'],
      episodes: eps,
    );
  }
}

class EpisodeItem {
  final String episode;
  final int season;
  final int episodeNumber;
  final String streamUrl;

  EpisodeItem({
    required this.episode,
    required this.season,
    required this.episodeNumber,
    required this.streamUrl,
  });

  factory EpisodeItem.fromJson(Map<String, dynamic> json) {
    return EpisodeItem(
      episode: json['episode'] ?? 'Épisode',
      season: json['season'] is int ? json['season'] : 1,
      episodeNumber: json['episodeNumber'] is int ? json['episodeNumber'] : 1,
      streamUrl: json['lien'] ?? json['streamUrl'] ?? '',
    );
  }
}
