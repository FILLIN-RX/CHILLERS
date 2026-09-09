import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';
import '../../services/storage_service.dart';
import '../detail/detail_screen.dart';

class PlaylistsScreen extends StatefulWidget {
  const PlaylistsScreen({super.key});

  @override
  State<PlaylistsScreen> createState() => _PlaylistsScreenState();
}

class _PlaylistsScreenState extends State<PlaylistsScreen> {
  final StorageService _storage = StorageService();
  final TextEditingController _nameController = TextEditingController();

  List<Map<String, dynamic>> _playlists = [];
  bool _isLoading = true;
  String? _selectedPlaylistId;

  @override
  void initState() {
    super.initState();
    _loadPlaylists();
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _loadPlaylists() async {
    final list = await _storage.getPlaylists();
    if (mounted) {
      setState(() {
        _playlists = list;
        _isLoading = false;
        if (_selectedPlaylistId == null && list.isNotEmpty) {
          _selectedPlaylistId = list.first['id'].toString();
        }
      });
    }
  }

  Future<void> _showCreatePlaylistDialog() async {
    _nameController.clear();
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Nouvelle Playlist', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: TextField(
          controller: _nameController,
          autofocus: true,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            hintText: 'Ex: Soirée Frissons, Animés 2026...',
            hintStyle: const TextStyle(color: Colors.white30, fontSize: 13),
            filled: true,
            fillColor: Colors.black26,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annuler', style: TextStyle(color: Colors.white60)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx, _nameController.text.trim()),
            child: const Text('Créer'),
          ),
        ],
      ),
    );

    if (name != null && name.isNotEmpty) {
      await _storage.createPlaylist(name);
      _loadPlaylists();
    }
  }

  Future<void> _deletePlaylist(String id, String name) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Supprimer la playlist', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: Text('Voulez-vous vraiment supprimer la playlist "$name" ?', style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler', style: TextStyle(color: Colors.white60))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent, foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );

    if (ok == true) {
      await _storage.deletePlaylist(id);
      _loadPlaylists();
    }
  }

  @override
  Widget build(BuildContext context) {
    final activePlaylist = _playlists.firstWhere(
      (p) => p['id'] == _selectedPlaylistId,
      orElse: () => _playlists.isNotEmpty ? _playlists.first : {},
    );
    final activeItems = (activePlaylist['items'] as List? ?? []).cast<Map<String, dynamic>>();

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: const Color(0xFF0C0C0E),
        elevation: 0,
        title: const Text(
          'Mes Playlists',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.playlist_add_rounded, color: AppTheme.primary, size: 26),
            tooltip: 'Créer une playlist',
            onPressed: _showCreatePlaylistDialog,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : _playlists.isEmpty
              ? _buildEmptyState()
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Onglets horizontaux des playlists
                    Container(
                      height: 52,
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: _playlists.length,
                        itemBuilder: (context, index) {
                          final pl = _playlists[index];
                          final isSelected = pl['id'] == _selectedPlaylistId;
                          final count = (pl['items'] as List? ?? []).length;

                          return GestureDetector(
                            onTap: () => setState(() => _selectedPlaylistId = pl['id'].toString()),
                            child: Container(
                              margin: const EdgeInsets.only(right: 8),
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                              decoration: BoxDecoration(
                                color: isSelected ? AppTheme.primary : AppTheme.card,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: isSelected ? AppTheme.primary : Colors.white12,
                                ),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.queue_music_rounded,
                                    size: 14,
                                    color: isSelected ? Colors.white : Colors.white70,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    pl['name'] as String? ?? 'Playlist',
                                    style: TextStyle(
                                      color: isSelected ? Colors.white : Colors.white70,
                                      fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                      fontSize: 12,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: Colors.black26,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Text(
                                      '$count',
                                      style: TextStyle(
                                        color: isSelected ? Colors.white : Colors.white60,
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),

                    // Header de la playlist active avec bouton supprimer
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              activePlaylist['name'] as String? ?? '',
                              style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (activePlaylist['id'] != null)
                            IconButton(
                              icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent, size: 20),
                              tooltip: 'Supprimer la playlist',
                              onPressed: () => _deletePlaylist(
                                activePlaylist['id'].toString(),
                                activePlaylist['name'].toString(),
                              ),
                            ),
                        ],
                      ),
                    ),

                    // Grille des éléments dans la playlist
                    Expanded(
                      child: activeItems.isEmpty
                          ? const Center(
                              child: Text(
                                'Cette playlist est vide.\nAjoutez des films ou séries depuis la page détail.',
                                textAlign: TextAlign.center,
                                style: TextStyle(color: AppTheme.textSecondary, fontSize: 13, height: 1.5),
                              ),
                            )
                          : GridView.builder(
                              padding: const EdgeInsets.all(16),
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 3,
                                childAspectRatio: 0.65,
                                crossAxisSpacing: 10,
                                mainAxisSpacing: 12,
                              ),
                              itemCount: activeItems.length,
                              itemBuilder: (context, index) {
                                final it = activeItems[index];
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
                                    );
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
                                            await _storage.removeItemFromPlaylist(
                                              activePlaylist['id'].toString(),
                                              media.id,
                                            );
                                            _loadPlaylists();
                                          },
                                          child: Container(
                                            padding: const EdgeInsets.all(4),
                                            decoration: BoxDecoration(
                                              color: Colors.black.withValues(alpha: 0.7),
                                              shape: BoxShape.circle,
                                            ),
                                            child: const Icon(Icons.close_rounded, color: Colors.white70, size: 14),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.playlist_play_rounded, size: 64, color: AppTheme.textSecondary),
            const SizedBox(height: 16),
            const Text(
              'Aucune playlist créée',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Créez des playlists personnalisées pour regrouper vos films et séries par thématique.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: _showCreatePlaylistDialog,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Créer ma première playlist', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}
