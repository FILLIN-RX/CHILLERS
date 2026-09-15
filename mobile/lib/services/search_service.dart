import 'dart:async';
import '../models/media_item.dart';
import 'api_service.dart';

class SearchService {
  static final SearchService _instance = SearchService._internal();
  factory SearchService() => _instance;
  SearchService._internal();

  final ApiService _apiService = ApiService();
  
  // Debounce timer for search
  Timer? _searchDebounceTimer;
  final Duration _debounceDuration = const Duration(milliseconds: 500);
  
  // Cache for search results
  final Map<String, List<MediaItem>> _searchCache = {};
  static const int _maxCacheSize = 50;

  // Cancel search request
  void cancelSearch() {
    _searchDebounceTimer?.cancel();
  }

  // Clear cache
  void clearCache() {
    _searchCache.clear();
  }

  /// Optimized search with debounce and caching
  /// Returns Future that completes with search results
  Future<List<MediaItem>> search(
    String query, {
    required Function(List<MediaItem>) onResults,
    required Function(String) onError,
  }) {
    final completer = Completer<List<MediaItem>>();
    
    // Cancel previous search
    _searchDebounceTimer?.cancel();

    // Return early if query is empty
    if (query.trim().isEmpty) {
      onResults([]);
      completer.complete([]);
      return completer.future;
    }

    // Check cache first
    if (_searchCache.containsKey(query)) {
      final cached = _searchCache[query]!;
      onResults(cached);
      completer.complete(cached);
      return completer.future;
    }

    // Debounce the actual search
    _searchDebounceTimer = Timer(_debounceDuration, () async {
      try {
        final results = await _performSearch(query);
        
        // Cache results
        _cacheResult(query, results);
        
        onResults(results);
        completer.complete(results);
      } catch (e) {
        final errorMsg = 'Erreur de recherche: ${e.toString()}';
        onError(errorMsg);
        completer.completeError(e);
      }
    });

    return completer.future;
  }

  /// Perform actual search
  Future<List<MediaItem>> _performSearch(String query) async {
    try {
      // Perform the API call
      final response = await _apiService.searchMedia(query).timeout(
        const Duration(seconds: 15),
        onTimeout: () => throw TimeoutException('Recherche dépassée'),
      );

      // Deduplicate by ID and title to avoid showing same content multiple times
      final seen = <String>{};
      final seenTitles = <String>{};
      final dedupedResults = <MediaItem>[];

      for (final item in response) {
        // Check both ID and normalized title to catch duplicates
        final normalizedTitle = item.title.toLowerCase().trim();
        
        if (!seen.contains(item.id) && !seenTitles.contains(normalizedTitle)) {
          seen.add(item.id);
          seenTitles.add(normalizedTitle);
          dedupedResults.add(item);
        }
      }

      // Sort by relevance: exact match first, then by popularity (rating)
      final queryLower = query.toLowerCase().trim();
      dedupedResults.sort((a, b) {
        // Exact title match goes first
        final aExact = a.title.toLowerCase().trim() == queryLower ? 1 : 0;
        final bExact = b.title.toLowerCase().trim() == queryLower ? 1 : 0;
        
        if (aExact != bExact) return bExact - aExact;
        
        // Then by type priority
        const priority = {'movie': 0, 'serie': 1, 'anime': 2};
        final typeDiff = (priority[a.type] ?? 999).compareTo(priority[b.type] ?? 999);
        
        if (typeDiff != 0) return typeDiff;
        
        // Finally by rating
        final aRating = double.tryParse(a.rating ?? '0') ?? 0;
        final bRating = double.tryParse(b.rating ?? '0') ?? 0;
        return bRating.compareTo(aRating);
      });

      return dedupedResults;
    } catch (e) {
      rethrow;
    }
  }

  /// Cache search results with LRU eviction
  void _cacheResult(String query, List<MediaItem> results) {
    // Simple LRU: if cache is full, remove oldest entries
    if (_searchCache.length >= _maxCacheSize) {
      // Remove first (oldest) entry
      final oldestKey = _searchCache.keys.first;
      _searchCache.remove(oldestKey);
    }

    _searchCache[query] = results;
  }

  /// Quick search (returns immediately with debounced results)
  /// Useful for search-as-you-type UI
  Future<List<MediaItem>> quickSearch(String query) async {
    if (query.trim().isEmpty) return [];

    // Check cache
    if (_searchCache.containsKey(query)) {
      return _searchCache[query]!;
    }

    try {
      return await _performSearch(query);
    } catch (_) {
      return [];
    }
  }

  /// Filter search results by type
  List<MediaItem> filterByType(List<MediaItem> results, String type) {
    return results.where((item) => item.type == type).toList();
  }

  /// Filter search results by rating
  List<MediaItem> filterByRating(List<MediaItem> results, {double minRating = 0.0}) {
    return results.where((item) {
      final rating = item.rating;
      if (rating == null || rating.isEmpty) return false;
      final parsed = double.tryParse(rating);
      if (parsed == null) return false;
      return parsed >= minRating;
    }).toList();
  }

  /// Group search results by type
  Map<String, List<MediaItem>> groupByType(List<MediaItem> results) {
    final grouped = <String, List<MediaItem>>{};

    for (final item in results) {
      final type = item.type;
      if (!grouped.containsKey(type)) {
        grouped[type] = [];
      }
      grouped[type]!.add(item);
    }

    return grouped;
  }
}
