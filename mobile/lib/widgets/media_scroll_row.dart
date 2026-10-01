import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../config/theme.dart';
import '../models/media_item.dart';
import '../services/feedback_service.dart';

class MediaScrollRow extends StatelessWidget {
  final String title;
  final List<MediaItem> items;
  final Function(MediaItem) onItemTap;
  final Function(MediaItem)? onDetailsTap;
  final double itemHeight;
  final double itemWidth;

  const MediaScrollRow({
    super.key,
    required this.title,
    required this.items,
    required this.onItemTap,
    this.onDetailsTap,
    this.itemHeight = 250,
    this.itemWidth = 142,
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

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
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: -0.2,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                '${items.length}',
                style: const TextStyle(
                  color: AppTheme.textSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),

        // Horizontal List View
        SizedBox(
          height: itemHeight,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: items.length,
            itemBuilder: (context, index) {
              final item = items[index];
              return _buildMediaCard(item);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildMediaCard(MediaItem item) {
    return GestureDetector(
      onTap: () {
        FeedbackService.hapticMedium();
        onDetailsTap != null ? onDetailsTap!(item) : onItemTap(item);
      },
      child: Container(
        width: itemWidth,
        margin: const EdgeInsets.symmetric(horizontal: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Poster Image
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: Stack(
                children: [
                  (item.poster != null && item.poster!.isNotEmpty)
                      ? CachedNetworkImage(
                          imageUrl: item.poster!,
                          height: itemHeight - 55,
                          width: itemWidth,
                          fit: BoxFit.cover,
                          placeholder: (context, url) => Container(color: AppTheme.card),
                          errorWidget: (context, url, error) => Container(
                            height: itemHeight - 55,
                            width: itemWidth,
                            color: AppTheme.card,
                            child: const Center(
                              child: FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 24),
                            ),
                          ),
                        )
                      : Container(
                          height: itemHeight - 55,
                          width: itemWidth,
                          color: AppTheme.card,
                          child: const Center(
                            child: FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 24),
                          ),
                        ),

                  // Bottom subtle gradient
                  Positioned(
                    bottom: 0,
                    left: 0,
                    right: 0,
                    child: Container(
                      height: 30,
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Colors.transparent, Colors.black54],
                        ),
                      ),
                    ),
                  ),

                  // VIP Badge if premium
                  if (item.isPremium == true)
                    Positioned(
                      top: 6,
                      right: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.primary,
                          borderRadius: BorderRadius.circular(4),
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.primary.withValues(alpha: 0.5),
                              blurRadius: 6,
                            ),
                          ],
                        ),
                        child: const Text(
                          'VIP',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 8,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 6),

            // Title
            Text(
              item.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),

            // Rating & Year row
            Row(
              children: [
                if (item.rating != null && item.rating!.isNotEmpty) ...[
                  const FaIcon(FontAwesomeIcons.solidStar, color: Colors.amber, size: 10),
                  const SizedBox(width: 3),
                  Text(
                    item.rating!,
                    style: const TextStyle(
                      color: Colors.amber,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
                if (item.year != null && item.year!.isNotEmpty) ...[
                  if (item.rating != null && item.rating!.isNotEmpty)
                    const Text(' • ', style: TextStyle(color: Colors.white30, fontSize: 10)),
                  Text(
                    item.year!,
                    style: const TextStyle(
                      color: Colors.white54,
                      fontSize: 11,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
