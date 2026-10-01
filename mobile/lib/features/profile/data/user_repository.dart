import '../../../core/network/api_client.dart';
import '../../../core/network/api_result.dart';
import '../../../core/storage/local_storage.dart';

/// Repository utilisateur — SSOT pour favoris, historique, watch later, progress.
/// Remplace les appels directs ApiService dans 8 écrans différents.
class UserRepository {
  static final UserRepository _instance = UserRepository._internal();
  factory UserRepository() => _instance;
  UserRepository._internal();

  final ApiClient _api = ApiClient();
  final LocalStorage _storage = LocalStorage();

  // ── Favoris ───────────────────────────────────────────────────────────────

  Future<ApiResult<bool>> toggleFavorite(String mediaId, {String type = 'movie'}) async {
    final result = await _api.post<dynamic>(
      '/user/favorites',
      data: {'mediaId': mediaId, 'type': type},
    );
    if (result is ApiSuccess) return const ApiSuccess(true);
    // Mise à jour optimiste : on met à jour le cache local même si le réseau échoue
    await _toggleLocalFavorite(mediaId, type);
    return ApiFailure((result as ApiFailure).error);
  }

  Future<List<String>> getFavoriteIds() async {
    final cached = await _storage.getJsonList('chillers_favorites');
    return cached.map((e) => e['id']?.toString() ?? '').where((id) => id.isNotEmpty).toList();
  }

  // ── Watch Later ───────────────────────────────────────────────────────────

  Future<ApiResult<bool>> toggleWatchLater(String mediaId) async {
    final result = await _api.post<dynamic>(
      '/user/watch-later',
      data: {'mediaId': mediaId},
    );
    return result is ApiSuccess ? const ApiSuccess(true) : ApiFailure((result as ApiFailure).error);
  }

  // ── Progression ───────────────────────────────────────────────────────────

  /// Met à jour la progression de lecture.
  /// Utilise optimistic update : sauvegarde locale immédiate, sync réseau en arrière-plan.
  Future<void> updateProgress(
    String mediaId,
    int progressSeconds,
    int totalSeconds,
  ) async {
    // 1. Optimistic update local
    await _saveLocalProgress(mediaId, progressSeconds, totalSeconds);

    // 2. Sync réseau en arrière-plan (sans await)
    _api.put<dynamic>(
      '/user/progress',
      data: {
        'mediaId': mediaId,
        'progress': progressSeconds,
        'duration': totalSeconds,
      },
    ).ignore();
  }

  Future<int> getProgress(String mediaId) async {
    final cached = await _storage.getJson('progress_$mediaId');
    return cached?['progress'] as int? ?? 0;
  }

  // ── Historique ────────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> getWatchHistory() =>
      _storage.getJsonList('chillers_watch_history');

  Future<void> addToHistory(Map<String, dynamic> item) async {
    final history = await getWatchHistory();
    history.removeWhere((e) => e['id'] == item['id']);
    history.insert(0, item);
    final trimmed = history.take(100).toList();
    await _storage.saveJsonList('chillers_watch_history', trimmed);
  }

  Future<void> clearHistory() =>
      _storage.remove('chillers_watch_history');

  // ── Continue watching ─────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> getContinueWatching() =>
      _storage.getJsonList('chillers_continue_watching');

  Future<void> saveContinueWatching(List<Map<String, dynamic>> items) =>
      _storage.saveJsonList('chillers_continue_watching', items);

  // ── Playlists ─────────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> getPlaylists() =>
      _storage.getJsonList('chillers_playlists');

  Future<void> createPlaylist(String name) async {
    final playlists = await getPlaylists();
    playlists.add({'id': DateTime.now().millisecondsSinceEpoch.toString(), 'name': name, 'items': []});
    await _storage.saveJsonList('chillers_playlists', playlists);
  }

  // ── Helpers privés ────────────────────────────────────────────────────────

  Future<void> _toggleLocalFavorite(String mediaId, String type) async {
    final favorites = await _storage.getJsonList('chillers_favorites');
    final idx = favorites.indexWhere((e) => e['id'] == mediaId);
    if (idx >= 0) {
      favorites.removeAt(idx);
    } else {
      favorites.add({'id': mediaId, 'type': type});
    }
    await _storage.saveJsonList('chillers_favorites', favorites);
  }

  Future<void> _saveLocalProgress(String mediaId, int progress, int total) async {
    await _storage.saveJson('progress_$mediaId', {
      'mediaId': mediaId,
      'progress': progress,
      'duration': total,
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }
}
