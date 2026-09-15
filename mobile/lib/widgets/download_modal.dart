import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/media_item.dart';
import '../models/user_model.dart';
import '../services/download_service.dart';

class DownloadModal {
  /// Affiche un modal de téléchargement intelligent qui s'adapte à l'abonnement :
  /// - FREE users : Téléchargement IN-APP automatique (pas de choix)
  /// - VIP users : Téléchargement EXTERNE automatique (dossier public)
  static void show({
    required BuildContext context,
    required MediaItem item,
    required UserModel? user, // Ajout du paramètre user
    EpisodeItem? episode,
    int? seasonNumber,
    String? streamUrl,
  }) {
    final bool isPremium = user?.subscription?.isPremium ?? false;
    final downloadService = DownloadService();

    // Pour les utilisateurs FREE, on démarre directement le téléchargement IN-APP
    if (!isPremium) {
      _showFreeUserDialog(
        context: context,
        item: item,
        episode: episode,
        seasonNumber: seasonNumber,
        streamUrl: streamUrl,
      );
      return;
    }

    // Pour les utilisateurs VIP, on affiche le modal avec options
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

              // En-tête VIP
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.amber.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.workspace_premium_rounded, color: Colors.amber, size: 24),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Text(
                              'Téléchargement VIP',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                            SizedBox(width: 6),
                            Icon(Icons.verified_rounded, color: Colors.amber, size: 16),
                          ],
                        ),
                        Text(
                          item.title,
                          style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              if (episode != null) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'S${seasonNumber ?? 1}:E${episode.episodeNumber} • ${episode.episode}',
                    style: const TextStyle(color: AppTheme.primary, fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                ),
              ],

              const SizedBox(height: 20),
              
              // Info Mode VIP
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.amber.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.amber.withValues(alpha: 0.2)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline_rounded, color: Colors.amber, size: 18),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        downloadService.getDownloadModeDescription(isPremium),
                        style: const TextStyle(color: Colors.white70, fontSize: 11, height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Bouton de téléchargement VIP (externe par défaut)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.amber,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: () {
                    Navigator.pop(ctx);
                    _startDownload(
                      context: context,
                      item: item,
                      episode: episode,
                      seasonNumber: seasonNumber,
                      streamUrl: streamUrl,
                      isPremium: isPremium,
                    );
                  },
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.download_for_offline_rounded, size: 20),
                      SizedBox(width: 8),
                      Text(
                        'Télécharger (Dossier Public)',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 10),

              // Option alternative : In-App (même pour VIP)
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white24),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: () {
                    Navigator.pop(ctx);
                    _startDownload(
                      context: context,
                      item: item,
                      episode: episode,
                      seasonNumber: seasonNumber,
                      streamUrl: streamUrl,
                      isPremium: isPremium,
                      forceInApp: true,
                    );
                  },
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.smartphone_rounded, size: 18),
                      SizedBox(width: 8),
                      Text(
                        'Télécharger (In-App)',
                        style: TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }

  /// Dialog pour les utilisateurs FREE
  static void _showFreeUserDialog({
    required BuildContext context,
    required MediaItem item,
    EpisodeItem? episode,
    int? seasonNumber,
    String? streamUrl,
  }) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(Icons.download_rounded, color: AppTheme.primary, size: 24),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'Téléchargement Gratuit',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              item.title,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14),
            ),
            if (episode != null) ...[
              const SizedBox(height: 4),
              Text(
                'S${seasonNumber ?? 1}:E${episode.episodeNumber} • ${episode.episode}',
                style: const TextStyle(color: AppTheme.primary, fontSize: 12),
              ),
            ],
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.info_outline_rounded, color: AppTheme.primary, size: 16),
                      SizedBox(width: 8),
                      Text(
                        'Mode Gratuit',
                        style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Le contenu sera téléchargé dans l\'app CHILLERS et visible uniquement ici (mode hors-ligne).',
                    style: TextStyle(color: Colors.white70, fontSize: 11, height: 1.4),
                  ),
                  const SizedBox(height: 12),
                  const Row(
                    children: [
                      Icon(Icons.workspace_premium_rounded, color: Colors.amber, size: 14),
                      SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'Passez VIP pour télécharger dans vos fichiers',
                          style: TextStyle(color: Colors.amber, fontSize: 10, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
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
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
            onPressed: () {
              Navigator.pop(ctx);
              _startDownload(
                context: context,
                item: item,
                episode: episode,
                seasonNumber: seasonNumber,
                streamUrl: streamUrl,
                isPremium: false,
              );
            },
            child: const Text('Télécharger', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  static void _startDownload({
    required BuildContext context,
    required MediaItem item,
    EpisodeItem? episode,
    int? seasonNumber,
    String? streamUrl,
    required bool isPremium,
    bool forceInApp = false,
  }) async {
    final messenger = ScaffoldMessenger.of(context);
    final downloadService = DownloadService();
    
    // Détermination automatique du mode
    final isExternal = forceInApp ? false : isPremium;
    
    await downloadService.startDownload(
      item: item,
      episode: episode,
      seasonNumber: seasonNumber ?? 1,
      streamUrl: streamUrl,
      quality: isExternal ? 'HD 1080p (Externe)' : 'HD 1080p (In-App)',
      isPremium: isPremium,
      isExternal: forceInApp ? false : null, // null = auto-détection
    );

    final title = episode != null
        ? '${item.title} (S${seasonNumber ?? 1}:E${episode.episodeNumber})'
        : item.title;

    final downloadMode = isExternal ? 'Dossier Public' : 'In-App';
    
    messenger.showSnackBar(
      SnackBar(
        backgroundColor: AppTheme.card,
        content: Row(
          children: [
            Icon(
              isExternal ? Icons.folder_rounded : Icons.smartphone_rounded,
              color: isExternal ? Colors.amber : AppTheme.primary,
              size: 20,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Téléchargement démarré ($downloadMode) : $title',
                style: const TextStyle(color: Colors.white, fontSize: 12),
                maxLines: 2,
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
