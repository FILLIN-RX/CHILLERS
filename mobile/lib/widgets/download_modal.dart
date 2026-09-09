import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/media_item.dart';
import '../services/download_service.dart';

class DownloadModal {
  static void show({
    required BuildContext context,
    required MediaItem item,
    EpisodeItem? episode,
    int? seasonNumber,
    String? streamUrl,
  }) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
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
              // Poignée
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

              // En-tête
              Row(
                children: [
                  const Icon(Icons.download_for_offline_rounded, color: AppTheme.primary, size: 28),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.title,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (episode != null)
                          Text(
                            'Saison ${seasonNumber ?? 1} • Épisode ${episode.episodeNumber} (${episode.episode})',
                            style: const TextStyle(color: AppTheme.primary, fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 20),
              const Text(
                'Choisissez l\'emplacement du téléchargement :',
                style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 12),

              // Option 1 : In-App Hors-Ligne (Recommandé)
              _buildLocationTile(
                ctx: ctx,
                icon: Icons.offline_pin_rounded,
                title: 'Visionnage Hors-Ligne In-App',
                subtitle: 'Enregistré dans CHILLERS pour une lecture ultra-fluide sans connexion.',
                badge: 'Recommandé',
                badgeColor: AppTheme.primary,
                onTap: () {
                  Navigator.pop(ctx);
                  _startDownload(
                    context: context,
                    item: item,
                    episode: episode,
                    seasonNumber: seasonNumber,
                    streamUrl: streamUrl,
                    isExternal: false,
                  );
                },
              ),

              const SizedBox(height: 10),

              // Option 2 : Export Stockage Externe (Dossier Téléchargements)
              _buildLocationTile(
                ctx: ctx,
                icon: Icons.folder_open_rounded,
                title: 'Exporter dans l\'Appareil',
                subtitle: 'Fichier vidéo accessible dans votre dossier Téléchargements (pour VLC, clé USB, etc.).',
                badge: 'Fichier MP4',
                badgeColor: Colors.amber,
                onTap: () {
                  Navigator.pop(ctx);
                  _startDownload(
                    context: context,
                    item: item,
                    episode: episode,
                    seasonNumber: seasonNumber,
                    streamUrl: streamUrl,
                    isExternal: true,
                  );
                },
              ),

              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  static Widget _buildLocationTile({
    required BuildContext ctx,
    required IconData icon,
    required String title,
    required String subtitle,
    required String badge,
    required Color badgeColor,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.all(14.0),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: badgeColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, color: badgeColor, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              title,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: badgeColor.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              badge,
                              style: TextStyle(color: badgeColor, fontSize: 9, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11, height: 1.3),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white38, size: 14),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static void _startDownload({
    required BuildContext context,
    required MediaItem item,
    EpisodeItem? episode,
    int? seasonNumber,
    String? streamUrl,
    required bool isExternal,
  }) async {
    final messenger = ScaffoldMessenger.of(context);
    final downloadService = DownloadService();
    await downloadService.startDownload(
      item: item,
      episode: episode,
      seasonNumber: seasonNumber ?? 1,
      streamUrl: streamUrl,
      quality: isExternal ? 'Export MP4 (Stockage)' : 'HD 1080p (In-App)',
    );

    final title = episode != null
        ? '${item.title} (S${seasonNumber ?? 1}:E${episode.episodeNumber})'
        : item.title;

    messenger.showSnackBar(
      SnackBar(
        backgroundColor: AppTheme.card,
        content: Row(
          children: [
            Icon(
              isExternal ? Icons.save_alt_rounded : Icons.download_done_rounded,
              color: isExternal ? Colors.amber : AppTheme.primary,
              size: 20,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                isExternal
                    ? 'Téléchargement vers Stockage Appareil : $title'
                    : 'Téléchargement In-App démarré : $title',
                style: const TextStyle(color: Colors.white, fontSize: 12),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        duration: const Duration(seconds: 4),
      ),
    );
  }
}
