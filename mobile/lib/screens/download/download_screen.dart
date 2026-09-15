import 'dart:io';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';
import '../../models/user_model.dart';
import '../../services/download_service.dart';
import '../../services/storage_service.dart';
import '../../services/native_bridge.dart';
import '../watch/watch_screen.dart';
import '../../widgets/upgrade_modal.dart';

class DownloadScreen extends StatefulWidget {
  const DownloadScreen({super.key});

  @override
  State<DownloadScreen> createState() => _DownloadScreenState();
}

class _DownloadScreenState extends State<DownloadScreen> with SingleTickerProviderStateMixin {
  final DownloadService _downloadService = DownloadService();
  final StorageService _storage = StorageService();
  
  UserModel? _user;
  late TabController _tabController;
  int _freeSpace = -1;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
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
    _tabController.dispose();
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

  void _showInfoModal() {
    final isPremium = _user?.subscription?.isPremium ?? false;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
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
                Row(
                  children: [
                    Icon(
                      isPremium ? Icons.workspace_premium_rounded : Icons.info_outline_rounded,
                      color: isPremium ? Colors.amber : AppTheme.primary,
                      size: 28,
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Modes de Téléchargement',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                _buildInfoCard(
                  icon: Icons.smartphone_rounded,
                  title: 'Téléchargement In-App',
                  description: 'Fichiers sauvegardés dans CHILLERS uniquement. Lecture hors-ligne fluide et optimisée.',
                  features: ['Lecture dans l\'app', 'Optimisé pour le streaming', 'Sécurisé'],
                  color: AppTheme.primary,
                  badge: isPremium ? null : 'Mode Gratuit',
                ),
                const SizedBox(height: 12),
                _buildInfoCard(
                  icon: Icons.folder_rounded,
                  title: 'Téléchargement Externe',
                  description: 'Fichiers MP4 dans votre dossier Téléchargements. Accessible avec n\'importe quel lecteur.',
                  features: ['Dossier Téléchargements', 'Lecture avec VLC/MX Player', 'Transférable par USB'],
                  color: Colors.amber,
                  badge: isPremium ? 'Mode VIP' : 'Réservé VIP',
                ),
                if (!isPremium) ...[
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.amber.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.upgrade_rounded, color: Colors.amber, size: 20),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text(
                            'Passez VIP pour télécharger dans votre dossier public',
                            style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.amber,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: () {
                        Navigator.pop(ctx);
                        UpgradeModal.show(context);
                      },
                      child: const Text('Découvrir les offres VIP', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoCard({
    required IconData icon,
    required String title,
    required String description,
    required List<String> features,
    required Color color,
    String? badge,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
              if (badge != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    badge,
                    style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.bold),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            description,
            style: const TextStyle(color: Colors.white70, fontSize: 11, height: 1.4),
          ),
          const SizedBox(height: 8),
          ...features.map((f) => Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  children: [
                    Icon(Icons.check_circle_rounded, color: color, size: 14),
                    const SizedBox(width: 6),
                    Text(
                      f,
                      style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  void _confirmClearAll() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Effacer les téléchargements', style: TextStyle(color: Colors.white)),
        content: const Text(
          'Voulez-vous supprimer tous les fichiers téléchargés ?',
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
  }

  Future<void> _playOffline(DownloadTask task) async {
    final publicUri = task.publicUri;
    if (publicUri != null) {
      final opened = await NativeBridge.instance.openUri(publicUri);
      if (!opened && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: AppTheme.card,
            content: Text(
              'Aucune application trouvée. Le fichier est dans Téléchargements/CHILLERS.',
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
    final tasks = _downloadService.tasks;
    final inAppTasks = _downloadService.inAppDownloads;
    final externalTasks = _downloadService.externalDownloads;
    final isPremium = _user?.subscription?.isPremium ?? false;
    
    final totalSize = tasks
        .where((t) => t.localFilePath != null)
        .fold<int>(0, (sum, t) => sum + t.downloadedBytes);

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
          IconButton(
            icon: const Icon(Icons.info_outline_rounded, color: Colors.white70, size: 22),
            tooltip: 'Informations',
            onPressed: _showInfoModal,
          ),
          if (tasks.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_sweep_rounded, color: Colors.white70),
              tooltip: 'Tout effacer',
              onPressed: _confirmClearAll,
            ),
        ],
        bottom: tasks.isEmpty ? null : TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.primary,
          labelColor: AppTheme.primary,
          unselectedLabelColor: Colors.white60,
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          tabs: [
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.smartphone_rounded, size: 16),
                  const SizedBox(width: 6),
                  Text('In-App (${inAppTasks.length})'),
                ],
              ),
            ),
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.folder_rounded, size: 16),
                  const SizedBox(width: 6),
                  Text('Externe (${externalTasks.length})'),
                ],
              ),
            ),
          ],
        ),
      ),
      body: tasks.isEmpty
          ? _buildEmptyState(isPremium)
          : Column(
              children: [
                // Info Espace Stockage
                Container(
                  margin: const EdgeInsets.all(16),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppTheme.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        isPremium ? Icons.workspace_premium_rounded : Icons.sd_storage_rounded,
                        color: isPremium ? Colors.amber : AppTheme.primary,
                        size: 24,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  '${tasks.length} fichier${tasks.length > 1 ? 's' : ''}',
                                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                                if (isPremium) ...[
                                  const SizedBox(width: 6),
                                  const Icon(Icons.verified_rounded, color: Colors.amber, size: 14),
                                ],
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'In-App : ${_formatBytes(totalSize)} • Libre : ${_freeSpace > 0 ? _formatBytes(_freeSpace) : 'N/A'}',
                              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // Tabs Content
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildTasksList(inAppTasks, isInApp: true),
                      _buildTasksList(externalTasks, isInApp: false),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildEmptyState(bool isPremium) {
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
            Text(
              isPremium
                  ? 'Téléchargez en mode VIP : fichiers dans votre dossier public ou in-app !'
                  : 'Téléchargez vos contenus préférés pour les regarder hors-ligne !',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                color: AppTheme.textSecondary,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              ),
              icon: const Icon(Icons.info_outline_rounded, size: 18),
              label: const Text('En savoir plus'),
              onPressed: _showInfoModal,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTasksList(List<DownloadTask> tasks, {required bool isInApp}) {
    if (tasks.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                isInApp ? Icons.smartphone_rounded : Icons.folder_open_rounded,
                size: 48,
                color: Colors.white24,
              ),
              const SizedBox(height: 12),
              Text(
                isInApp ? 'Aucun téléchargement In-App' : 'Aucun téléchargement Externe',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Colors.white54,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                isInApp
                    ? 'Les fichiers In-App sont lisibles uniquement dans CHILLERS'
                    : 'Les fichiers Externes sont dans votre dossier Téléchargements',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 11,
                  color: AppTheme.textSecondary,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      itemCount: tasks.length,
      itemBuilder: (context, index) => _buildTaskItem(tasks[index]),
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
              // Poster
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

              // Info
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
                        'S${task.seasonNumber ?? 1}:E${task.episodeNumber}${task.episodeTitle != null ? ' - ${task.episodeTitle}' : ''}',
                        style: const TextStyle(color: AppTheme.primary, fontSize: 11, fontWeight: FontWeight.w600),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: 6,
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
                        Text(
                          _formatBytes(task.totalBytes),
                          style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                        ),
                        if (task.isExternal)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.amber.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text(
                              'EXTERNE',
                              style: TextStyle(color: Colors.amber, fontSize: 9, fontWeight: FontWeight.bold),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),

              // Actions
              if (isDone)
                IconButton(
                  icon: Icon(
                    task.publicUri != null ? Icons.open_in_new_rounded : Icons.play_circle_filled_rounded,
                    color: AppTheme.primary,
                    size: 36,
                  ),
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

          if (task.status == 'error') ...[
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.error_outline_rounded, color: Colors.redAccent, size: 14),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    task.errorMessage ?? 'Le téléchargement a échoué.',
                    style: const TextStyle(color: Colors.redAccent, fontSize: 11),
                  ),
                ),
              ],
            ),
          ] else if (!isDone) ...[
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
                      ? 'Téléchargement (${(task.progress * 100).toInt()}%)'
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
