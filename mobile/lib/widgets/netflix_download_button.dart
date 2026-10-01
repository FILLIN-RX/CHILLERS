import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import '../config/theme.dart';
import '../services/download_service.dart';

enum NetflixDownloadButtonVariant {
  icon,
  button,
}

class NetflixDownloadButton extends StatelessWidget {
  final String mediaId;
  final String? seasonNumber;
  final String? episodeNumber;
  final String title;
  final VoidCallback onPressed;
  final NetflixDownloadButtonVariant variant;

  const NetflixDownloadButton({
    super.key,
    required this.mediaId,
    this.seasonNumber,
    this.episodeNumber,
    this.title = 'Télécharger',
    required this.onPressed,
    this.variant = NetflixDownloadButtonVariant.button,
  });

  @override
  Widget build(BuildContext context) {
    final downloadService = DownloadService();

    return ListenableBuilder(
      listenable: downloadService,
      builder: (context, _) {
        // Trouver la tâche correspondant à ce media ou épisode
        final task = downloadService.tasks.cast<DownloadTask?>().firstWhere(
              (t) {
                if (t == null) return false;
                if (t.mediaId != mediaId) return false;
                if (episodeNumber != null && t.episodeNumber != episodeNumber) return false;
                if (seasonNumber != null && t.seasonNumber != seasonNumber) return false;
                return true;
              },
              orElse: () => null,
            );

        final isDownloading = task != null && (task.status == 'downloading' || task.status == 'pending');
        final isCompleted = task != null && task.status == 'completed';
        final isPaused = task != null && task.status == 'paused';
        final progress = task?.progress ?? 0.0;
        final progressPct = (progress * 100).toInt();

        // 1. VARIANT ICON (pour les lignes d'épisodes)
        if (variant == NetflixDownloadButtonVariant.icon) {
          if (isDownloading) {
            return InkWell(
              onTap: () {
                // Pause ou options
                _showDownloadActionSheet(context, task, downloadService);
              },
              borderRadius: BorderRadius.circular(20),
              child: Padding(
                padding: const EdgeInsets.all(6),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox(
                      width: 26,
                      height: 26,
                      child: CircularProgressIndicator(
                        value: progress > 0 ? progress : null,
                        strokeWidth: 2.8,
                        color: AppTheme.primary,
                        backgroundColor: Colors.white24,
                      ),
                    ),
                    const FaIcon(
                      FontAwesomeIcons.stop,
                      color: Colors.white,
                      size: 9,
                    ),
                  ],
                ),
              ),
            );
          }

          if (isCompleted) {
            return InkWell(
              onTap: () => _showDownloadActionSheet(context, task, downloadService),
              borderRadius: BorderRadius.circular(20),
              child: const Padding(
                padding: EdgeInsets.all(6),
                child: FaIcon(
                  FontAwesomeIcons.circleCheck,
                  color: Color(0xFF34D399),
                  size: 20,
                ),
              ),
            );
          }

          if (isPaused) {
            return InkWell(
              onTap: () => downloadService.resumeDownload(task.id),
              borderRadius: BorderRadius.circular(20),
              child: const Padding(
                padding: EdgeInsets.all(6),
                child: FaIcon(
                  FontAwesomeIcons.circlePlay,
                  color: Colors.amber,
                  size: 20,
                ),
              ),
            );
          }

          return IconButton(
            icon: const FaIcon(
              FontAwesomeIcons.download,
              color: Colors.white70,
              size: 17,
            ),
            tooltip: 'Télécharger',
            onPressed: onPressed,
          );
        }

        // 2. VARIANT BUTTON (Grand bouton principal avec texte)
        if (isDownloading) {
          return ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1E1E28),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: const BorderSide(color: AppTheme.primary, width: 1.2),
              ),
            ),
            onPressed: () => _showDownloadActionSheet(context, task, downloadService),
            icon: SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                value: progress > 0 ? progress : null,
                strokeWidth: 2.5,
                color: AppTheme.primary,
                backgroundColor: Colors.white24,
              ),
            ),
            label: Text(
              progressPct > 0 ? 'Téléchargement $progressPct%' : 'Téléchargement...',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
          );
        }

        if (isCompleted) {
          return ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF064E3B),
              foregroundColor: const Color(0xFF34D399),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: BorderSide(color: const Color(0xFF34D399).withValues(alpha: 0.4)),
              ),
            ),
            onPressed: () => _showDownloadActionSheet(context, task, downloadService),
            icon: const FaIcon(FontAwesomeIcons.circleCheck, size: 16),
            label: const Text(
              'Téléchargé',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
          );
        }

        return IconButton(
          style: IconButton.styleFrom(
            backgroundColor: const Color(0xFF1C1C1E),
            padding: const EdgeInsets.all(14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
          ),
          icon: const FaIcon(FontAwesomeIcons.download, color: Colors.white, size: 16),
          tooltip: 'Télécharger',
          onPressed: onPressed,
        );
      },
    );
  }

  void _showDownloadActionSheet(BuildContext context, DownloadTask task, DownloadService service) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF181822),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                task.title,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              if (task.status == 'downloading') ...[
                ListTile(
                  leading: const FaIcon(FontAwesomeIcons.pause, color: Colors.amber, size: 18),
                  title: const Text('Mettre en pause', style: TextStyle(color: Colors.white)),
                  onTap: () {
                    Navigator.pop(ctx);
                    service.pauseDownload(task.id);
                  },
                ),
                ListTile(
                  leading: const FaIcon(FontAwesomeIcons.xmark, color: Colors.redAccent, size: 18),
                  title: const Text('Annuler le téléchargement', style: TextStyle(color: Colors.redAccent)),
                  onTap: () {
                    Navigator.pop(ctx);
                    service.removeDownload(task.id);
                  },
                ),
              ] else if (task.status == 'paused') ...[
                ListTile(
                  leading: const FaIcon(FontAwesomeIcons.play, color: AppTheme.primary, size: 18),
                  title: const Text('Reprendre le téléchargement', style: TextStyle(color: Colors.white)),
                  onTap: () {
                    Navigator.pop(ctx);
                    service.resumeDownload(task.id);
                  },
                ),
              ] else if (task.status == 'completed') ...[
                ListTile(
                  leading: const FaIcon(FontAwesomeIcons.trash, color: Colors.redAccent, size: 18),
                  title: const Text('Supprimer le téléchargement', style: TextStyle(color: Colors.redAccent)),
                  onTap: () {
                    Navigator.pop(ctx);
                    service.removeDownload(task.id);
                  },
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
