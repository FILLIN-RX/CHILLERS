import 'dart:io';
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../models/media_item.dart';
import '../../models/user_model.dart';
import '../../services/download_service.dart';
import '../../services/storage_service.dart';
import '../../services/native_bridge.dart';
import '../../services/feedback_service.dart';
import '../../config/theme.dart';
import '../watch/watch_screen.dart';
import '../main_navigation.dart';
import '../../features/offline_transfer/ui/screens/transfer_receiver_screen.dart';
import '../../features/offline_transfer/ui/screens/transfer_sender_screen.dart';

class DownloadScreen extends StatefulWidget {
  const DownloadScreen({super.key});

  @override
  State<DownloadScreen> createState() => _DownloadScreenState();
}

class _DownloadScreenState extends State<DownloadScreen> with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;
  final DownloadService _downloadService = DownloadService();
  final StorageService _storage = StorageService();

  UserModel? _user;
  int _freeSpace = -1;
  bool _smartDownloads = true;

  @override
  void initState() {
    super.initState();
    _downloadService.addListener(_onServiceUpdate);
    _loadUser();
    _loadFreeSpace();
  }

  Future<void> _loadUser() async {
    final user = await _storage.getUser();
    if (mounted) setState(() => _user = user);
  }

  Future<void> _loadFreeSpace() async {
    final free = await NativeBridge.instance.getFreeSpace();
    if (mounted) setState(() => _freeSpace = free);
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
    if (mb < 1000) return '${mb.toStringAsFixed(0)} Mo';
    final gb = mb / 1024;
    return '${gb.toStringAsFixed(1)} Go';
  }

  void _confirmDeleteTask(DownloadTask task) {
    FeedbackService.hapticMedium();
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF18181C),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Text(
                  task.title,
                  style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const Divider(color: Colors.white12),
              ListTile(
                leading: const Icon(Icons.play_circle_outline, color: Colors.white),
                title: const Text('Lire la vidéo', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(ctx);
                  _playOffline(task);
                },
              ),
              if (task.localFilePath != null)
                ListTile(
                  leading: const Icon(Icons.share_outlined, color: Colors.white),
                  title: const Text('Partager hors-ligne (P2P)', style: TextStyle(color: Colors.white)),
                  onTap: () {
                    Navigator.pop(ctx);
                    final media = MediaItem(
                      id: task.mediaId,
                      title: task.title,
                      poster: task.poster,
                      type: task.type ?? 'movie',
                      streamUrl: task.localFilePath,
                      quality: task.quality,
                    );
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => TransferSenderScreen(media: media)),
                    );
                  },
                ),
              ListTile(
                leading: const Icon(Icons.delete_outline, color: AppTheme.primary),
                title: const Text('Supprimer le téléchargement', style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold)),
                onTap: () {
                  Navigator.pop(ctx);
                  _downloadService.removeDownload(task.id);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _confirmClearAll() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text('Supprimer tous les téléchargements ?', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: const Text(
          'Tous les fichiers téléchargés seront définitivement supprimés de votre appareil.',
          style: TextStyle(color: Colors.white70),
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
            onPressed: () {
              _downloadService.clearAll();
              Navigator.pop(ctx);
            },
            child: const Text('Supprimer tout'),
          ),
        ],
      ),
    );
  }

  Future<void> _playOffline(DownloadTask task) async {
    FeedbackService.hapticMedium();
    final publicUri = task.publicUri;
    if (publicUri != null) {
      final opened = await NativeBridge.instance.openUri(publicUri);
      if (!opened && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF262626),
            content: Text(
              'Fichier disponible dans Téléchargements/CHILLERS.',
              style: TextStyle(color: Colors.white, fontSize: 12),
            ),
          ),
        );
      }
      return;
    }

    String? localUrl;
    if (task.localFilePath != null) {
      final f = File(task.localFilePath!);
      if (f.existsSync()) localUrl = task.localFilePath!;
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

    if (!mounted) return;
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
    super.build(context);
    final tasks = _downloadService.tasks;
    final totalBytes = tasks.fold<int>(0, (sum, t) => sum + t.downloadedBytes);

    return Scaffold(
      backgroundColor: const Color(0xFF000000),
      appBar: AppBar(
        backgroundColor: const Color(0xFF000000),
        elevation: 0,
        title: const Text(
          'Téléchargements',
          style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900),
        ),
        actions: [
          IconButton(
            icon: const FaIcon(FontAwesomeIcons.wifi, color: Colors.white70, size: 18),
            tooltip: 'Réception P2P',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const TransferReceiverScreen()),
              );
            },
          ),
          if (tasks.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_outline, color: Colors.white70),
              tooltip: 'Tout effacer',
              onPressed: _confirmClearAll,
            ),
        ],
      ),
      body: tasks.isEmpty
          ? _buildNetflixEmptyState()
          : _buildNetflixDownloadsList(tasks, totalBytes),
    );
  }

  // ── 1. ÉTAT VIDE PUR STYLE NETFLIX ──
  Widget _buildNetflixEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Icône circulaire Netflix
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: const Color(0xFF18181C),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white10, width: 1),
              ),
              child: const Center(
                child: Icon(
                  Icons.file_download_outlined,
                  size: 54,
                  color: Colors.white54,
                ),
              ),
            ),
            const SizedBox(height: 24),

            const Text(
              'Les films et séries que vous téléchargez s\'affichent ici.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
                height: 1.3,
              ),
            ),
            const SizedBox(height: 10),

            const Text(
              'Téléchargez vos programmes préférés pour les regarder hors connexion lors de vos déplacements.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white60,
                fontSize: 13,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 28),

            // Bouton Blanc Netflix
            SizedBox(
              width: double.infinity,
              height: 44,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: Colors.black,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
                onPressed: () {
                  MainNavigation.switchTab(context, 0); // Basculer sur Accueil
                },
                child: const Text(
                  'Trouver des vidéos à télécharger',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                ),
              ),
            ),

            const SizedBox(height: 14),

            TextButton.icon(
              style: TextButton.styleFrom(foregroundColor: Colors.white70),
              icon: const FaIcon(FontAwesomeIcons.wifi, size: 14),
              label: const Text('Recevoir un fichier en P2P sans Internet'),
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const TransferReceiverScreen()),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  // ── 2. LISTE DES TÉLÉCHARGEMENTS PUR STYLE NETFLIX ──
  Widget _buildNetflixDownloadsList(List<DownloadTask> tasks, int totalBytes) {
    // Calcul de l'espace de stockage
    final totalUsedMb = totalBytes / (1024 * 1024);
    final freeSpaceMb = _freeSpace > 0 ? _freeSpace / (1024 * 1024) : 10000.0;
    final progress = (totalUsedMb / (totalUsedMb + freeSpaceMb)).clamp(0.02, 1.0);

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      children: [
        // Netflix Smart Downloads Bar
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                const Icon(Icons.settings_outlined, color: Colors.white70, size: 18),
                const SizedBox(width: 8),
                const Text(
                  'Téléchargements automatiques',
                  style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            Switch(
              value: _smartDownloads,
              activeColor: AppTheme.primary,
              onChanged: (val) => setState(() => _smartDownloads = val),
            ),
          ],
        ),

        const SizedBox(height: 6),

        // Storage Progress Bar
        ClipRRect(
          borderRadius: BorderRadius.circular(2),
          child: LinearProgressIndicator(
            value: progress,
            backgroundColor: Colors.white12,
            valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.primary),
            minHeight: 4,
          ),
        ),
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'CHILLERS : ${_formatBytes(totalBytes)}',
              style: const TextStyle(color: Colors.white54, fontSize: 11),
            ),
            Text(
              'Espace libre : ${_freeSpace > 0 ? _formatBytes(_freeSpace) : 'Disponible'}',
              style: const TextStyle(color: Colors.white54, fontSize: 11),
            ),
          ],
        ),

        const SizedBox(height: 16),
        const Divider(color: Colors.white10, height: 1),
        const SizedBox(height: 12),

        // Liste des cartes de téléchargement
        ...tasks.map((task) => _buildNetflixDownloadTile(task)),
      ],
    );
  }

  Widget _buildNetflixDownloadTile(DownloadTask task) {
    final isDone = task.status == 'completed';
    final isDownloading = task.status == 'downloading';
    final isPaused = task.status == 'paused';
    final progressVal = task.progress;

    return InkWell(
      onTap: () {
        FeedbackService.hapticMedium();
        if (isDone) {
          _playOffline(task);
        } else if (isDownloading) {
          _downloadService.pauseDownload(task.id);
        } else if (isPaused) {
          _downloadService.resumeDownload(task.id);
        }
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10.0),
        child: Row(
          children: [
            // Vignette Poster 16:9 avec icône play
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: Stack(
                children: [
                  Container(
                    width: 112,
                    height: 64,
                    color: const Color(0xFF1C1C1E),
                    child: task.poster != null && task.poster!.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: task.poster!,
                            fit: BoxFit.cover,
                            errorWidget: (_, __, ___) => const Center(
                              child: FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 20),
                            ),
                          )
                        : const Center(
                            child: FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 20),
                          ),
                  ),
                  if (isDone)
                    Positioned.fill(
                      child: Center(
                        child: Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.6),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 18),
                        ),
                      ),
                    ),
                  if (isDownloading)
                    Positioned(
                      bottom: 0,
                      left: 0,
                      right: 0,
                      child: LinearProgressIndicator(
                        value: progressVal,
                        backgroundColor: Colors.black45,
                        valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.primary),
                        minHeight: 3,
                      ),
                    ),
                ],
              ),
            ),

            const SizedBox(width: 14),

            // Métadonnées
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    task.title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13.5,
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  if (task.episodeNumber != null) ...[
                    Text(
                      'S${task.seasonNumber ?? 1}:E${task.episodeNumber}${task.episodeTitle != null ? ' - ${task.episodeTitle}' : ''}',
                      style: const TextStyle(color: Colors.white70, fontSize: 11),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                  ],
                  Row(
                    children: [
                      Text(
                        isDone
                            ? _formatBytes(task.totalBytes > 0 ? task.totalBytes : task.downloadedBytes)
                            : (isDownloading ? '${(progressVal * 100).toInt()}% téléchargé' : 'En pause'),
                        style: TextStyle(
                          color: isDownloading ? AppTheme.primary : Colors.white38,
                          fontSize: 11,
                          fontWeight: isDownloading ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                      if (task.quality != null) ...[
                        const SizedBox(width: 6),
                        Text('• ${task.quality}', style: const TextStyle(color: Colors.white38, fontSize: 11)),
                      ],
                    ],
                  ),
                ],
              ),
            ),

            // Bouton d'options 3 points
            IconButton(
              icon: const Icon(Icons.more_vert, color: Colors.white54, size: 20),
              onPressed: () => _confirmDeleteTask(task),
            ),
          ],
        ),
      ),
    );
  }
}
