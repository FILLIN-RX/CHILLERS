import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';
import '../../services/api_service.dart';
import '../../services/search_service.dart';
import '../detail/detail_screen.dart';

class OptimizedSearchScreen extends StatefulWidget {
  final String? initialQuery;

  const OptimizedSearchScreen({
    super.key,
    this.initialQuery,
  });

  @override
  State<OptimizedSearchScreen> createState() => _OptimizedSearchScreenState();
}

class _OptimizedSearchScreenState extends State<OptimizedSearchScreen> {
  final SearchService _searchService = SearchService();
  final ApiService _apiService = ApiService();
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();

  List<MediaItem> _results = [];
  List<MediaItem> _filteredResults = [];
  bool _isSearching = false;
  String? _errorMessage;
  String _selectedFilter = 'all'; // all, movie, serie, anime

  // Sections découvertes (comme sur la capture d'écran)
  List<MediaItem> _recommendedForYou = [];
  List<MediaItem> _trendingMovies = [];
  List<MediaItem> _newReleases = [];
  bool _isLoadingSections = true;

  final List<String> _popularQueries = [
    'Avengers',
    'Game of Thrones',
    'The Flash',
    'Stranger Things',
    'Spider-Man',
    'Dune',
    'Oppenheimer',
    'One Piece',
    'The Walking Dead',
    'Breaking Bad',
  ];

  @override
  void initState() {
    super.initState();
    _loadInitialSections();
    if (widget.initialQuery != null && widget.initialQuery!.isNotEmpty) {
      _searchController.text = widget.initialQuery!;
      _performSearch(widget.initialQuery!);
    }
  }

  Future<void> _loadInitialSections() async {
    try {
      final recs = await _apiService.getPopularSeries(page: 1);
      final trending = await _apiService.getTrendingMovies(page: 1);
      final releases = await _apiService.getUpcomingMovies(page: 1);

      if (mounted) {
        setState(() {
          _recommendedForYou = recs.isNotEmpty ? recs : [];
          _trendingMovies = trending.isNotEmpty ? trending : [];
          _newReleases = releases.isNotEmpty ? releases : [];
          _isLoadingSections = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingSections = false);
    }
  }

  @override
  void dispose() {
    _searchService.cancelSearch();
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  void _performSearch(String query) {
    if (query.trim().isEmpty) {
      setState(() {
        _results = [];
        _filteredResults = [];
        _errorMessage = null;
        _isSearching = false;
      });
      return;
    }

    setState(() {
      _isSearching = true;
      _errorMessage = null;
    });

    _searchService.search(
      query,
      onResults: (results) {
        if (mounted) {
          setState(() {
            _results = results;
            _applyFilter();
            _isSearching = false;
          });
        }
      },
      onError: (error) {
        if (mounted) {
          setState(() {
            _errorMessage = error;
            _isSearching = false;
          });
        }
      },
    );
  }

  void _applyFilter() {
    if (_selectedFilter == 'all') {
      _filteredResults = _results;
    } else {
      _filteredResults = _searchService.filterByType(_results, _selectedFilter);
    }
  }

  void _onFilterChanged(String filter) {
    setState(() {
      _selectedFilter = filter;
      _applyFilter();
    });
  }

  void _onItemTap(MediaItem item) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => DetailScreen(item: item),
      ),
    );
  }

  void _onPopularChipTap(String query) {
    _searchController.text = query;
    _searchController.selection = TextSelection.fromPosition(
      TextPosition(offset: query.length),
    );
    _performSearch(query);
  }

  void _onCancelTap() {
    if (_searchController.text.isNotEmpty) {
      _searchController.clear();
      _performSearch('');
      _searchFocusNode.unfocus();
    } else {
      Navigator.maybePop(context);
    }
  }

