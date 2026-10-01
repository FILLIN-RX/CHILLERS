import '../../../core/network/api_client.dart';
import '../../../core/network/api_result.dart';
import '../../../core/models/media_item.dart';
import '../domain/genre_model.dart';

/// Client API pour le catalogue : films, séries, anime, genres, search.
class MediaApiClient {
  static final MediaApiClient _instance = MediaApiClient._internal();
  factory MediaApiClient() => _instance;
  MediaApiClient._internal();

  final ApiClient _client = ApiClient();

  // ── TMDB token (pour les appels directs à TMDB) ────────────────────────────
  static const String _tmdbToken =
      String.fromEnvironment('TMDB_TOKEN', defaultValue:
        'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1ODY4ZjBmM2NmZTg1MTZmYmQ1NmE2YjNiNzJmOGYwZiIsIm5iZiI6MTc4Mzk0MDMzNi42ODMsInN1YiI6IjZhNTRjNGYwY2M4ZTIzNDZhNWI1MmUxYiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.33Zn39ASeHdHwv7jxe5-qaPhi-5uSvGqfAOPCSW8ddM');

  // ── Films ─────────────────────────────────────────────────────────────────

  Future<ApiResult<List<MediaItem>>> getTrendingMovies({int page = 1}) =>
      _getMediaList('/movies/trending', 'movie', page: page);

  Future<ApiResult<List<MediaItem>>> getPopularMovies({int page = 1}) =>
      _getMediaList('/movies/popular', 'movie', page: page);

  Future<ApiResult<List<MediaItem>>> getUpcomingMovies({int page = 1}) =>
      _getMediaList('/movies/upcoming', 'movie', page: page);

  Future<ApiResult<List<MediaItem>>> getTopRatedMovies({int page = 1}) =>
      _getMediaList('/movies/top-rated', 'movie', page: page);

  Future<ApiResult<List<MediaItem>>> getAfricanMovies({int page = 1}) =>
      _getMediaList('/movies/african', 'movie', page: page);

  Future<ApiResult<List<MediaItem>>> getMoviesByGenre(String genreId, {int page = 1}) =>
      _getMediaList('/movies/genre/$genreId', 'movie', page: page);

  Future<ApiResult<MediaItem>> getMovieDetails(String id) =>
      _getMediaDetail('/movies/$id', 'movie');

  // ── Séries ────────────────────────────────────────────────────────────────

  Future<ApiResult<List<MediaItem>>> getTrendingSeries({int page = 1}) =>
      _getMediaList('/tv/trending', 'serie', page: page);

  Future<ApiResult<List<MediaItem>>> getPopularSeries({int page = 1}) =>
      _getMediaList('/tv/popular', 'serie', page: page);

  Future<ApiResult<List<MediaItem>>> getTopRatedSeries({int page = 1}) =>
      _getMediaList('/tv/top_rated', 'serie', page: page);

  Future<ApiResult<List<MediaItem>>> getAfricanSeries({int page = 1}) =>
      _getMediaList('/tv/african', 'serie', page: page);

  Future<ApiResult<List<MediaItem>>> getAnimeSeries({int page = 1}) =>
      _getMediaList('/tv/anime', 'anime', page: page);

  Future<ApiResult<List<MediaItem>>> getSeriesByGenre(String genreId, {int page = 1}) =>
      _getMediaList('/tv/genre/$genreId', 'serie', page: page);

  Future<ApiResult<MediaItem>> getSeriesDetails(String id) =>
      _getMediaDetail('/tv/$id', 'serie');

  Future<ApiResult<List<MediaItem>>> getSeasonDetails(String id, int season) async {
    final result = await _client.get<dynamic>('/tv/$id/season/$season');
    return _parseList(result, 'serie');
  }

  // ── Search ────────────────────────────────────────────────────────────────

  Future<ApiResult<List<MediaItem>>> search(String query) async {
    if (query.trim().isEmpty) return const ApiSuccess([]);

    final result = await _client.get<dynamic>(
      '/search',
      queryParameters: {'q': query.trim()},
    );

    if (result is ApiFailure) return ApiFailure((result as ApiFailure).error);

    try {
      final data = (result as ApiSuccess).data;
      final items = <MediaItem>[];
      final seen = <String>{};

      void addItem(Map<String, dynamic> json, String type) {
        final item = MediaItem.fromJson({...json, 'type': type});
        if (item.id.isNotEmpty && seen.add(item.id)) items.add(item);
      }

      if (data is Map && data['data'] is Map) {
        final d = data['data'] as Map;
        if (d['localResults'] is Map) {
          final lr = d['localResults'] as Map;
          if (lr['movies'] is List) for (final m in lr['movies'] as List) addItem(m as Map<String, dynamic>, 'movie');
          if (lr['series'] is List) for (final s in lr['series'] as List) addItem(s as Map<String, dynamic>, 'serie');
        }
        if (d['tmdbResults'] is Map) {
          final tr = d['tmdbResults'] as Map;
          if (tr['results'] is List) {
            for (final t in tr['results'] as List) {
              if (t is Map<String, dynamic>) {
                addItem(t, t['media_type'] == 'tv' ? 'serie' : 'movie');
              }
            }
          }
        }
      }

      return ApiSuccess(items);
    } catch (e) {
      return ApiFailure(AppError.parse(e.toString()));
    }
  }

