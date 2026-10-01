import '../../../core/network/api_client.dart';
import '../../../core/network/api_result.dart';
import '../../../core/config/constants.dart';

/// Client API pour les URLs de streaming et téléchargement.
class StreamApiClient {
  static final StreamApiClient _instance = StreamApiClient._internal();
  factory StreamApiClient() => _instance;
  StreamApiClient._internal();

  final ApiClient _client = ApiClient();

  // ── Film ──────────────────────────────────────────────────────────────────

  Future<ApiResult<String>> getMovieStreamUrl(
    String id,
    String title, {
    String language = 'fr',
  }) async {
    // 1. Source principale backend
    final r1 = await _client.get<dynamic>(
      '/stream/movie/$id',
      queryParameters: {'type': 'movie', 'title': title, 'lang': language},
    );
    final url1 = _extractStreamUrl(r1);
    if (url1 != null) return ApiSuccess(url1);

    // 2. Source secondaire NexStream
    final r2 = await _client.get<dynamic>(
      '/nexstream/movie/$id',
      queryParameters: {'type': 'movie', 'title': title, 'lang': language},
    );
    final url2 = _extractStreamUrl(r2);
    if (url2 != null) return ApiSuccess(url2);

    // 3. Fallback VidLink
    if (int.tryParse(id) != null) {
      return ApiSuccess('https://vidlink.pro/movie/$id');
    }

    return ApiFailure(AppError.notFound());
  }

  // ── Épisode ───────────────────────────────────────────────────────────────

  Future<ApiResult<String>> getEpisodeStreamUrl(
    String id,
    int season,
    int episode,
    String title, {
    String language = 'fr',
  }) async {
    // 1. Source principale backend
    final r1 = await _client.get<dynamic>(
      '/stream/tv/$id/$season/$episode',
      queryParameters: {'type': 'series', 'title': title, 'lang': language},
    );
    final url1 = _extractStreamUrl(r1);
    if (url1 != null) return ApiSuccess(url1);

    // 2. Source secondaire NexStream
    final r2 = await _client.get<dynamic>(
      '/nexstream/tv/$id/$season/$episode',
      queryParameters: {'type': 'series', 'title': title, 'lang': language},
    );
    final url2 = _extractStreamUrl(r2);
    if (url2 != null) return ApiSuccess(url2);

    // 3. Fallback VidLink
    if (int.tryParse(id) != null) {
      return ApiSuccess('https://vidlink.pro/tv/$id/$season/$episode');
    }

    return ApiFailure(AppError.notFound());
  }

  // ── Téléchargement ────────────────────────────────────────────────────────

  Future<ApiResult<String>> resolveDownloadUrl({
    required String tmdbId,
    required String title,
    String type = 'movie',
    int? season,
    int? episode,
    String language = 'fr',
  }) async {
    final params = <String, String>{
      'tmdb_id': tmdbId,
      'title': title,
      'type': type,
      'lang': language,
      if (season != null) 'season': season.toString(),
      if (episode != null) 'episode': episode.toString(),
    };

    final result = await _client.get<dynamic>('/download/resolve', queryParameters: params);

    if (result is ApiSuccess) {
      final data = result.data;
      String? url = data['data']?['downloadUrl']?.toString() ?? data['downloadUrl']?.toString();
      if (url != null && url.isNotEmpty) {
        if (url.startsWith('/')) url = '${AppConstants.baseUrl}$url';
        return ApiSuccess(url);
      }
    }

    // Fallback : résoudre via le stream
    if (type == 'movie') return getMovieStreamUrl(tmdbId, title, language: language);
    return getEpisodeStreamUrl(tmdbId, season ?? 1, episode ?? 1, title, language: language);
  }

  // ── Helper ────────────────────────────────────────────────────────────────

  String? _extractStreamUrl(ApiResult<dynamic> result) {
    if (result is! ApiSuccess) return null;
    try {
      final data = result.data;
      String? url = data['data']?['directUrl']?.toString()
          ?? data['directUrl']?.toString()
          ?? data['data']?['embedUrl']?.toString()
          ?? data['embedUrl']?.toString()
          ?? data['url']?.toString();
      if (url != null && url.isNotEmpty) {
        if (url.startsWith('/')) return '${AppConstants.baseUrl}$url';
        return url;
      }
    } catch (_) {}
    return null;
  }
}
