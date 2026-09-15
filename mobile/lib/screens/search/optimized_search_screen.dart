import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';
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
  final TextEditingController _searchController = TextEditingController();
  
  List<MediaItem> _results = [];
  List<MediaItem> _filteredResults = [];
  bool _isSearching = false;
  String? _errorMessage;
  String _selectedFilter = 'all'; // all, movie, serie, anime

  @override
  void initState() {
    super.initState();
    if (widget.initialQuery != null) {
      _searchController.text = widget.initialQuery!;
      _performSearch(widget.initialQuery!);
    }
  }

  @override
  void dispose() {
    _searchService.cancelSearch();
    _searchController.dispose();
    super.dispose();
  }

  void _performSearch(String query) {
    if (query.trim().isEmpty) {
      setState(() {
        _results = [];
        _filteredResults = [];
        _errorMessage = null;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: Column(
        children: [
          // Custom App Bar with Search
          Container(
            padding: EdgeInsets.fromLTRB(
              16,
              MediaQuery.of(context).padding.top + 8,
              16,
              16,
            ),
            decoration: BoxDecoration(
              color: AppTheme.card,
              border: Border(
                bottom: BorderSide(color: Colors.white10),
              ),
            ),
            child: Column(
              children: [
                // Search Input
                Row(
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: const Icon(
                        Icons.arrow_back_rounded,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Container(
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.1),
                          ),
                        ),
                        child: TextField(
                          controller: _searchController,
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            hintText: 'Rechercher...',
                            hintStyle: TextStyle(color: Colors.white54),
                            border: InputBorder.none,
                            prefixIcon: const Icon(
                              Icons.search_rounded,
                              color: AppTheme.primary,
                              size: 20,
                            ),
                            suffixIcon: _searchController.text.isNotEmpty
                                ? GestureDetector(
                                    onTap: () {
                                      _searchController.clear();
                                      _performSearch('');
                                    },
                                    child: const Icon(
                                      Icons.clear_rounded,
                                      color: Colors.white54,
                                      size: 18,
                                    ),
                                  )
                                : null,
                            contentPadding: const EdgeInsets.symmetric(
                              vertical: 12,
                              horizontal: 4,
                            ),
                          ),
                          onChanged: (value) {
                            setState(() {});
                            _performSearch(value);
                          },
                          textInputAction: TextInputAction.search,
                        ),
                      ),
                    ),
                  ],
                ),

                // Filter Chips
                if (_results.isNotEmpty || _filteredResults.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: SizedBox(
                      height: 36,
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
              ],
            ),
          ),

          // Search Results
          Expanded(
            child: _buildContent(),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String filter) {
    final isActive = _selectedFilter == filter;
    return GestureDetector(
      onTap: () => _onFilterChanged(filter),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isActive ? AppTheme.primary : Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isActive
                ? AppTheme.primary
                : Colors.white.withValues(alpha: 0.1),
          ),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              color: isActive ? Colors.white : Colors.white70,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (_isSearching) {
      return const Center(
        child: CircularProgressIndicator(color: AppTheme.primary),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline_rounded,
              color: Colors.white54,
              size: 48,
            ),
            const SizedBox(height: 16),
            Text(
              _errorMessage!,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white70),
            ),
          ],
        ),
      );
    }

    if (_searchController.text.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.search_rounded,
              color: Colors.white30,
              size: 64,
            ),
            const SizedBox(height: 16),
            Text(
              'Recherchez des films, séries ou animes',
              style: TextStyle(color: Colors.white54, fontSize: 16),
            ),
          ],
        ),
      );
    }

    if (_filteredResults.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.not_interested_rounded,
              color: Colors.white30,
              size: 64,
            ),
            const SizedBox(height: 16),
            Text(
              'Aucun résultat trouvé',
              style: TextStyle(color: Colors.white54, fontSize: 16),
            ),
          ],
        ),
      );
    }

    // Grid of results
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        childAspectRatio: 0.6,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
      ),
      itemCount: _filteredResults.length,
      itemBuilder: (context, index) {
        final item = _filteredResults[index];
        return _buildResultCard(item);
      },
    );
  }

  Widget _buildResultCard(MediaItem item) {
    return GestureDetector(
      onTap: () => _onItemTap(item),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.white10),
        ),
        child: Stack(
          children: [
            // Poster
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: item.poster != null && item.poster!.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: item.poster!,
                      fit: BoxFit.cover,
                      placeholder: (context, url) => Container(
                        color: AppTheme.card,
                        child: const Center(
                          child: CircularProgressIndicator(
                            color: AppTheme.primary,
                            strokeWidth: 2,
                          ),
                        ),
                      ),
                      errorWidget: (context, url, error) => Container(
                        color: AppTheme.card,
                        child: const Icon(Icons.movie, color: Colors.white30),
                      ),
                    )
                  : Container(
                      color: AppTheme.card,
                      child: const Icon(Icons.movie, color: Colors.white30),
                    ),
            ),

            // Overlay with info
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    Colors.black.withValues(alpha: 0.8),
                  ],
                ),
              ),
            ),

            // Info at bottom
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    if (item.rating != null && item.rating!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Row(
                          children: [
                            const Icon(Icons.star, color: Colors.amber, size: 10),
                            const SizedBox(width: 2),
                            Text(
                              item.rating!,
                              style: const TextStyle(
                                color: Colors.amber,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
