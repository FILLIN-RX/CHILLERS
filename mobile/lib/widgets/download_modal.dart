import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../config/theme.dart';
import '../models/media_item.dart';
import '../models/user_model.dart';
import '../services/download_service.dart';
import 'upgrade_modal.dart';

class DownloadModal {
  static void show({
    required BuildContext context,
    required MediaItem item,
    required UserModel? user,
    EpisodeItem? episode,
    int? seasonNumber,
    String? streamUrl,
  }) {
    final bool isPremium = user?.subscription?.isPremium ?? false;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => _DownloadModalSheet(
        item: item,
        user: user,
        episode: episode,
        seasonNumber: seasonNumber,
        streamUrl: streamUrl,
        isPremium: isPremium,
      ),
    );
  }
}

class _DownloadModalSheet extends StatefulWidget {
  final MediaItem item;
  final UserModel? user;
  final EpisodeItem? episode;
  final int? seasonNumber;
  final String? streamUrl;
  final bool isPremium;

  const _DownloadModalSheet({
    required this.item,
    required this.user,
    this.episode,
    this.seasonNumber,
    this.streamUrl,
    required this.isPremium,
  });

  @override
  State<_DownloadModalSheet> createState() => _DownloadModalSheetState();
}

class _DownloadModalSheetState extends State<_DownloadModalSheet> {
  late bool _downloadExternal;

  @override
  void initState() {
    super.initState();
    // VIP default to External, Free default to In-App
    _downloadExternal = widget.isPremium;
  }

