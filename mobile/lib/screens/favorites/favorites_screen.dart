import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';
import '../../services/storage_service.dart';
import '../detail/detail_screen.dart';

class FavoritesScreen extends StatefulWidget {
  final int initialTabIndex;

  const FavoritesScreen({super.key, this.initialTabIndex = 0});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> with SingleTickerProviderStateMixin {
  final StorageService _storage = StorageService();
  late TabController _tabController;

  List<Map<String, dynamic>> _favorites = [];
  List<Map<String, dynamic>> _watchlist = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this, initialIndex: widget.initialTabIndex);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    final favs = await _storage.getFavorites();
    final wl = await _storage.getWatchlist();
    if (mounted) {
      setState(() {
        _favorites = favs;
        _watchlist = wl;
        _isLoading = false;
      });
    }
  }

  Widget _buildMediaGrid(List<Map<String, dynamic>> items, {required bool isFavoriteTab}) {
    if (items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                isFavoriteTab ? Icons.favorite_border_rounded : Icons.bookmark_border_rounded,
                size: 64,
                color: AppTheme.textSecondary,
              ),
              const SizedBox(height: 16),
              Text(
                isFavoriteTab ? 'Aucun favori enregistré' : 'Votre liste est vide',
                style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                isFavoriteTab
                    ? 'Ajoutez des films et séries en favoris pour les retrouver facilement.'
                    : 'Enregistrez des titres dans "Ma Liste" pour les regarder plus tard.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
              ),
            ],
          ),
        ),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        childAspectRatio: 0.65,
        crossAxisSpacing: 10,
        mainAxisSpacing: 12,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final it = items[index];
        final media = MediaItem(
          id: it['id'].toString(),
          title: it['title'] ?? 'Titre',
          poster: it['poster'],
          type: it['type'] ?? 'movie',
          rating: it['rating'],
          year: it['year'],
        );

        return GestureDetector(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => DetailScreen(item: media)),
            ).then((_) => _loadData());
          },
          child: Stack(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: media.poster != null && media.poster!.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: media.poster!,
                              fit: BoxFit.cover,
                              width: double.infinity,
                              placeholder: (context, url) => Container(color: AppTheme.card),
                              errorWidget: (context, url, error) => Container(
                                color: AppTheme.card,
                                child: const Icon(Icons.movie, color: Colors.white24),
                              ),
                            )
                          : Container(
                              color: AppTheme.card,
                              child: const Icon(Icons.movie, color: Colors.white24),
                            ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    media.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              Positioned(
                top: 4,
                right: 4,
                child: GestureDetector(
                  onTap: () async {
                    if (isFavoriteTab) {
                      await _storage.toggleFavorite(it);
                    } else {
                      await _storage.toggleWatchlist(it);
                    }
                    _loadData();
                  },
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.75),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      isFavoriteTab ? Icons.favorite_rounded : Icons.bookmark_remove_rounded,
                      color: isFavoriteTab ? Colors.redAccent : AppTheme.primary,
                      size: 14,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: const Color(0xFF0C0C0E),
        elevation: 0,
        title: const Text(
          'Bibliothèque Personnelle',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.primary,
          indicatorWeight: 3,
          labelColor: AppTheme.primary,
          unselectedLabelColor: Colors.white60,
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
          tabs: [
            Tab(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.favorite_rounded, size: 16),
                  const SizedBox(width: 6),
                  Text('Favoris (${_favorites.length})'),
                ],
              ),
            ),
            Tab(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.bookmark_rounded, size: 16),
                  const SizedBox(width: 6),
                  Text('Ma Liste (${_watchlist.length})'),
                ],
              ),
            ),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : TabBarView(
              controller: _tabController,
              children: [
                _buildMediaGrid(_favorites, isFavoriteTab: true),
                _buildMediaGrid(_watchlist, isFavoriteTab: false),
              ],
            ),
    );
  }
}
