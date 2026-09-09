import 'dart:io';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';
import '../../services/download_service.dart';
import '../watch/watch_screen.dart';

class DownloadScreen extends StatefulWidget {
  const DownloadScreen({super.key});

  @override
  State<DownloadScreen> createState() => _DownloadScreenState();
}

class _DownloadScreenState extends State<DownloadScreen> {
  final DownloadService _downloadService = DownloadService();

  @override
  void initState() {
    super.initState();
    _downloadService.addListener(_onServiceUpdate);
  }

  @override
  void dispose() {
    _downloadService.removeListener(_onServiceUpdate);
    super.dispose();
  }

  void _onServiceUpdate() {
    if (mounted) setState(() {});
  }

  String _formatBytes(int bytes) {
    if (bytes <= 0) return '0 Mo';
    final mb = bytes / (1024 * 1024);
    if (mb < 1000) {
      return '${mb.toStringAsFixed(0)} Mo';
    }
    final gb = mb / 1024;
    return '${gb.toStringAsFixed(1)} Go';
  }

  void _playOffline(DownloadTask task) {
    String? localUrl;
    if (task.localFilePath != null) {
      final f = File(task.localFilePath!);
      if (f.existsSync()) {
        localUrl = task.localFilePath!;
      }
    }
    localUrl ??= task.streamUrl;

    final mediaItem = MediaItem(
      id: task.mediaId,
      title: task.title,
      poster: task.poster,
      type: task.type ?? 'movie',
      streamUrl: localUrl,
      quality: task.quality,
    );

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => WatchScreen(
          item: mediaItem,
          initialEpisode: task.episodeNumber != null ? int.tryParse(task.episodeNumber!) : null,
          initialSeason: task.seasonNumber != null ? int.tryParse(task.seasonNumber!) : null,
          initialVideoUrl: localUrl,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tasks = _downloadService.tasks;
    final totalSize = tasks.fold<int>(0, (sum, t) => sum + t.downloadedBytes);

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: const Color(0xFF0C0C0E),
        elevation: 0,
        title: const Text(
          'Téléchargements',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 18),
        ),
        actions: [
          if (tasks.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_sweep_rounded, color: Colors.white70),
              tooltip: 'Tout effacer',
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    backgroundColor: AppTheme.card,
                    title: const Text('Effacer les téléchargements', style: TextStyle(color: Colors.white)),
                    content: const Text(
                      'Voulez-vous supprimer tous les fichiers téléchargés de cet appareil ?',
                      style: TextStyle(color: Colors.white70),
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Annuler', style: TextStyle(color: Colors.white60)),
                      ),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
                        onPressed: () {
                          _downloadService.clearAll();
                          Navigator.pop(ctx);
                        },
                        child: const Text('Supprimer tout'),
                      ),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
      body: tasks.isEmpty
          ? _buildEmptyState()
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Info Espace Stockage
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppTheme.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.sd_storage_rounded, color: AppTheme.primary, size: 24),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${tasks.length} fichier${tasks.length > 1 ? 's' : ''} enregistré${tasks.length > 1 ? 's' : ''}',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Espace utilisé : ${_formatBytes(totalSize)} (Lecture hors-ligne activée)',
                              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                ...tasks.map((task) => _buildTaskItem(task)),
              ],
            ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppTheme.card,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
              ),
              child: const Icon(
                Icons.download_for_offline_rounded,
                size: 64,
                color: AppTheme.primary,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Aucun téléchargement',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Téléchargez vos films, séries et animes préférés pour les regarder n\'importe où, même sans connexion Internet !',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: AppTheme.textSecondary,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTaskItem(DownloadTask task) {
    final isDone = task.status == 'completed';
    final isDownloading = task.status == 'downloading';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDone ? Colors.white.withValues(alpha: 0.08) : AppTheme.primary.withValues(alpha: 0.3),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              // Poster / Thumbnail
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: task.poster != null && task.poster!.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: task.poster!,
                        width: 60,
                        height: 85,
                        fit: BoxFit.cover,
                        errorWidget: (context, url, error) => Container(
                          width: 60,
                          height: 85,
                          color: Colors.white12,
                          child: const Icon(Icons.movie, color: Colors.white38),
                        ),
                      )
                    : Container(
                        width: 60,
                        height: 85,
                        color: Colors.white12,
                        child: const Icon(Icons.movie, color: Colors.white38),
                      ),
              ),

              const SizedBox(width: 12),

              // Titre et méta
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      task.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (task.episodeNumber != null) ...[
                      const SizedBox(height: 3),
                      Text(
                        'Saison ${task.seasonNumber ?? 1} • Épisode ${task.episodeNumber}${task.episodeTitle != null ? ' - ${task.episodeTitle}' : ''}',
                        style: const TextStyle(color: AppTheme.primary, fontSize: 11, fontWeight: FontWeight.w600),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            task.quality ?? 'HD',
                            style: const TextStyle(color: Colors.white70, fontSize: 9, fontWeight: FontWeight.bold),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          _formatBytes(task.totalBytes),
                          style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Boutons d'action
              if (isDone)
                IconButton(
                  icon: const Icon(Icons.play_circle_filled_rounded, color: AppTheme.primary, size: 36),
                  onPressed: () => _playOffline(task),
                )
              else if (isDownloading)
                IconButton(
                  icon: const Icon(Icons.pause_circle_filled_rounded, color: Colors.amber, size: 32),
                  onPressed: () => _downloadService.pauseDownload(task.id),
                )
              else
                IconButton(
                  icon: const Icon(Icons.play_circle_outline_rounded, color: Colors.white70, size: 32),
                  onPressed: () => _downloadService.resumeDownload(task.id),
                ),

              IconButton(
                icon: const Icon(Icons.close_rounded, color: Colors.white38, size: 20),
                onPressed: () => _downloadService.removeDownload(task.id),
              ),
            ],
          ),

          // Barre de progression si en cours
          if (!isDone) ...[
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: task.progress,
                backgroundColor: Colors.white12,
                color: isDownloading ? AppTheme.primary : Colors.amber,
                minHeight: 4,
              ),
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  isDownloading
                      ? 'Téléchargement en cours (${(task.progress * 100).toInt()}%)'
                      : 'En pause',
                  style: TextStyle(
                    color: isDownloading ? AppTheme.primary : Colors.amber,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  '${_formatBytes(task.downloadedBytes)} / ${_formatBytes(task.totalBytes)}',
                  style: const TextStyle(color: AppTheme.textSecondary, fontSize: 10),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
