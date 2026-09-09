import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';
import '../../models/genre.dart';
import '../../services/api_service.dart';
import 'widgets/media_grid_view.dart';

class MediaScreen extends StatefulWidget {
  final String? initialType; // 'movie', 'tv', 'anime', 'african', 'all'
  final String? initialGenre;

  const MediaScreen({
    super.key,
    this.initialType,
    this.initialGenre,
  });

  @override
  State<MediaScreen> createState() => _MediaScreenState();
}

class _MediaScreenState extends State<MediaScreen> {
  final ApiService _apiService = ApiService();
  final ScrollController _scrollController = ScrollController();

  String _selectedType = 'all'; // all, movie, tv, anime, african
  String? _selectedGenreId;
  String _selectedSort = 'popularity'; // popularity, trending, top_rated

  List<MediaItem> _items = [];
  List<GenreModel> _genres = [];
  bool _isLoading = true;
  bool _isLoadingMore = false;
  bool _hasMore = true;
  int _currentPage = 1;

  final List<Map<String, dynamic>> _types = const [
    {'id': 'all', 'label': 'Tout Explorer', 'icon': Icons.explore_rounded},
    {'id': 'movie', 'label': 'Films', 'icon': Icons.movie_creation_rounded},
    {'id': 'tv', 'label': 'Séries', 'icon': Icons.tv_rounded},
    {'id': 'anime', 'label': 'Animes', 'icon': Icons.auto_awesome_rounded},
    {'id': 'african', 'label': 'Nollywood & Afrique', 'icon': Icons.public_rounded},
  ];

  final List<Map<String, String>> _sortOptions = const [
    {'id': 'popularity', 'label': 'Populaires'},
    {'id': 'trending', 'label': 'Tendances'},
    {'id': 'top_rated', 'label': 'Mieux notés'},
  ];

