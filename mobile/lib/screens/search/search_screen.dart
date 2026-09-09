import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';
import '../../services/api_service.dart';
import '../detail/detail_screen.dart';

class SearchScreen extends StatefulWidget {
  final String? initialQuery;

  const SearchScreen({super.key, this.initialQuery});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final ApiService _apiService = ApiService();
  Timer? _debounce;

  List<MediaItem> _results = [];
  bool _isLoading = false;
  bool _hasSearched = false;
  String _selectedFilter = 'Tous';

  final List<String> _filterChips = [
    'Tous',
    'Films',
    'Séries',
    'Animes',
    'Action',
    'Comédie',
    'Horreur',
    'Africains',
  ];

  final List<String> _quickSearches = [
    'Avatar',
    'One Piece',
    'Demon Slayer',
    'Stranger Things',
    'Avengers',
    'Naruto',
    'Lupin',
    'Attack on Titan',
    'Spider-Man',
    'Jujutsu Kaisen',
  ];

  @override
  void initState() {
    super.initState();
    if (widget.initialQuery != null && widget.initialQuery!.isNotEmpty) {
      _searchController.text = widget.initialQuery!;
      _executeSearch(widget.initialQuery!);
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onQueryChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      _executeSearch(query);
    });
  }

  Future<void> _executeSearch(String query) async {
    final cleanQuery = query.trim();
    if (cleanQuery.isEmpty) {
      if (mounted) {
        setState(() {
          _results = [];
          _isLoading = false;
          _hasSearched = false;
        });
      }
      return;
    }

    setState(() {
      _isLoading = true;
      _hasSearched = true;
    });

    try {
      final items = await _apiService.searchMedia(cleanQuery);
      if (mounted) {
        setState(() {
          _results = items;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _onSelectFilter(String filter) async {
    setState(() => _selectedFilter = filter);

    if (_searchController.text.trim().isNotEmpty) {
      return; // Le filtre s'applique localement aux résultats
    }

    setState(() {
      _isLoading = true;
      _hasSearched = true;
    });

    try {
      List<MediaItem> items = [];
      if (filter == 'Films') {
        items = await _apiService.getTrendingMovies();
      } else if (filter == 'Séries') {
        items = await _apiService.getPopularSeries();
      } else if (filter == 'Animes') {
        items = await _apiService.getAnimeSeries();
      } else if (filter == 'Africains') {
        items = await _apiService.getAfricanMovies();
      } else if (filter == 'Action') {
        items = await _apiService.getMoviesByGenre('28');
      } else if (filter == 'Comédie') {
        items = await _apiService.getMoviesByGenre('35');
      } else if (filter == 'Horreur') {
        items = await _apiService.getMoviesByGenre('27');
      } else {
        items = await _apiService.getTrendingMovies();
      }

      if (mounted) {
        setState(() {
          _results = items;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<MediaItem> get _filteredResults {
    if (_selectedFilter == 'Tous') return _results;
    if (_selectedFilter == 'Films') {
      return _results.where((item) => item.type == 'movie').toList();
    }
    if (_selectedFilter == 'Séries') {
      return _results.where((item) => item.type == 'serie' || item.type == 'tv' || item.type == 'series').toList();
    }
    if (_selectedFilter == 'Animes') {
      return _results.where((item) => item.type == 'anime' || (item.genres?.any((g) => g.toLowerCase().contains('anim')) ?? false)).toList();
    }
    if (_selectedFilter == 'Action') {
      return _results.where((item) => item.genres == null || item.genres!.isEmpty || item.genres!.any((g) => g.toLowerCase().contains('action') || g.toLowerCase().contains('avent'))).toList();
    }
    if (_selectedFilter == 'Comédie') {
      return _results.where((item) => item.genres == null || item.genres!.isEmpty || item.genres!.any((g) => g.toLowerCase().contains('coméd') || g.toLowerCase().contains('comed'))).toList();
    }
    if (_selectedFilter == 'Horreur') {
      return _results.where((item) => item.genres == null || item.genres!.isEmpty || item.genres!.any((g) => g.toLowerCase().contains('horr') || g.toLowerCase().contains('thrill'))).toList();
    }
    return _results;
  }

  void _openDetail(MediaItem item) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => DetailScreen(item: item)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final results = _filteredResults;

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: const Color(0xFF0C0C0E),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Container(
          height: 44,
          decoration: BoxDecoration(
            color: AppTheme.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
          ),
          child: TextField(
            controller: _searchController,
            autofocus: false,
            style: const TextStyle(color: Colors.white, fontSize: 14),
            decoration: InputDecoration(
              hintText: 'Rechercher films, séries TV, animes...',
              hintStyle: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
              prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.primary, size: 20),
              suffixIcon: _searchController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear_rounded, color: Colors.white54, size: 18),
                      onPressed: () {
                        _searchController.clear();
                        _executeSearch('');
                      },
                    )
                  : null,
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(vertical: 12),
            ),
            onChanged: _onQueryChanged,
            onSubmitted: _executeSearch,
          ),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(46),
          child: Container(
            height: 44,
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: _filterChips.length,
              itemBuilder: (context, index) {
                final filter = _filterChips[index];
                final isSelected = filter == _selectedFilter;

                return GestureDetector(
                  onTap: () => _onSelectFilter(filter),
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    decoration: BoxDecoration(
                      color: isSelected ? AppTheme.primary : AppTheme.card,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isSelected ? AppTheme.primary : Colors.white12,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      filter,
                      style: TextStyle(
                        color: isSelected ? Colors.white : Colors.white70,
                        fontSize: 12,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : !_hasSearched || (_searchController.text.trim().isEmpty && results.isEmpty)
              ? _buildQuickSuggestions()
              : results.isEmpty
                  ? _buildNoResults()
                  : _buildResultsGrid(results),
    );
  }

  Widget _buildQuickSuggestions() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.local_fire_department_rounded, color: AppTheme.primary, size: 20),
              SizedBox(width: 8),
              Text(
                'Recherches populaires',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _quickSearches.map((tag) {
              return ActionChip(
                backgroundColor: AppTheme.card,
                side: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                label: Text(tag, style: const TextStyle(color: Colors.white70, fontSize: 12)),
                avatar: const Icon(Icons.trending_up_rounded, color: AppTheme.primary, size: 14),
                onPressed: () {
                  _searchController.text = tag;
                  _executeSearch(tag);
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 24),
          const Row(
            children: [
              Icon(Icons.category_rounded, color: AppTheme.primary, size: 20),
              SizedBox(width: 8),
              Text(
                'Explorer par catégorie',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _filterChips.skip(1).map((cat) {
              return ActionChip(
                backgroundColor: AppTheme.surface,
                side: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                label: Text(cat, style: const TextStyle(color: Colors.white, fontSize: 12)),
                avatar: const Icon(Icons.explore_rounded, color: Colors.amber, size: 14),
                onPressed: () => _onSelectFilter(cat),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildNoResults() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.search_off_rounded, size: 64, color: AppTheme.textSecondary),
            const SizedBox(height: 16),
            Text(
              'Aucun résultat pour "${_searchController.text.trim()}"',
              style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            const Text(
              'Essayez de vérifier l\'orthographe ou choisissez une catégorie.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResultsGrid(List<MediaItem> items) {
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 170,
        childAspectRatio: 0.58,
        crossAxisSpacing: 10,
        mainAxisSpacing: 12,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        final isSeries = item.type == 'serie' || item.type == 'tv' || item.type == 'series';

        return GestureDetector(
          onTap: () => _openDetail(item),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      item.poster != null && item.poster!.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: item.poster!,
                              fit: BoxFit.cover,
                              placeholder: (context, url) => Container(color: AppTheme.card),
                              errorWidget: (context, url, error) => Container(
                                color: AppTheme.card,
                                child: const Icon(Icons.movie_rounded, color: Colors.white38),
                              ),
                            )
                          : Container(
                              color: AppTheme.card,
                              child: const Icon(Icons.movie_rounded, color: Colors.white38),
                            ),
                      // Type Badge
                      Positioned(
                        top: 6,
                        left: 6,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: isSeries ? Colors.purple : AppTheme.primary,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            isSeries ? 'SÉRIE' : 'FILM',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ),
                      // Year badge if present
                      if (item.year != null && item.year!.isNotEmpty)
                        Positioned(
                          top: 6,
                          right: 6,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.7),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              item.year!,
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                item.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
              ),
              if (item.rating != null && item.rating!.isNotEmpty)
                Row(
                  children: [
                    const Icon(Icons.star_rounded, color: Colors.amber, size: 13),
                    const SizedBox(width: 2),
                    Text(
                      item.rating!,
                      style: const TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
            ],
          ),
        );
      },
    );
  }
}
