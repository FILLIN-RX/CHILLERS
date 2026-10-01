import '../../../core/network/api_result.dart';
import '../../../core/storage/local_storage.dart';
import '../../../core/models/media_item.dart';
import '../domain/genre_model.dart';
import 'media_api_client.dart';

/// Repository catalogue — Single Source of Truth pour films, séries, anime.
/// Combine MediaApiClient + cache local (offline-first sur les listes).
class MediaRepository {
  static final MediaRepository _instance = MediaRepository._internal();
  factory MediaRepository() => _instance;
  MediaRepository._internal();

  final MediaApiClient _api = MediaApiClient();
  final LocalStorage _storage = LocalStorage();

  // Clés de cache
  static const String _popularMoviesKey = 'cache_popular_movies';
  static const String _popularSeriesKey = 'cache_popular_series';
  static const String _genresKey = 'cache_genres';

  // ── Films ─────────────────────────────────────────────────────────────────

  Future<List<MediaItem>> getPopularMovies({int page = 1}) =>
      _fetchList(() => _api.getPopularMovies(page: page), page == 1 ? _popularMoviesKey : null);

  Future<List<MediaItem>> getTrendingMovies({int page = 1}) =>
      _fetchList(() => _api.getTrendingMovies(page: page));

  Future<List<MediaItem>> getUpcomingMovies({int page = 1}) =>
      _fetchList(() => _api.getUpcomingMovies(page: page));

  Future<List<MediaItem>> getTopRatedMovies({int page = 1}) =>
      _fetchList(() => _api.getTopRatedMovies(page: page));

  Future<List<MediaItem>> getAfricanMovies({int page = 1}) =>
      _fetchList(() => _api.getAfricanMovies(page: page));

  Future<List<MediaItem>> getMoviesByGenre(String genreId, {int page = 1}) =>
      _fetchList(() => _api.getMoviesByGenre(genreId, page: page));

  Future<List<MediaItem>> getBoxOfficeMovies({int page = 1}) =>
      _fetchList(() => _api.fetchDirectTmdb('/discover/movie', {
        'page': page.toString(), 'sort_by': 'revenue.desc',
        'primary_release_date.gte': '2022-01-01', 'vote_count.gte': '50',
        'include_adult': 'false', 'language': 'fr-FR',
      }));

  Future<List<MediaItem>> getActionMovies({int page = 1}) =>
      getMoviesByGenre('28', page: page);

  Future<List<MediaItem>> getComedyMovies({int page = 1}) =>
      getMoviesByGenre('35', page: page);

  Future<List<MediaItem>> getMartialArtsMovies({int page = 1}) =>
      _fetchList(() => _api.fetchDirectTmdb('/discover/movie', {
        'with_genres': '28', 'with_keywords': '9715|780',
        'without_genres': '878,14,16', 'sort_by': 'popularity.desc',
        'page': page.toString(), 'language': 'fr-FR',
      }));

  Future<List<MediaItem>> getBarbieMovies({int page = 1}) =>
      _fetchList(() => _api.fetchDirectTmdb('/search/movie', {
        'page': page.toString(), 'query': 'barbie', 'language': 'fr-FR',
      }));

  Future<MediaItem?> getMovieDetails(String id) async {
    final result = await _api.getMovieDetails(id);
    return result is ApiSuccess<MediaItem> ? result.data : null;
  }

  // ── Séries ────────────────────────────────────────────────────────────────

  Future<List<MediaItem>> getPopularSeries({int page = 1}) =>
      _fetchList(() => _api.getPopularSeries(page: page), page == 1 ? _popularSeriesKey : null);

  Future<List<MediaItem>> getTrendingSeries({int page = 1}) =>
      _fetchList(() => _api.getTrendingSeries(page: page));

  Future<List<MediaItem>> getTopRatedSeries({int page = 1}) =>
      _fetchList(() => _api.getTopRatedSeries(page: page));

  Future<List<MediaItem>> getAfricanSeries({int page = 1}) =>
      _fetchList(() => _api.getAfricanSeries(page: page));

  Future<List<MediaItem>> getAnimeSeries({int page = 1}) =>
      _fetchList(() => _api.getAnimeSeries(page: page));

  Future<List<MediaItem>> getSeriesByGenre(String genreId, {int page = 1}) =>
      _fetchList(() => _api.getSeriesByGenre(genreId, page: page));

  Future<List<MediaItem>> getActionSeries({int page = 1}) =>
      getSeriesByGenre('10759', page: page);

  Future<List<MediaItem>> getAnimationSeries({int page = 1}) =>
      getSeriesByGenre('16', page: page);

