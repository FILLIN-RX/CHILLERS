import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';

class Top10Section extends StatelessWidget {
  final String title;
  final List<MediaItem> items;
  final Function(MediaItem) onItemTap;
  final Function(MediaItem)? onDetailsTap;

  const Top10Section({
    super.key,
    this.title = 'Top 10 : Ce que tout le monde regarde',
    required this.items,
    required this.onItemTap,
    this.onDetailsTap,
  });

  @override
  Widget build(BuildContext context) {
    final top10 = items.take(10).toList();
    if (top10.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── SECTION HEADER AVEC BARRE ROSE ──
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
            ],
          ),
        ),

        // ── SCROLL HORIZONTAL AVEC GRANDS CHIFFRES OUTLINED (1 À 10) ──
        SizedBox(
          height: 180,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: top10.length,
            itemBuilder: (context, index) {
              final item = top10[index];
              final rank = index + 1;
              final isDoubleDigit = rank >= 10;

              return GestureDetector(
                onTap: () => onDetailsTap != null ? onDetailsTap!(item) : onItemTap(item),
                child: Container(
                  margin: const EdgeInsets.only(right: 14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      // Grand Chiffre Stylisé Outlined (Effet Web Top 10)
                      SizedBox(
                        width: isDoubleDigit ? 62 : 44,
                        height: 165,
                        child: Align(
                          alignment: Alignment.bottomCenter,
                          child: Stack(
                            alignment: Alignment.bottomCenter,
                            children: [
                              // Contour / Stroke blanc net
                              Text(
                                '$rank',
                                style: TextStyle(
                                  fontSize: isDoubleDigit ? 88 : 105,
                                  fontWeight: FontWeight.w900,
                                  height: 0.82,
                                  letterSpacing: -6.0,
                                  foreground: Paint()
                                    ..style = PaintingStyle.stroke
                                    ..strokeWidth = 3.5
                                    ..color = Colors.white.withValues(alpha: 0.9),
                                  shadows: [
                                    Shadow(
                                      color: Colors.black.withValues(alpha: 0.95),
                                      blurRadius: 18,
                                      offset: const Offset(0, 6),
                                    ),
                                  ],
                                ),
                              ),
                              // Remplissage intérieur semi-transparent
                              Text(
                                '$rank',
                                style: TextStyle(
                                  fontSize: isDoubleDigit ? 88 : 105,
                                  fontWeight: FontWeight.w900,
                                  height: 0.82,
                                  letterSpacing: -6.0,
                                  color: const Color(0xFF18181B).withValues(alpha: 0.5),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                      // Affiche du Média superposée légèrement au numéro
                      Transform.translate(
                        offset: const Offset(-12, 0),
                        child: Container(
                          width: 110,
                          height: 165,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.12),
                              width: 1,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.8),
                                blurRadius: 16,
                                offset: const Offset(0, 6),
                              ),
                            ],
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              if (item.poster != null && item.poster!.isNotEmpty)
                                CachedNetworkImage(
                                  imageUrl: item.poster!,
                                  fit: BoxFit.cover,
                                  placeholder: (context, url) => Container(color: AppTheme.card),
                                  errorWidget: (context, url, error) => Container(
                                    color: AppTheme.card,
                                    child: const Center(
                                      child: FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 24),
                                    ),
                                  ),
                                )
                              else
                                Container(
                                  color: AppTheme.card,
                                  child: const Center(
                                    child: FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 24),
                                  ),
                                ),

                              // Gradient d'ombre inférieur
                              Container(
                                decoration: const BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    colors: [
                                      Colors.transparent,
                                      Colors.transparent,
                                      Colors.black87,
                                    ],
                                    stops: [0.0, 0.6, 1.0],
                                  ),
                                ),
                              ),

                              // Badge VIP si premium
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

                              // Titre en bas
                              Positioned(
                                left: 6,
                                right: 6,
                                bottom: 6,
                                child: Text(
                                  item.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