  @override
  void initState() {
    super.initState();
    if (widget.initialType != null) {
      _selectedType = widget.initialType!;
    }
    _scrollController.addListener(_onScroll);
    _loadGenres();
    _loadMedia(refresh: true);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 300) {
      if (!_isLoading && !_isLoadingMore && _hasMore) {
        _loadMoreMedia();
      }
    }
  }

  Future<void> _loadGenres() async {
    final g = await _apiService.getGenres();
    if (mounted) {
      setState(() => _genres = g);
    }
  }

  Future<List<MediaItem>> _fetchPage(int page) async {
    if (_selectedType == 'african') {
      return _apiService.getAfricanMovies(page: page);
    } else if (_selectedGenreId != null) {
      return _apiService.getMediaByGenre(
        _selectedGenreId!,
        type: _selectedType == 'tv' ? 'tv' : 'movie',
        page: page,
      );
    } else if (_selectedType == 'anime') {
      return _apiService.getAnimeSeries(page: page);
    } else if (_selectedType == 'tv') {
      if (_selectedSort == 'trending') {
        return _apiService.getTrendingSeries(page: page);
      } else if (_selectedSort == 'top_rated') {
        return _apiService.getTopRatedSeries(page: page);
      } else {
        return _apiService.getPopularSeries(page: page);
      }
    } else {
      // Movies or All
      if (_selectedSort == 'trending') {
        return _apiService.getTrendingMovies();
      } else if (_selectedSort == 'top_rated') {
        return _apiService.getTopRatedMovies(page: page);
      } else {
        return _apiService.getPopularMovies(page: page);
      }
    }
  }

  Future<void> _loadMedia({bool refresh = false}) async {
    if (refresh) {
      _currentPage = 1;
      _hasMore = true;
    }
    setState(() => _isLoading = true);

    try {
      final results = await _fetchPage(1);

      if (!mounted) return;

      setState(() {
        _items = results;
        _isLoading = false;
        if (results.isEmpty || results.length < 10) {
          _hasMore = false;
        }
      });
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _loadMoreMedia() async {
    if (_isLoadingMore || !_hasMore) return;

    setState(() => _isLoadingMore = true);
    final nextPage = _currentPage + 1;

    try {
      final newItems = await _fetchPage(nextPage);

      if (!mounted) return;

      setState(() {
        _items.addAll(newItems);
        _currentPage = nextPage;
        _isLoadingMore = false;
        if (newItems.isEmpty || newItems.length < 10) {
          _hasMore = false;
        }
      });
    } catch (_) {
      if (mounted) setState(() => _isLoadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: const Color(0xFF0C0C0E),
        elevation: 0,
        title: const Text(
          'Explorer le Catalogue',
          style: TextStyle(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 18),
        ),
        actions: [
          // Dropdown de Tri
          Container(
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.white10),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedSort,
                dropdownColor: AppTheme.card,
                icon: const Icon(Icons.sort_rounded, color: AppTheme.primary, size: 18),
                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                items: _sortOptions
                    .map((s) => DropdownMenuItem(
                          value: s['id'],
                          child: Text(s['label']!),
                        ))
                    .toList(),
                onChanged: (val) {
                  if (val != null && val != _selectedSort) {
                    setState(() => _selectedSort = val);
                    _loadMedia(refresh: true);
                  }
                },
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── TYPE PILLS (TOUT, FILMS, SÉRIES, ANIMES, AFRICAIN) ──
          Container(
            height: 46,
            color: const Color(0xFF0C0C0E),
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: _types.length,
              itemBuilder: (context, index) {
                final type = _types[index];
                final isSelected = _selectedType == type['id'];

                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    avatar: Icon(
                      type['icon'] as IconData,
                      size: 16,
                      color: isSelected ? Colors.white : AppTheme.primary,
                    ),
                    label: Text(type['label'] as String),
                    selected: isSelected,
                    selectedColor: AppTheme.primary,
                    backgroundColor: AppTheme.card,
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : Colors.white70,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      fontSize: 12,
                    ),
                    side: BorderSide(
                      color: isSelected ? AppTheme.primary : Colors.white.withValues(alpha: 0.1),
                    ),
                    onSelected: (val) {
                      if (val) {
                        setState(() {
                          _selectedType = type['id'] as String;
                          _selectedGenreId = null;
                        });
                        _loadMedia(refresh: true);
                      }
                    },
                  ),
                );
              },
            ),
          ),

          // ── GENRE CHIPS (Si disponible) ──
          if (_genres.isNotEmpty && _selectedType != 'african' && _selectedType != 'anime')
            Container(
              height: 40,
              color: const Color(0xFF0C0C0E),
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: _genres.length + 1,
                itemBuilder: (context, index) {
                  if (index == 0) {
                    final isSelected = _selectedGenreId == null;
                    return Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ActionChip(
                        backgroundColor: isSelected ? AppTheme.primary.withValues(alpha: 0.25) : AppTheme.card,
                        side: BorderSide(
                          color: isSelected ? AppTheme.primary : Colors.white.withValues(alpha: 0.05),
                        ),
                        label: Text(
                          'Tous',
                          style: TextStyle(
                            color: isSelected ? AppTheme.primary : Colors.white70,
                            fontSize: 11,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                        onPressed: () {
                          if (_selectedGenreId != null) {
                            setState(() => _selectedGenreId = null);
                            _loadMedia(refresh: true);
                          }
                        },
                      ),
                    );
                  }

                  final genre = _genres[index - 1];
                  final isSelected = _selectedGenreId == genre.id.toString();

                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ActionChip(
                      backgroundColor: isSelected ? AppTheme.primary.withValues(alpha: 0.25) : AppTheme.card,
                      side: BorderSide(
                        color: isSelected ? AppTheme.primary : Colors.white.withValues(alpha: 0.05),
                      ),
                      label: Text(
                        genre.name,
                        style: TextStyle(
                          color: isSelected ? AppTheme.primary : Colors.white70,
                          fontSize: 11,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                      onPressed: () {
                        setState(() {
                          _selectedGenreId = isSelected ? null : genre.id.toString();
                        });
                        _loadMedia(refresh: true);
                      },
                    ),
                  );
                },
              ),
            ),

          // ── GRILLE DE MÉDIAS AVEC INFINITE SCROLL ──
          Expanded(
            child: MediaGridView(
              items: _items,
              isLoading: _isLoading,
              isLoadingMore: _isLoadingMore,
              hasMore: _hasMore,
              scrollController: _scrollController,
              onRefresh: () => _loadMedia(refresh: true),
              showTypeBadge: _selectedType == 'all',
              emptyMessage: 'Aucun média disponible dans cette sélection',
            ),
          ),
        ],
      ),
    );
  }
}
