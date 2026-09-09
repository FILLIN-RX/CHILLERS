import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';
import '../../services/api_service.dart';
import 'widgets/media_grid_view.dart';

class AnimesScreen extends StatefulWidget {
  const AnimesScreen({super.key});

  @override
  State<AnimesScreen> createState() => _AnimesScreenState();
}

class _AnimesScreenState extends State<AnimesScreen> {
  final ApiService _apiService = ApiService();
  final ScrollController _scrollController = ScrollController();

  String _selectedFilter = 'all'; // all, shonen, trending, top_rated
  List<MediaItem> _items = [];
  bool _isLoading = true;
  bool _isLoadingMore = false;
  bool _hasMore = true;
  int _currentPage = 1;

  final List<Map<String, dynamic>> _filterOptions = const [
    {'id': 'all', 'label': 'Tous les Animes', 'icon': Icons.auto_awesome_rounded},
    {'id': 'action', 'label': 'Action & Shōnen', 'icon': Icons.local_fire_department_rounded},
    {'id': 'fantasy', 'label': 'Fantaisie & Isekai', 'icon': Icons.stars_rounded},
    {'id': 'trending', 'label': 'Tendances', 'icon': Icons.trending_up_rounded},
  ];

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _loadAnimes(refresh: true);
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
        _loadMoreAnimes();
      }
    }
  }

  Future<List<MediaItem>> _fetchPage(int page) async {
    if (_selectedFilter == 'action') {
      return _apiService.getMediaByGenre('10759', type: 'tv', page: page);
    } else if (_selectedFilter == 'fantasy') {
      return _apiService.getMediaByGenre('10765', type: 'tv', page: page);
    } else {
      return _apiService.getAnimeSeries(page: page);
    }
  }

  Future<void> _loadAnimes({bool refresh = false}) async {
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

  Future<void> _loadMoreAnimes() async {
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
            Icon(Icons.auto_awesome_rounded, color: AppTheme.primary, size: 22),
            SizedBox(width: 8),
            Text(
              'Animes & Mangas',
              style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 18),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // ── BARRE DE FILTRES D'ANIMES ──
          Container(
            height: 44,
            color: const Color(0xFF0C0C0E),
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              itemCount: _filterOptions.length,
              itemBuilder: (context, index) {
                final filter = _filterOptions[index];
                final isSelected = _selectedFilter == filter['id'];

                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    avatar: Icon(
                      filter['icon'] as IconData,
                      size: 16,
                      color: isSelected ? Colors.white : AppTheme.primary,
                    ),
                    label: Text(filter['label'] as String),
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
                      setState(() => _selectedFilter = filter['id'] as String);
                      _loadAnimes(refresh: true);
                    },
                  ),
                );
              },
            ),
          ),

          // ── GRILLE DES ANIMES ──
          Expanded(
            child: MediaGridView(
              items: _items,
              isLoading: _isLoading,
              isLoadingMore: _isLoadingMore,
              hasMore: _hasMore,
              scrollController: _scrollController,
              onRefresh: () => _loadAnimes(refresh: true),
              showTypeBadge: false,
              emptyMessage: 'Aucun anime trouvé pour ce filtre',
            ),
          ),
        ],
      ),
    );
  }
}