  Future<List<MediaItem>> getRealityShows({int page = 1}) =>
      _fetchList(() => _api.fetchDirectTmdb('/discover/tv', {
        'with_genres': '10764', 'sort_by': 'popularity.desc',
        'page': page.toString(), 'language': 'fr-FR',
      }, defaultType: 'serie'));

  Future<List<MediaItem>> getMadeInChina({int page = 1}) =>
      _fetchList(() => _api.fetchDirectTmdb('/discover/tv', {
        'with_original_language': 'zh', 'sort_by': 'popularity.desc',
        'vote_count.gte': '5', 'page': page.toString(), 'language': 'fr-FR',
      }, defaultType: 'serie'));

  Future<List<MediaItem>> getSADrama({int page = 1}) =>
      _fetchList(() => _api.fetchDirectTmdb('/discover/tv', {
        'with_origin_country': 'ZA', 'sort_by': 'popularity.desc',
        'page': page.toString(), 'language': 'fr-FR',
      }, defaultType: 'serie'));

  Future<List<MediaItem>> getNewAnime({int page = 1}) =>
      _fetchList(() => _api.fetchDirectTmdb('/discover/tv', {
        'with_genres': '16', 'with_original_language': 'ja',
        'sort_by': 'popularity.desc', 'first_air_date.gte': '2023-01-01',
        'page': page.toString(), 'language': 'fr-FR',
      }, defaultType: 'anime'));

  Future<List<MediaItem>> getAllTimeFavorites({int page = 1}) async {
    final results = await Future.wait([
      _fetchList(() => _api.fetchDirectTmdb('/discover/tv',
          {'page': page.toString(), 'sort_by': 'vote_count.desc', 'language': 'fr-FR'},
          defaultType: 'serie')),
      _fetchList(() => _api.fetchDirectTmdb('/discover/movie',
          {'page': page.toString(), 'sort_by': 'vote_count.desc', 'language': 'fr-FR'})),
    ]);
    final merged = <MediaItem>[];
    final tv = results[0]; final movies = results[1];
    final maxLen = tv.length > movies.length ? tv.length : movies.length;
    for (int i = 0; i < maxLen; i++) {
      if (i < tv.length) merged.add(tv[i]);
      if (i < movies.length) merged.add(movies[i]);
    }
    return merged;
  }

  Future<List<MediaItem>> getTVForYou({int page = 2}) =>
      getPopularSeries(page: page);

  Future<MediaItem?> getSeriesDetails(String id) async {
    final result = await _api.getSeriesDetails(id);
    return result is ApiSuccess<MediaItem> ? result.data : null;
  }

  Future<List<MediaItem>> getSeasonDetails(String id, int season) async {
    final result = await _api.getSeasonDetails(id, season);
    return result is ApiSuccess<List<MediaItem>> ? result.data : [];
  }

  // ── Search ────────────────────────────────────────────────────────────────

  Future<List<MediaItem>> search(String query) async {
    final result = await _api.search(query);
    return result is ApiSuccess<List<MediaItem>> ? result.data : [];
  }

  // ── Genres ────────────────────────────────────────────────────────────────

  Future<List<GenreModel>> getGenres() =>
      _fetchGenres();

  // ── Trailers ──────────────────────────────────────────────────────────────

  Future<String?> getTrailerUrl(String id, {bool isTV = false}) =>
      _api.getTrailerUrl(id, isTV: isTV);

  // ── Helpers ───────────────────────────────────────────────────────────────

  /// Fetch avec cache optionnel. Si la requête échoue, retourne le cache local.
  Future<List<MediaItem>> _fetchList(
    Future<ApiResult<List<MediaItem>>> Function() fetch, [
    String? cacheKey,
  ]) async {
    final result = await fetch();

    if (result is ApiSuccess<List<MediaItem>>) {
      final items = result.data;
      if (cacheKey != null && items.isNotEmpty) {
        _storage.saveJsonList(cacheKey, items.map((e) => e.toJson()).toList()).ignore();
      }
      return items;
    }

    // Fallback cache local
    if (cacheKey != null) {
      final cached = await _storage.getJsonList(cacheKey);
      if (cached.isNotEmpty) {
        return cached.map(MediaItem.fromJson).toList();
      }
    }
    return [];
  }

  Future<List<GenreModel>> _fetchGenres() async {
    final result = await _api.getGenres();
    if (result is ApiSuccess<List<GenreModel>>) return result.data;

    final cached = await _storage.getJsonList(_genresKey);
    return cached.map(GenreModel.fromJson).toList();
  }
}