  String _formatSubtitle(MediaItem item) {
    final isTv = item.type == 'serie' || item.type == 'series' || item.type == 'tv' || item.type == 'anime';
    final genre = (item.genres != null && item.genres!.isNotEmpty) ? item.genres!.first : (isTv ? 'Drama' : 'Action');
    final year = item.year != null && item.year!.isNotEmpty ? item.year! : '2024';

    if (isTv) {
      return 'TV Show • $genre';
    }

    if (item.runtime != null && item.runtime! > 0) {
      final h = item.runtime! ~/ 60;
      final m = item.runtime! % 60;
      final dur = h > 0 ? '${h}h ${m}m' : '${m}m';
      return '$year • $dur';
    }

    return '$year • $genre';
  }

  @override
  Widget build(BuildContext context) {
    final isSearchingMode = _searchController.text.trim().isNotEmpty;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0C),
      body: SafeArea(
        child: Column(
          children: [
            // ── TOP SEARCH BAR ──
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      height: 42,
                      decoration: BoxDecoration(
                        color: const Color(0xFF18181C),
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(color: Colors.white10, width: 0.8),
                      ),
                      child: Row(
                        children: [
                          const SizedBox(width: 14),
                          const FaIcon(
                            FontAwesomeIcons.magnifyingGlass,
                            color: Colors.white38,
                            size: 15,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextField(
                              controller: _searchController,
                              focusNode: _searchFocusNode,
                              style: const TextStyle(color: Colors.white, fontSize: 14),
                              textInputAction: TextInputAction.search,
                              decoration: const InputDecoration(
                                hintText: 'Search movies, TV shows...',
                                hintStyle: TextStyle(color: Colors.white38, fontSize: 14),
                                border: InputBorder.none,
                                isCollapsed: true,
                              ),
                              onChanged: (val) => _performSearch(val),
                            ),
                          ),
                          if (_searchController.text.isNotEmpty)
                            GestureDetector(
                              behavior: HitTestBehavior.opaque,
                              onTap: () {
                                _searchController.clear();
                                _performSearch('');
                              },
                              child: const Padding(
                                padding: EdgeInsets.symmetric(horizontal: 12),
                                child: FaIcon(
                                  FontAwesomeIcons.circleXmark,
                                  color: Colors.white38,
                                  size: 15,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  GestureDetector(
                    onTap: _onCancelTap,
                    behavior: HitTestBehavior.opaque,
                    child: const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                      child: Text(
                        'Cancel',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ── BODY CONTENT ──
            Expanded(
              child: isSearchingMode
                  ? _buildSearchResultsView()
                  : _buildDiscoveryView(),
            ),
          ],
        ),
      ),
    );
  }

  // ── VUE PAR DÉFAUT (SECTIONS IDENTIQUES À LA CAPTURE D'ÉCRAN) ──
  Widget _buildDiscoveryView() {
    if (_isLoadingSections) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFFE50914), strokeWidth: 2),
      );
    }

    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 10),
      children: [
        // 1. Popular Searches Chips
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            'Popular Searches',
            style: TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.bold,
              letterSpacing: -0.2,
            ),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 38,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            scrollDirection: Axis.horizontal,
            itemCount: _popularQueries.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final query = _popularQueries[index];
              return GestureDetector(
                onTap: () => _onPopularChipTap(query),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF16161A),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white12, width: 0.8),
                  ),
                  child: Text(
                    query,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              );
            },
          ),
        ),

        const SizedBox(height: 24),

        // 2. Recommended For You Section
        if (_recommendedForYou.isNotEmpty) ...[
          _buildSectionHeader('Recommended For You'),
          const SizedBox(height: 12),
          _buildHorizontalMediaList(_recommendedForYou),
          const SizedBox(height: 24),
        ],

        // 3. Trending Movies Section
        if (_trendingMovies.isNotEmpty) ...[
          _buildSectionHeader('Trending Movies'),
          const SizedBox(height: 12),
          _buildHorizontalMediaList(_trendingMovies),
          const SizedBox(height: 24),
        ],

        // 4. New Releases Section
        if (_newReleases.isNotEmpty) ...[
          _buildSectionHeader('New Releases', showChevron: true),
          const SizedBox(height: 12),
          _buildHorizontalMediaList(_newReleases),
          const SizedBox(height: 24),
        ],
      ],
    );
  }

  Widget _buildSectionHeader(String title, {bool showChevron = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.bold,
              letterSpacing: -0.2,
            ),
          ),
          if (showChevron)
            const Icon(Icons.chevron_right, color: Colors.white70, size: 20),
        ],
      ),
    );
  }

  Widget _buildHorizontalMediaList(List<MediaItem> items) {
    return SizedBox(
      height: 235,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        scrollDirection: Axis.horizontal,
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, index) {
          final item = items[index];
          return _buildMediaCard(item);
        },
      ),
    );
  }

  Widget _buildMediaCard(MediaItem item) {
    final rating = item.rating != null && item.rating!.isNotEmpty ? item.rating! : null;

    return GestureDetector(
      onTap: () => _onItemTap(item),
      child: SizedBox(
        width: 118,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Poster avec coins arrondis et badge étoile
            Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    width: 118,
                    height: 168,
                    color: const Color(0xFF1A1A1E),
                    child: item.poster != null && item.poster!.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: item.poster!,
                            fit: BoxFit.cover,
                            placeholder: (_, __) => Container(color: const Color(0xFF1A1A1E)),
                            errorWidget: (_, __, ___) => const Center(
                              child: FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 24),
                            ),
                          )
                        : const Center(
                            child: FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 24),
                          ),
                  ),
                ),

                // Note avec étoile dorée en bas à gauche sur le poster
                if (rating != null)
                  Positioned(
                    bottom: 6,
                    left: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.65),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.star, color: Color(0xFFFFB800), size: 11),
                          const SizedBox(width: 3),
                          Text(
                            rating,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10.5,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),

            const SizedBox(height: 6),

            // Titre du média
            Text(
              item.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12.5,
                fontWeight: FontWeight.bold,
              ),
            ),

            const SizedBox(height: 2),

            // Sous-titre (ex: TV Show • Drama ou 2024 • 2h 46m)
            Text(
              _formatSubtitle(item),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white54,
                fontSize: 10.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── VUE RÉSULTATS DE RECHERCHE ──
  Widget _buildSearchResultsView() {
    if (_isSearching) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFFE50914), strokeWidth: 2),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const FaIcon(FontAwesomeIcons.triangleExclamation, color: Colors.white38, size: 40),
            const SizedBox(height: 12),
            Text(_errorMessage!, style: const TextStyle(color: Colors.white70, fontSize: 13)),
          ],
        ),
      );
    }

    if (_filteredResults.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 48),
            const SizedBox(height: 14),
            Text(
              'Aucun résultat pour "${_searchController.text}"',
              style: const TextStyle(color: Colors.white60, fontSize: 14),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        // Filter Chips (Tous, Films, Séries, Animes)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: SizedBox(
            height: 32,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _buildFilterChip('Tous', 'all'),
                const SizedBox(width: 8),
                _buildFilterChip('Films', 'movie'),
                const SizedBox(width: 8),
                _buildFilterChip('Séries', 'serie'),
                const SizedBox(width: 8),
                _buildFilterChip('Animes', 'anime'),
              ],
            ),
          ),
        ),

        // Grid 3 Colonnes
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            itemCount: _filteredResults.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 10,
              mainAxisSpacing: 14,
              childAspectRatio: 0.58,
            ),
            itemBuilder: (context, index) {
              final item = _filteredResults[index];
              return _buildMediaCard(item);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildFilterChip(String label, String filter) {
    final isActive = _selectedFilter == filter;
    return GestureDetector(
      onTap: () => _onFilterChanged(filter),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        decoration: BoxDecoration(
          color: isActive ? Colors.white : const Color(0xFF18181C),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isActive ? Colors.white : Colors.white12, width: 0.8),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              color: isActive ? Colors.black : Colors.white70,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
    );
  }
}
