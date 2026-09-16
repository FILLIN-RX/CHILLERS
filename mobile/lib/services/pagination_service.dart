import '../models/media_item.dart';
import 'api_service.dart';

enum MediaSection {
  trending,
  popular,
  upcoming,
  topRated,
  series,
  animes,
  african,
  actionMovies,
  comedyMovies,
  horrorMovies,
}

class PaginationService {
  static final PaginationService _instance = PaginationService._internal();
  factory PaginationService() => _instance;
  PaginationService._internal();

  final ApiService _apiService = ApiService();

  // Track pagination state for each section
  final Map<MediaSection, int> _currentPages = {
    for (final section in MediaSection.values) section: 1,
  };

  final Map<MediaSection, int> _totalPages = {
    for (final section in MediaSection.values) section: 1,
  };

  final Map<MediaSection, bool> _isLoading = {
    for (final section in MediaSection.values) section: false,
  };

  final Map<MediaSection, List<MediaItem>> _cache = {
    for (final section in MediaSection.values) section: [],
  };

  // Getters
  int getCurrentPage(MediaSection section) => _currentPages[section] ?? 1;
  int getTotalPages(MediaSection section) => _totalPages[section] ?? 1;
  bool isLoading(MediaSection section) => _isLoading[section] ?? false;
  List<MediaItem> getCache(MediaSection section) => _cache[section] ?? [];

  bool hasMorePages(MediaSection section) {
    final current = _currentPages[section] ?? 1;
    final total = _totalPages[section] ?? 100;
    return current < total;
  }

  /// Load initial data for a section
  Future<List<MediaItem>> loadInitial(MediaSection section) async {
    _isLoading[section] = true;
    _currentPages[section] = 1;
    _totalPages[section] = 100; // Allow subsequent pages

    try {
      final results = await _fetchSection(section, 1);
      _cache[section] = results;
      if (results.isEmpty) {
        _totalPages[section] = 1;
      }
      _isLoading[section] = false;
      return results;
    } catch (e) {
      _isLoading[section] = false;
      rethrow;
    }
  }

  /// Load next page for infinite scroll
  Future<List<MediaItem>> loadMore(MediaSection section) async {
    if (_isLoading[section] == true) return [];
    if (!hasMorePages(section)) return [];

    _isLoading[section] = true;
    final nextPage = (_currentPages[section] ?? 1) + 1;

    try {
      final results = await _fetchSection(section, nextPage);
      
      if (results.isEmpty) {
        _totalPages[section] = _currentPages[section] ?? 1;
        _isLoading[section] = false;
        return [];
      }

      final currentCache = _cache[section] ?? [];
      
      // Merge with existing cache without duplicates
      final merged = <String, MediaItem>{};
      for (final item in currentCache) {
        merged[item.id] = item;
      }
      for (final item in results) {
        merged[item.id] = item;
      }

      _cache[section] = merged.values.toList();
      _currentPages[section] = nextPage;
      _isLoading[section] = false;
      
      return results;
    } catch (e) {
      _isLoading[section] = false;
      rethrow;
    }
  }

  /// Reset pagination for a section
  void reset(MediaSection section) {
    _currentPages[section] = 1;
    _totalPages[section] = 1;
    _isLoading[section] = false;
    _cache[section] = [];
  }

  /// Reset all sections
  void resetAll() {
    for (final section in MediaSection.values) {
      reset(section);
    }
  }

  /// Fetch data from API
  Future<List<MediaItem>> _fetchSection(MediaSection section, int page) async {
    try {
      final results = await _executeQuery(section, page);
      return results;
    } catch (e) {
      rethrow;
    }
  }

  /// Execute specific query based on section
  Future<List<MediaItem>> _executeQuery(MediaSection section, int page) async {
    switch (section) {
      case MediaSection.trending:
        return _apiService.getTrendingMovies(page: page);
      case MediaSection.popular:
        return _apiService.getPopularMovies(page: page);
      case MediaSection.upcoming:
        return _apiService.getUpcomingMovies(page: page);
      case MediaSection.topRated:
        return _apiService.getTopRatedMovies(page: page);
      case MediaSection.series:
        return _apiService.getPopularSeries(page: page);
      case MediaSection.animes:
        return _apiService.getAnimeSeries(page: page);
      case MediaSection.african:
        return _apiService.getAfricanMovies(page: page);
      case MediaSection.actionMovies:
        return _apiService.getMoviesByGenre('28', page: page);
      case MediaSection.comedyMovies:
        return _apiService.getMoviesByGenre('35', page: page);
      case MediaSection.horrorMovies:
        return _apiService.getMoviesByGenre('27', page: page);
    }
  }

  /// Get section title
  static String getSectionTitle(MediaSection section) {
    const titles = {
      MediaSection.trending: 'Tendance actuellement',
      MediaSection.popular: 'Films Populaires',
      MediaSection.upcoming: 'Nouveautés & Sorties',
      MediaSection.topRated: 'Les Meilleurs Films',
      MediaSection.series: 'Séries TV Populaires',
      MediaSection.animes: 'Animes & Mangas',
      MediaSection.african: 'Cinéma & Séries Africains',
      MediaSection.actionMovies: 'Films d\'Action & Aventure',
      MediaSection.comedyMovies: 'Films de Comédie',
      MediaSection.horrorMovies: 'Films d\'Horreur & Thriller',
    };
    return titles[section] ?? 'Section';
  }
}