  // ── Genres ────────────────────────────────────────────────────────────────

  Future<ApiResult<List<GenreModel>>> getGenres() async {
    final result = await _client.get<dynamic>('/genres');
    if (result is ApiFailure) return ApiFailure((result as ApiFailure).error);
    try {
      final list = _client.extractList((result as ApiSuccess).data);
      return ApiSuccess(list.whereType<Map<String, dynamic>>().map(GenreModel.fromJson).toList());
    } catch (e) {
      return ApiFailure(AppError.parse(e.toString()));
    }
  }

  // ── Trailers ──────────────────────────────────────────────────────────────

  Future<String?> getTrailerUrl(String id, {bool isTV = false}) async {
    // 1. Backend
    final endpoint = isTV ? '/tv/$id/trailer' : '/movies/$id/trailer';
    final r1 = await _client.get<dynamic>(endpoint);
    if (r1 is ApiSuccess) {
      final key = r1.data['data']?['key'] ?? r1.data['key'];
      if (key != null && key.toString().isNotEmpty) return 'https://www.youtube.com/embed/$key';
    }

    // 2. Fallback TMDB direct
    try {
      final tmdbPath = isTV ? '/tv/$id/videos' : '/movie/$id/videos';
      final tmdbResult = await _client.get<dynamic>(
        'https://api.themoviedb.org/3$tmdbPath',
        queryParameters: {'language': 'fr-FR'},
      );
      if (tmdbResult is ApiSuccess) {
        final list = tmdbResult.data['results'] as List?;
        if (list != null && list.isNotEmpty) {
          final trailer = list.firstWhere(
            (v) => v['site'] == 'YouTube' && v['type'] == 'Trailer',
            orElse: () => list.firstWhere(
              (v) => v['site'] == 'YouTube',
              orElse: () => list.first,
            ),
          );
          if (trailer['key'] != null) return 'https://www.youtube.com/embed/${trailer['key']}';
        }
      }
    } catch (_) {}
    return null;
  }

  // ── TMDB direct (sections enrichies) ─────────────────────────────────────

  Future<ApiResult<List<MediaItem>>> fetchDirectTmdb(
    String path,
    Map<String, String> params, {
    String defaultType = 'movie',
  }) async {
    try {
      final uri = Uri.https('api.themoviedb.org', '/3$path', params);
      // Utilise dio directement pour TMDB avec son propre bearer
      final result = await _client.get<dynamic>(uri.toString());
      return _parseList(result, defaultType);
    } catch (e) {
      return ApiFailure(AppError.network(e.toString()));
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  Future<ApiResult<List<MediaItem>>> _getMediaList(
    String path,
    String type, {
    int page = 1,
  }) async {
    final result = await _client.get<dynamic>(path, queryParameters: {'page': page.toString()});
    return _parseList(result, type);
  }

  Future<ApiResult<MediaItem>> _getMediaDetail(String path, String type) async {
    final result = await _client.get<dynamic>(path);
    if (result is ApiFailure) return ApiFailure((result as ApiFailure).error);
    try {
      final data = (result as ApiSuccess).data;
      final itemJson = (data['data'] ?? data) as Map<String, dynamic>;
      return ApiSuccess(MediaItem.fromJson({...itemJson, 'type': type}));
    } catch (e) {
      return ApiFailure(AppError.parse(e.toString()));
    }
  }

  ApiResult<List<MediaItem>> _parseList(ApiResult<dynamic> result, String type) {
    if (result is ApiFailure) return ApiFailure((result as ApiFailure).error);
    try {
      final list = _client.extractList((result as ApiSuccess).data);
      return ApiSuccess(
        list.whereType<Map<String, dynamic>>()
            .map((e) => MediaItem.fromJson({...e, 'type': type}))
            .toList(),
      );
    } catch (e) {
      return ApiFailure(AppError.parse(e.toString()));
    }
  }
}
