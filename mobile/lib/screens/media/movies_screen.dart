import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';
import '../../models/genre.dart';
import '../../services/api_service.dart';
import 'widgets/media_grid_view.dart';

class MoviesScreen extends StatefulWidget {
  final String? initialGenreId;

  const MoviesScreen({
    super.key,
    this.initialGenreId,
  });

  @override
  State<MoviesScreen> createState() => _MoviesScreenState();
}

class _MoviesScreenState extends State<MoviesScreen> {
  final ApiService _apiService = ApiService();
  final ScrollController _scrollController = ScrollController();

  String? _selectedGenreId;
  String _selectedSort = 'popularity'; // popularity, trending, top_rated

  List<MediaItem> _items = [];
  List<GenreModel> _genres = [];
  bool _isLoading = true;
  bool _isLoadingMore = false;
  bool _hasMore = true;
  int _currentPage = 1;

  final List<Map<String, String>> _sortOptions = const [
    {'id': 'popularity', 'label': 'Populaires'},
    {'id': 'trending', 'label': 'Tendances'},
    {'id': 'top_rated', 'label': 'Mieux notés'},
  ];

  @override
  void initState() {
    super.initState();
    _selectedGenreId = widget.initialGenreId;
    _scrollController.addListener(_onScroll);
    _loadGenres();
    _loadMovies(refresh: true);
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
        _loadMoreMovies();
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
    if (_selectedGenreId != null) {
      return _apiService.getMoviesByGenre(_selectedGenreId!, page: page);
    }
    if (_selectedSort == 'trending') {
      return _apiService.getTrendingMovies();
    } else if (_selectedSort == 'top_rated') {
      return _apiService.getTopRatedMovies(page: page);
    } else {
      return _apiService.getPopularMovies(page: page);
    }
  }

  Future<void> _loadMovies({bool refresh = false}) async {
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

  Future<void> _loadMoreMovies() async {
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
        title: const Row(
          children: [
            Icon(Icons.movie_creation_rounded, color: AppTheme.primary, size: 22),
            SizedBox(width: 8),
            Text(
              'Films',
              style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 18),
            ),
          ],
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
                    _loadMovies(refresh: true);
                  }
                },
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── BARRE DES GENRES (ACTION, COMÉDIE, HORREUR, SF, DRAME...) ──
          if (_genres.isNotEmpty)
            Container(
              height: 44,
              color: const Color(0xFF0C0C0E),
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                itemCount: _genres.length + 1,
                itemBuilder: (context, index) {
                  if (index == 0) {
                    final isSelected = _selectedGenreId == null;
                    return Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ChoiceChip(
                        label: const Text('Tous genres'),
                        selected: isSelected,
                        selectedColor: AppTheme.primary,
                        backgroundColor: AppTheme.card,
                        labelStyle: TextStyle(
                          color: isSelected ? Colors.white : Colors.white70,
                          fontSize: 11,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                        side: BorderSide(
                          color: isSelected ? AppTheme.primary : Colors.white.withValues(alpha: 0.08),
                        ),
                        onSelected: (_) {
                          if (_selectedGenreId != null) {
                            setState(() => _selectedGenreId = null);
                            _loadMovies(refresh: true);
                          }
                        },
                      ),
                    );
                  }

                  final genre = _genres[index - 1];
                  final isSelected = _selectedGenreId == genre.id.toString();

                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text(genre.name),
                      selected: isSelected,
                      selectedColor: AppTheme.primary,
                      backgroundColor: AppTheme.card,
                      labelStyle: TextStyle(
                        color: isSelected ? Colors.white : Colors.white70,
                        fontSize: 11,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      ),
                      side: BorderSide(
                        color: isSelected ? AppTheme.primary : Colors.white.withValues(alpha: 0.08),
                      ),
                      onSelected: (_) {
                        setState(() {
                          _selectedGenreId = isSelected ? null : genre.id.toString();
                        });
                        _loadMovies(refresh: true);
                      },
                    ),
                  );
                },
              ),
            ),

          // ── GRILLE DES FILMS ──
          Expanded(
            child: MediaGridView(
              items: _items,
              isLoading: _isLoading,
              isLoadingMore: _isLoadingMore,
              hasMore: _hasMore,
              scrollController: _scrollController,
              onRefresh: () => _loadMovies(refresh: true),
              showTypeBadge: false,
              emptyMessage: 'Aucun film trouvé dans cette catégorie',
            ),
          ),
        ],
      ),
    );
  }
}
