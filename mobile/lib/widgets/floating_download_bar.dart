import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import '../config/theme.dart';
import '../screens/main_navigation.dart';
import '../services/download_service.dart';

class FloatingDownloadBar extends StatelessWidget {
  const FloatingDownloadBar({super.key});

  String _formatBytes(int bytes) {
    if (bytes <= 0) return '0 Mo';
    final mb = bytes / (1024 * 1024);
    if (mb < 1000) return '${mb.toStringAsFixed(0)} Mo';
    final gb = mb / 1024;
    return '${gb.toStringAsFixed(1)} Go';
  }

  void _showQuickSheet(BuildContext context, DownloadService service, DownloadTask task) {
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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
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
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Center(
                      child: FaIcon(FontAwesomeIcons.download, color: AppTheme.primary, size: 20),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          task.title,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          task.episodeNumber != null
                              ? 'S${task.seasonNumber ?? 1}:E${task.episodeNumber} • ${(task.progress * 100).toInt()}% téléchargé'
                              : '${(task.progress * 100).toInt()}% téléchargé • ${_formatBytes(task.downloadedBytes)} / ${_formatBytes(task.totalBytes)}',
                          style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                  value: task.progress,
                  backgroundColor: Colors.white12,
                  color: task.status == 'downloading' ? AppTheme.primary : Colors.amber,
                  minHeight: 6,
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: task.status == 'downloading'
                            ? Colors.white.withValues(alpha: 0.1)
                            : AppTheme.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      onPressed: () {
                        if (task.status == 'downloading') {
                          service.pauseDownload(task.id);
                        } else {
                          service.resumeDownload(task.id);
                        }
                        Navigator.pop(ctx);
                      },
                      icon: FaIcon(
                        task.status == 'downloading'
                            ? FontAwesomeIcons.pause
                            : FontAwesomeIcons.play,
                        size: 16,
                      ),
                      label: Text(
                        task.status == 'downloading' ? 'Mettre en pause' : 'Reprendre',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      onPressed: () {
                        Navigator.pop(ctx);
                        MainNavigation.switchTab(context, 3);
                      },
                      icon: const FaIcon(FontAwesomeIcons.folderOpen, size: 16),
                      label: const Text(
                        'Voir la liste',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final downloadService = DownloadService();

    return ListenableBuilder(
      listenable: downloadService,
      builder: (context, _) {
        final activeTasks = downloadService.inProgressTasks;
        if (activeTasks.isEmpty) return const SizedBox.shrink();

        final currentTask = activeTasks.first;
        final isDownloading = currentTask.status == 'downloading';
        final percent = (currentTask.progress * 100).toInt();

        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () => _showQuickSheet(context, downloadService, currentTask),
              borderRadius: BorderRadius.circular(20),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFF18181B).withValues(alpha: 0.95),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isDownloading
                        ? AppTheme.primary.withValues(alpha: 0.4)
                        : Colors.white.withValues(alpha: 0.1),
                    width: 1.2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: isDownloading
                          ? AppTheme.primary.withValues(alpha: 0.25)
                          : Colors.black45,
                      blurRadius: 16,
                      spreadRadius: 1,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    // Circular Progress
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        SizedBox(
                          width: 32,
                          height: 32,
                          child: CircularProgressIndicator(
                            value: currentTask.progress > 0 ? currentTask.progress : null,
                            strokeWidth: 3,
                            backgroundColor: Colors.white12,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              isDownloading ? AppTheme.primary : Colors.amber,
                            ),
                          ),
                        ),
                        FaIcon(
                          isDownloading
                              ? FontAwesomeIcons.arrowDown
                              : FontAwesomeIcons.pause,
                          color: Colors.white,
                          size: 12,
                        ),
                      ],
                    ),
                    const SizedBox(width: 12),

                    // Title & Progress Text
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            currentTask.title,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              Text(
                                isDownloading ? 'Téléchargement $percent%' : 'En pause ($percent%)',
                                style: TextStyle(
                                  color: isDownloading ? AppTheme.primary : Colors.amber,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              if (activeTasks.length > 1) ...[
                                const SizedBox(width: 6),
                                Text(
                                  '(+${activeTasks.length - 1})',
                                  style: const TextStyle(color: Colors.white54, fontSize: 10),
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),

                    // Quick Toggle Button
                    IconButton(
                      icon: FaIcon(
                        isDownloading
                            ? FontAwesomeIcons.circlePause
                            : FontAwesomeIcons.circlePlay,
                        color: isDownloading ? Colors.amber : AppTheme.primary,
                        size: 22,
                      ),
                      onPressed: () {
                        if (isDownloading) {
                          downloadService.pauseDownload(currentTask.id);
                        } else {
                          downloadService.resumeDownload(currentTask.id);
                        }
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
