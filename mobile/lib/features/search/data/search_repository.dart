import '../../../core/models/media_item.dart';
import '../../media/data/media_repository.dart';

/// Repository de recherche — délègue à MediaRepository.
class SearchRepository {
  static final SearchRepository _instance = SearchRepository._internal();
  factory SearchRepository() => _instance;
  SearchRepository._internal();

  final MediaRepository _media = MediaRepository();

  // Cache en mémoire pour la session
  final Map<String, List<MediaItem>> _cache = {};

  Future<List<MediaItem>> search(String query) async {
    final key = query.trim().toLowerCase();
    if (key.isEmpty) return [];
    if (_cache.containsKey(key)) return _cache[key]!;

    final results = await _media.search(query);
    if (results.isNotEmpty) _cache[key] = results;
    return results;
  }

  void clearCache() => _cache.clear();
}
