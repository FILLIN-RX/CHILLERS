import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/media_item.dart';
import '../models/user_model.dart';
import '../services/download_service.dart';
import '../services/feedback_service.dart';

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
  bool _isStarting = false;

  void _executeDownload() async {
    if (_isStarting) return;
    setState(() => _isStarting = true);

    FeedbackService.hapticMedium();

    final messenger = ScaffoldMessenger.of(context);
    final downloadService = DownloadService();

    Navigator.pop(context);

    await downloadService.startDownload(
      item: widget.item,
      episode: widget.episode,
      seasonNumber: widget.seasonNumber ?? 1,
      streamUrl: widget.streamUrl,
      quality: widget.isPremium ? '1080p Full HD (VIP)' : '1080p Full HD',
      isPremium: widget.isPremium,
      isExternal: widget.isPremium,
    );

    final displayTitle = widget.episode != null
        ? '${widget.item.title} - S${widget.seasonNumber ?? 1}:E${widget.episode!.episodeNumber}'
        : widget.item.title;

    messenger.showSnackBar(
      SnackBar(
        backgroundColor: const Color(0xFF222222),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        content: Row(
          children: [
            const FaIcon(FontAwesomeIcons.circleDown, color: Color(0xFFE50914), size: 18),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Téléchargement démarré',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  Text(
                    displayTitle,
                    style: const TextStyle(color: Colors.white70, fontSize: 11),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bool isEpisode = widget.episode != null;
    final String displayTitle = isEpisode
        ? '${widget.item.title} (S${widget.seasonNumber ?? 1}:E${widget.episode!.episodeNumber})'
        : widget.item.title;

    final String episodeName = isEpisode
        ? (widget.episode!.title != null && widget.episode!.title!.isNotEmpty
            ? widget.episode!.title!
            : (widget.episode!.episode.isNotEmpty ? widget.episode!.episode : 'Épisode ${widget.episode!.episodeNumber}'))
        : (widget.item.genres?.join(' • ') ?? 'Film HD');

    final String estimatedSize = isEpisode ? '~380 Mo' : '~1.2 Go';

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF161616),
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Poignée supérieure style Netflix ──
            Center(
              child: Container(
                width: 38,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // ── En-tête Média (Poster + Titre + Métas) ──
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: (widget.item.poster != null && widget.item.poster!.isNotEmpty)
                      ? CachedNetworkImage(
                          imageUrl: widget.item.poster!,
                          width: 54,
                          height: 78,
                          fit: BoxFit.cover,
                          errorWidget: (context, url, error) => Container(
                            width: 54,
                            height: 78,
                            color: const Color(0xFF262626),
                            child: const Center(
                              child: FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 20),
                            ),
                          ),
                        )
                      : Container(
                          width: 54,
                          height: 78,
                          color: const Color(0xFF262626),
                          child: const Center(
                            child: FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 20),
                          ),
                        ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        displayTitle,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          letterSpacing: -0.2,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        episodeName,
                        style: const TextStyle(
                          color: Colors.white60,
                          fontSize: 12.5,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFF262626),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: Colors.white12),
                            ),
                            child: const Text(
                              '1080p HD',
                              style: TextStyle(
                                color: Colors.white70,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFF262626),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: Colors.white12),
                            ),
                            child: const Text(
                              'VF / VOSTFR',
                              style: TextStyle(
                                color: Colors.white70,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
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

            const SizedBox(height: 18),
            const Divider(color: Colors.white12, height: 1),
            const SizedBox(height: 16),

            // ── Information de stockage épurée (Netflix Style) ──
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: const [
                    FaIcon(FontAwesomeIcons.hardDrive, color: Colors.white54, size: 14),
                    SizedBox(width: 8),
                    Text(
                      'Taille estimée',
                      style: TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                  ],
                ),
                Text(
                  estimatedSize,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 20),

            // ── Bouton de Téléchargement Netflix (Bouton Blanc Épuré) ──
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: Colors.black,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                onPressed: _executeDownload,
                icon: const FaIcon(FontAwesomeIcons.download, size: 15, color: Colors.black),
                label: Text(
                  isEpisode ? 'Télécharger l\'épisode' : 'Télécharger le film',
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }
}
