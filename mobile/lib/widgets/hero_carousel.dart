import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../config/theme.dart';
import '../models/media_item.dart';
import 'trailer_modal.dart';

class HeroCarousel extends StatefulWidget {
  final List<MediaItem> slides;
  final Function(MediaItem) onWatchNow;
  final Function(MediaItem) onOpenDetails;

  const HeroCarousel({
    super.key,
    required this.slides,
    required this.onWatchNow,
    required this.onOpenDetails,
  });

  @override
  State<HeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends State<HeroCarousel> {
  late final PageController _pageController;
  int _currentIndex = 0;
  bool _isPaused = false;
  Timer? _autoSlideTimer;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _startAutoSlide();
  }

  @override
  void dispose() {
    _autoSlideTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  void _startAutoSlide() {
    _autoSlideTimer?.cancel();
    _autoSlideTimer = Timer.periodic(const Duration(seconds: 6), (timer) {
      if (_isPaused || widget.slides.isEmpty) return;
      final nextIndex = (_currentIndex + 1) % widget.slides.length;
      if (_pageController.hasClients) {
        _pageController.animateToPage(
          nextIndex,
          duration: const Duration(milliseconds: 600),
          curve: Curves.easeInOutCubic,
        );
      }
    });
  }

  void _onPrev() {
    if (widget.slides.isEmpty) return;
    final prevIndex = _currentIndex == 0 ? widget.slides.length - 1 : _currentIndex - 1;
    _pageController.animateToPage(
      prevIndex,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeInOut,
    );
  }

  void _onNext() {
    if (widget.slides.isEmpty) return;
    final nextIndex = (_currentIndex + 1) % widget.slides.length;
    _pageController.animateToPage(
      nextIndex,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeInOut,
    );
  }

  void _togglePause() {
    setState(() {
      _isPaused = !_isPaused;
    });
  }

  void _openTrailer(MediaItem slide) {
    TrailerModal.show(context, slide);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.slides.isEmpty) return const SizedBox.shrink();

    final screenHeight = MediaQuery.of(context).size.height;
    final heroHeight = (screenHeight * 0.58).clamp(440.0, 560.0);

    return SizedBox(
      height: heroHeight,
      child: Stack(
        children: [
          // Slide PageView
          PageView.builder(
            controller: _pageController,
            itemCount: widget.slides.length,
            onPageChanged: (index) {
              setState(() => _currentIndex = index);
            },
            itemBuilder: (context, index) {
              final slide = widget.slides[index];
              final imageUrl = slide.backdrop ?? slide.poster ?? '';

              return Stack(
                fit: StackFit.expand,
                children: [
                  // Image de fond (Backdrop)
                  imageUrl.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: imageUrl,
                          fit: BoxFit.cover,
                          alignment: Alignment.topCenter,
                          placeholder: (context, url) => Container(color: AppTheme.surface),
                          errorWidget: (context, url, error) => Container(
                            color: AppTheme.surface,
                            child: const Icon(Icons.movie, size: 64, color: Colors.white24),
                          ),
                        )
                      : Container(color: AppTheme.surface),

                  // Dégradé sombre style Web (Gradient overlay pour intégration navbar transparente)
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.transparent,
                          Colors.transparent,
                          Colors.black45,
                          Colors.black87,
                          AppTheme.background,
                        ],
                        stops: [0.0, 0.25, 0.55, 0.82, 1.0],
                      ),
                    ),
                  ),

                  // Bouton Play géant flottant sur la droite (Style Web Hero)
                  Positioned(
                    right: 18,
                    top: heroHeight * 0.38,
                    child: GestureDetector(
                      onTap: () => widget.onWatchNow(slide),
                      child: Container(
                        width: 58,
                        height: 58,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppTheme.primary,
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.primary.withValues(alpha: 0.55),
                              blurRadius: 20,
                              spreadRadius: 3,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.play_arrow_rounded,
                          color: Colors.white,
                          size: 38,
                        ),
                      ),
                    ),
                  ),

                  // Contenu texte et métadonnées (positionné dans le tiers inférieur)
                  Positioned(
                    left: 16,
                    right: 80,
                    bottom: 40,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Badges métadonnées
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: AppTheme.primary,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'À LA UNE',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 1.0,
                                ),
                              ),
                            ),
                            if (slide.year != null && slide.year!.isNotEmpty) ...[
                              const SizedBox(width: 8),
                              Text(
                                slide.year!,
                                style: const TextStyle(
                                  color: Colors.white70,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                            if (slide.rating != null && slide.rating!.isNotEmpty) ...[
                              const SizedBox(width: 8),
                              const Icon(Icons.star_rounded, color: Colors.amber, size: 16),
                              const SizedBox(width: 2),
                              Text(
                                slide.rating!,
                                style: const TextStyle(
                                  color: Colors.amber,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 8),

                        // Titre du film / série
                        Text(
                          slide.title,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            height: 1.15,
                            shadows: [
                              Shadow(blurRadius: 8, color: Colors.black, offset: Offset(0, 2)),
                            ],
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),

                        if (slide.description != null && slide.description!.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            slide.description!,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.white70,
                              height: 1.3,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                        const SizedBox(height: 14),

                        // Boutons d'action : Regarder + Bande-annonce + Détails
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: [
                              // Bouton REGARDER
                              ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppTheme.primary,
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  elevation: 4,
                                  shadowColor: AppTheme.primary.withValues(alpha: 0.4),
                                ),
                                onPressed: () => widget.onWatchNow(slide),
                                icon: const Icon(Icons.play_arrow_rounded, size: 20),
                                label: const Text(
                                  'REGARDER',
                                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                                ),
                              ),
                              const SizedBox(width: 8),

                              // Bouton BANDE-ANNONCE (Trailer Vidéo Fonctionnel)
                              OutlinedButton.icon(
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: Colors.white,
                                  backgroundColor: Colors.white.withValues(alpha: 0.12),
                                  side: const BorderSide(color: Colors.white24),
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                ),
                                onPressed: () => _openTrailer(slide),
                                icon: const Icon(Icons.movie_creation_outlined, size: 16, color: Colors.amber),
                                label: const Text(
                                  'Bande-annonce',
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                                ),
                              ),
                              const SizedBox(width: 8),

                              // Bouton DÉTAILS
                              OutlinedButton.icon(
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: Colors.white70,
                                  side: const BorderSide(color: Colors.white24),
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                ),
                                onPressed: () => widget.onOpenDetails(slide),
                                icon: const Icon(Icons.info_outline_rounded, size: 16),
                                label: const Text('Détails', style: TextStyle(fontSize: 12)),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),

          // Contrôles en bas à droite : Précédent / Pause / Suivant
          Positioned(
            right: 12,
            bottom: 12,
            child: Row(
              children: [
                InkWell(
                  onTap: _togglePause,
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white12),
                    ),
                    child: Icon(
                      _isPaused ? Icons.play_arrow_rounded : Icons.pause_rounded,
                      color: Colors.white,
                      size: 16,
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                InkWell(
                  onTap: _onPrev,
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white12),
                    ),
                    child: const Icon(
                      Icons.chevron_left_rounded,
                      color: Colors.white,
                      size: 16,
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                InkWell(
                  onTap: _onNext,
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white12),
                    ),
                    child: const Icon(
                      Icons.chevron_right_rounded,
                      color: Colors.white,
                      size: 16,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Indicateurs de pagination en bas au centre (Dots)
          Positioned(
            left: 16,
            bottom: 14,
            child: Row(
              children: List.generate(
                widget.slides.length,
                (idx) => AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  width: _currentIndex == idx ? 22 : 6,
                  height: 6,
                  margin: const EdgeInsets.only(right: 4),
                  decoration: BoxDecoration(
                    color: _currentIndex == idx ? AppTheme.primary : Colors.white30,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