  void _executeDownload() async {
    final messenger = ScaffoldMessenger.of(context);
    final downloadService = DownloadService();

    Navigator.pop(context);

    await downloadService.startDownload(
      item: widget.item,
      episode: widget.episode,
      seasonNumber: widget.seasonNumber ?? 1,
      streamUrl: widget.streamUrl,
      quality: _downloadExternal ? 'HD 1080p (Externe)' : 'HD 1080p (In-App)',
      isPremium: widget.isPremium,
      isExternal: _downloadExternal,
    );

    final title = widget.episode != null
        ? '${widget.item.title} (S${widget.seasonNumber ?? 1}:E${widget.episode!.episodeNumber})'
        : widget.item.title;

    final modeLabel = _downloadExternal ? 'Dossier Public' : 'In-App';

    messenger.showSnackBar(
      SnackBar(
        backgroundColor: const Color(0xFF1E1E22),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        content: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: (_downloadExternal ? Colors.amber : AppTheme.primary).withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: FaIcon(
                  _downloadExternal ? FontAwesomeIcons.folder : FontAwesomeIcons.mobile,
                  color: _downloadExternal ? Colors.amber : AppTheme.primary,
                  size: 16,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Téléchargement lancé',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  Text(
                    '$title • $modeLabel',
                    style: const TextStyle(color: Colors.white70, fontSize: 11),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
        duration: const Duration(seconds: 4),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.episode != null
        ? '${widget.item.title} (S${widget.seasonNumber ?? 1}:E${widget.episode!.episodeNumber})'
        : widget.item.title;

    final subtitle = widget.episode != null && widget.episode!.episode.isNotEmpty
        ? widget.episode!.episode
        : (widget.item.genres != null && widget.item.genres!.isNotEmpty
            ? widget.item.genres!.join(' • ')
            : 'Film HD');

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        color: Color(0xFF141416),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Poignée supérieure
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

            // En-tête Médias (Poster + Titre + Badges)
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: widget.item.poster != null && widget.item.poster!.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: widget.item.poster!,
                          width: 54,
                          height: 76,
                          fit: BoxFit.cover,
                          errorWidget: (context, url, error) => Container(
                            width: 54,
                            height: 76,
                            color: Colors.white10,
                            child: const FaIcon(FontAwesomeIcons.film, color: Colors.white38),
                          ),
                        )
                      : Container(
                          width: 54,
                          height: 76,
                          color: Colors.white10,
                          child: const FaIcon(FontAwesomeIcons.film, color: Colors.white38),
                        ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 16,
                          height: 1.2,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: const TextStyle(color: Colors.white60, fontSize: 12),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: AppTheme.primary.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'FULL HD 1080P',
                              style: TextStyle(
                                color: AppTheme.primary,
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'MP4 H.264',
                              style: TextStyle(
                                color: Colors.white70,
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 20),
            const Text(
              'Emplacement de sauvegarde',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 10),

            // Option 1 : In-App Hors-Ligne (Gratuit & VIP)
            GestureDetector(
              onTap: () {
                setState(() => _downloadExternal = false);
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: !_downloadExternal
                      ? AppTheme.primary.withValues(alpha: 0.12)
                      : Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: !_downloadExternal
                        ? AppTheme.primary
                        : Colors.transparent,
                    width: 1.5,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: !_downloadExternal
                            ? AppTheme.primary
                            : Colors.white.withValues(alpha: 0.08),
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: FaIcon(
                          FontAwesomeIcons.mobile,
                          color: Colors.white,
                          size: 18,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Text(
                                'Téléchargement In-App',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.green.withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Text(
                                  'Recommandé',
                                  style: TextStyle(color: Colors.greenAccent, fontSize: 9, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            'Lecture hors-ligne optimisée dans CHILLERS sans coupures.',
                            style: TextStyle(color: Colors.white60, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: !_downloadExternal ? AppTheme.primary : Colors.white30,
                          width: 2,
                        ),
                      ),
                      child: !_downloadExternal
                          ? Center(
                              child: Container(
                                width: 10,
                                height: 10,
                                decoration: const BoxDecoration(
                                  color: AppTheme.primary,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            )
                          : null,
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 10),

            // Option 2 : Dossier Public (VIP)
            GestureDetector(
              onTap: () {
                if (widget.isPremium) {
                  setState(() => _downloadExternal = true);
                } else {
                  UpgradeModal.show(context);
                }
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: _downloadExternal
                      ? Colors.amber.withValues(alpha: 0.12)
                      : Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: _downloadExternal
                        ? Colors.amber
                        : Colors.transparent,
                    width: 1.5,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: _downloadExternal
                            ? Colors.amber
                            : Colors.white.withValues(alpha: 0.08),
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: FaIcon(
                          FontAwesomeIcons.folder,
                          color: _downloadExternal ? Colors.black : Colors.amber,
                          size: 18,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Text(
                                'Dossier Public Téléchargements',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.amber.withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Text(
                                  'VIP',
                                  style: TextStyle(color: Colors.amber, fontSize: 9, fontWeight: FontWeight.w900),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            widget.isPremium
                                ? 'Fichier exporté dans vos fichiers pour VLC, Galerie, etc.'
                                : 'Débloquez l\'exportation de fichiers avec CHILLERS VIP.',
                            style: const TextStyle(color: Colors.white60, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    if (widget.isPremium)
                      Container(
                        width: 22,
                        height: 22,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: _downloadExternal ? Colors.amber : Colors.white30,
                            width: 2,
                          ),
                        ),
                        child: _downloadExternal
                            ? Center(
                                child: Container(
                                  width: 10,
                                  height: 10,
                                  decoration: const BoxDecoration(
                                    color: Colors.amber,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              )
                            : null,
                      )
                    else
                      const FaIcon(FontAwesomeIcons.lock, color: Colors.amber, size: 16),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 22),

            // Bouton Principal de Téléchargement
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: _downloadExternal ? Colors.amber : AppTheme.primary,
                  foregroundColor: _downloadExternal ? Colors.black : Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25)),
                  elevation: 0,
                ),
                onPressed: _executeDownload,
                icon: const FaIcon(FontAwesomeIcons.download, size: 18),
                label: Text(
                  _downloadExternal
                      ? 'Télécharger en Mode VIP'
                      : 'Démarrer le Téléchargement',
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}
