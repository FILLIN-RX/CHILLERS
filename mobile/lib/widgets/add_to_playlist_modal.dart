import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/media_item.dart';
import '../services/storage_service.dart';

class AddToPlaylistModal extends StatefulWidget {
  final MediaItem item;

  const AddToPlaylistModal({super.key, required this.item});

  static Future<void> show(BuildContext context, MediaItem item) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => AddToPlaylistModal(item: item),
    );
  }

  @override
  State<AddToPlaylistModal> createState() => _AddToPlaylistModalState();
}

class _AddToPlaylistModalState extends State<AddToPlaylistModal> {
  final StorageService _storage = StorageService();
  final TextEditingController _nameController = TextEditingController();

  List<Map<String, dynamic>> _playlists = [];
  bool _isLoading = true;
  bool _isCreatingNew = false;

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
      });
    }
  }

  bool _isItemInPlaylist(Map<String, dynamic> playlist) {
    final items = playlist['items'] as List? ?? [];
    return items.any((it) => it['id'].toString() == widget.item.id);
  }

  Future<void> _togglePlaylist(Map<String, dynamic> playlist) async {
    final playlistId = playlist['id'].toString();
    final isIn = _isItemInPlaylist(playlist);

    if (isIn) {
      await _storage.removeItemFromPlaylist(playlistId, widget.item.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppTheme.card,
            content: Text('Retiré de "${playlist['name']}"'),
            duration: const Duration(seconds: 1),
          ),
        );
      }
    } else {
      await _storage.addItemToPlaylist(playlistId, widget.item.toJson());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppTheme.primary,
            content: Row(
              children: [
                const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
                const SizedBox(width: 8),
                Text('Ajouté à "${playlist['name']}"', style: const TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    }
    _loadPlaylists();
  }

  Future<void> _createNewPlaylist() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) return;

    await _storage.createPlaylist(name);
    final updated = await _storage.getPlaylists();
    if (updated.isNotEmpty) {
      // Ajouter automatiquement le média à la playlist nouvellement créée
      await _storage.addItemToPlaylist(updated.first['id'].toString(), widget.item.toJson());
    }

    _nameController.clear();
    setState(() => _isCreatingNew = false);
    _loadPlaylists();

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppTheme.primary,
          content: Text('Playlist "$name" créée et média ajouté !'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.playlist_add_rounded, color: AppTheme.primary, size: 24),
                  SizedBox(width: 10),
                  Text(
                    'Ajouter à une playlist',
                    style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close_rounded, color: Colors.white70),
              ),
            ],
          ),
          const SizedBox(height: 6),

          Text(
            widget.item.title,
            style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 16),

          // Formulaire de création rapide
          if (_isCreatingNew) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.primary.withValues(alpha: 0.4)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Nom de la nouvelle playlist', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _nameController,
                    autofocus: true,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: 'Ex: Mes animes du soir, Chefs-d\'oeuvre...',
                      hintStyle: const TextStyle(color: Colors.white30, fontSize: 13),
                      filled: true,
                      fillColor: Colors.black26,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(
                        onPressed: () => setState(() => _isCreatingNew = false),
                        child: const Text('Annuler', style: TextStyle(color: Colors.white60)),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primary,
                          foregroundColor: Colors.white,
                          visualDensity: VisualDensity.compact,
                        ),
                        onPressed: _createNewPlaylist,
                        child: const Text('Créer et Ajouter'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ] else ...[
            GestureDetector(
              onTap: () => setState(() => _isCreatingNew = true),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.add_rounded, color: AppTheme.primary),
                    SizedBox(width: 10),
                    Text(
                      'Créer une nouvelle playlist',
                      style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
          ],

          // Liste des playlists existantes
          if (_isLoading)
            const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator(color: AppTheme.primary)))
          else if (_playlists.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Center(
                child: Text('Aucune playlist disponible', style: TextStyle(color: Colors.white54, fontSize: 13)),
              ),
            )
          else
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 260),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _playlists.length,
                itemBuilder: (context, index) {
                  final pl = _playlists[index];
                  final isIn = _isItemInPlaylist(pl);
                  final itemsCount = (pl['items'] as List? ?? []).length;

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Material(
                      color: isIn ? AppTheme.primary.withValues(alpha: 0.22) : Colors.white.withValues(alpha: 0.04),
                      borderRadius: BorderRadius.circular(14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                        side: BorderSide(
                          color: isIn ? AppTheme.primary : Colors.white10,
                          width: isIn ? 1.5 : 1,
                        ),
                      ),
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                        leading: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: isIn ? AppTheme.primary : Colors.white.withValues(alpha: 0.08),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            isIn ? Icons.playlist_add_check_rounded : Icons.queue_music_rounded,
                            color: isIn ? Colors.white : Colors.white60,
                            size: 20,
                          ),
                        ),
                        title: Text(
                          pl['name'] as String? ?? 'Playlist',
                          style: TextStyle(
                            color: isIn ? Colors.white : Colors.white70,
                            fontWeight: isIn ? FontWeight.w900 : FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                        subtitle: Text(
                          '$itemsCount média${itemsCount > 1 ? 's' : ''}',
                          style: TextStyle(
                            color: isIn ? AppTheme.primary : AppTheme.textSecondary,
                            fontWeight: isIn ? FontWeight.bold : FontWeight.normal,
                            fontSize: 11,
                          ),
                        ),
                        trailing: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: isIn ? AppTheme.primary : Colors.transparent,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isIn ? AppTheme.primary : Colors.white30,
                              width: 1.5,
                            ),
                          ),
                          child: Icon(
                            isIn ? Icons.check_rounded : Icons.add_rounded,
                            size: 16,
                            color: isIn ? Colors.white : Colors.white30,
                          ),
                        ),
                        onTap: () => _togglePlaylist(pl),
                      ),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
