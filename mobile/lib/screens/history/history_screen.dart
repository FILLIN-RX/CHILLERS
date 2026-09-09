import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';
import '../../services/storage_service.dart';
import '../watch/watch_screen.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  final StorageService _storage = StorageService();
  List<Map<String, dynamic>> _history = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    final list = await _storage.getContinueWatching();
    if (mounted) {
      setState(() {
        _history = list;
        _isLoading = false;
      });
    }
  }

  Future<void> _clearAll() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Effacer l\'historique', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: const Text(
          'Voulez-vous vraiment effacer tout votre historique de visionnage ?',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler', style: TextStyle(color: Colors.white60)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent, foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Tout effacer'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _storage.clearWatchHistory();
      _loadHistory();
    }
  }

  String _formatDuration(int ms) {
    final totalSec = ms ~/ 1000;
    final m = totalSec ~/ 60;
    final s = totalSec % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: const Color(0xFF0C0C0E),
        elevation: 0,
        title: const Text(
          'Lectures Récentes',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          if (_history.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_sweep_rounded, color: Colors.white70),
              tooltip: 'Tout effacer',
              onPressed: _clearAll,
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : _history.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.history_toggle_off_rounded, size: 64, color: AppTheme.textSecondary),
                        const SizedBox(height: 16),
                        const Text(
                          'Aucune lecture récente',
                          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Les films et épisodes que vous commencez apparaîtront ici pour reprendre instantanément.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _history.length,
                  itemBuilder: (context, index) {
                    final item = _history[index];
                    final percentage = (item['percentage'] as num?)?.toDouble() ?? 0.0;
                    final posMs = (item['positionMs'] as num?)?.toInt() ?? 0;
                    final durMs = (item['durationMs'] as num?)?.toInt() ?? 0;
                    final isSeries = item['type'] == 'series' || item['type'] == 'anime' || item['season'] != null;

                    final media = MediaItem(
                      id: item['id']?.toString() ?? '',
                      title: item['title'] ?? 'Vidéo',
                      poster: item['poster'],
                      type: item['type'] ?? 'movie',
                    );

                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: AppTheme.card,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: InkWell(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => WatchScreen(
                                item: media,
                                initialSeason: item['season'] as int?,
                                initialEpisode: item['episode'] as int?,
                                initialVideoUrl: item['streamUrl'] as String?,
                              ),
                            ),
                          ).then((_) => _loadHistory());
                        },
                        borderRadius: BorderRadius.circular(14),
                        child: Row(
                          children: [
                            // Thumbnail 16:9 avec barre de progression
                            Stack(
                              alignment: Alignment.center,
                              children: [
                                ClipRRect(
                                  borderRadius: const BorderRadius.horizontal(left: Radius.circular(14)),
                                  child: (item['poster'] != null && item['poster'].toString().isNotEmpty)
                                      ? CachedNetworkImage(
                                          imageUrl: item['poster'] as String,
                                          height: 90,
                                          width: 140,
                                          fit: BoxFit.cover,
                                          placeholder: (context, url) => Container(color: Colors.black26),
                                          errorWidget: (context, url, error) => Container(
                                            height: 90,
                                            width: 140,
                                            color: Colors.black26,
                                            child: const Icon(Icons.movie, color: Colors.white24),
                                          ),
                                        )
                                      : Container(
                                          height: 90,
                                          width: 140,
                                          color: Colors.black26,
                                          child: const Icon(Icons.movie, color: Colors.white24),
                                        ),
                                ),
                                Container(
                                  height: 90,
                                  width: 140,
                                  color: Colors.black.withValues(alpha: 0.3),
                                ),
                                const Icon(Icons.play_circle_fill_rounded, color: AppTheme.primary, size: 36),
                                Positioned(
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  child: LinearProgressIndicator(
                                    value: percentage,
                                    color: AppTheme.primary,
                                    backgroundColor: Colors.white24,
                                    minHeight: 4,
                                  ),
                                ),
                              ],
                            ),

                            // Détails & Timestamps
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item['title']?.toString() ?? 'Titre',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 4),
                                    if (isSeries && item['episode'] != null)
                                      Text(
                                        'Saison ${item['season'] ?? 1} • Épisode ${item['episode']}',
                                        style: const TextStyle(
                                          color: AppTheme.primary,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    const SizedBox(height: 6),
                                    Row(
                                      children: [
                                        const Icon(Icons.schedule_rounded, color: AppTheme.textSecondary, size: 14),
                                        const SizedBox(width: 4),
                                        Text(
                                          '${_formatDuration(posMs)} / ${_formatDuration(durMs)} (${(percentage * 100).toInt()}%)',
                                          style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),

                            // Bouton supprimer l'élément
                            IconButton(
                              icon: const Icon(Icons.close_rounded, color: Colors.white38, size: 18),
                              onPressed: () async {
                                await _storage.removeWatchProgress(item['id'].toString());
                                _loadHistory();
                              },
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
