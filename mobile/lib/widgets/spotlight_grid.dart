import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../config/theme.dart';
import '../models/media_item.dart';

class SpotlightGrid extends StatelessWidget {
  final List<MediaItem> items;
  final Function(MediaItem) onWatchNow;
  final Function(MediaItem) onOpenDetails;

  const SpotlightGrid({
    super.key,
    required this.items,
    required this.onWatchNow,
    required this.onOpenDetails,
  });

  @override
  Widget build(BuildContext context) {
    if (items.length < 4) return const SizedBox.shrink();
    final spotlightItems = items.take(4).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 10.0),
          child: Row(
            children: [
              Container(
                width: 4,
                height: 18,
                decoration: BoxDecoration(
                  color: AppTheme.primary,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'Coups de Cœur & Sélection',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: -0.2,
                ),
              ),
            ],
          ),
        ),

        // Grid cards
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12.0),
          child: ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: spotlightItems.length,
            separatorBuilder: (context, index) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final item = spotlightItems[index];
              return _buildSpotlightCard(item);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildSpotlightCard(MediaItem item) {
    final posterUrl = item.poster ?? item.backdrop ?? '';

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF141418),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Vertical Poster (2:3)
          GestureDetector(
            onTap: () => onOpenDetails(item),
            child: SizedBox(
              width: 95,
              height: 140,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  posterUrl.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: posterUrl,
                          fit: BoxFit.cover,
                          placeholder: (context, url) => Container(color: AppTheme.card),
                          errorWidget: (context, url, error) => Container(
                            color: AppTheme.card,
                            child: const Center(
                              child: FaIcon(FontAwesomeIcons.film, color: Colors.white24),
                            ),
                          ),
                        )
                      : Container(
                          color: AppTheme.card,
                          child: const Center(
                            child: FaIcon(FontAwesomeIcons.film, color: Colors.white24),
                          ),
                        ),
                  Positioned(
                    bottom: 0,
                    left: 0,
                    right: 0,
                    child: Container(
                      height: 40,
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Colors.transparent, Colors.black87],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Details & Actions
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(10.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Rating & Year
                      Row(
                        children: [
                          if (item.rating != null && item.rating!.isNotEmpty) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.amber.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const FaIcon(FontAwesomeIcons.solidStar, color: Colors.amber, size: 10),
                                  const SizedBox(width: 3),
                                  Text(
                                    item.rating!,
                                    style: const TextStyle(
                                      color: Colors.amber,
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 6),
                          ],
                          if (item.year != null && item.year!.isNotEmpty) ...[
                            Text(
                              item.year!,
                              style: const TextStyle(color: Colors.white60, fontSize: 11),
                            ),
                          ],
                          if (item.genres != null && item.genres!.isNotEmpty) ...[
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                '• ${item.genres!.first}',
                                style: const TextStyle(color: Colors.white38, fontSize: 11),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),

                      // Title
                      GestureDetector(
                        onTap: () => onOpenDetails(item),
                        child: Text(
                          item.title,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            height: 1.15,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(height: 4),

                      // Synopsis
                      Text(
                        item.description ?? 'Découvrez ce titre incontournable disponible en streaming.',
                        style: const TextStyle(
                          color: Colors.white60,
                          fontSize: 11,
                          height: 1.25,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Buttons
                  Row(
                    children: [
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primary,
                          foregroundColor: Colors.white,
                          visualDensity: VisualDensity.compact,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          elevation: 0,
                        ),
                        onPressed: () => onWatchNow(item),
                        icon: const FaIcon(FontAwesomeIcons.play, size: 10),
                        label: const Text('Regarder', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white70,
                          side: const BorderSide(color: Colors.white24),
                          visualDensity: VisualDensity.compact,
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: () => onOpenDetails(item),
                        child: const Text('Détails', style: TextStyle(fontSize: 11)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
