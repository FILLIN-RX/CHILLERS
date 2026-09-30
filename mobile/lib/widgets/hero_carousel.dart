import 'dart:async';
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../config/theme.dart';
import '../models/media_item.dart';
import '../services/api_service.dart';
import 'trailer_modal.dart';
import 'app_video_player.dart';

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
  final ApiService _apiService = ApiService();
  int _currentIndex = 0;
  bool _isPaused = false;
  Timer? _autoSlideTimer;
  Timer? _previewDebounceTimer;

  // Integrated Player state in Hero
  bool _isInlineVideoActive = false;
  String? _activeVideoUrl;
  final Map<String, String> _trailerCache = {};

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _startAutoSlide();
    _scheduleVideoPreview();
  }

  @override
  void dispose() {
    _autoSlideTimer?.cancel();
    _previewDebounceTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  void _startAutoSlide() {
    _autoSlideTimer?.cancel();
    _autoSlideTimer = Timer.periodic(const Duration(seconds: 10), (timer) {
      if (_isPaused || _isInlineVideoActive || widget.slides.isEmpty) return;
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

  void _scheduleVideoPreview() {
    _previewDebounceTimer?.cancel();
    if (widget.slides.isEmpty) return;

    final currentSlide = widget.slides[_currentIndex.clamp(0, widget.slides.length - 1)];

    // If slide already has a video or trailer URL
    final cached = _trailerCache[currentSlide.id] ?? currentSlide.trailerUrl ?? currentSlide.streamUrl;
    if (cached != null && cached.isNotEmpty) {
      _previewDebounceTimer = Timer(const Duration(milliseconds: 1500), () {
        if (mounted) {
          setState(() {
            _activeVideoUrl = cached;
          });
        }
      });
      return;
    }

    // Otherwise load trailer URL in background
    _previewDebounceTimer = Timer(const Duration(milliseconds: 1800), () async {
      try {
        final isSeries = currentSlide.type == 'serie' || currentSlide.type == 'series' || currentSlide.type == 'anime';
        final url = await _apiService.getMediaTrailerUrl(currentSlide.id, isTV: isSeries);
        if (mounted && url != null && url.isNotEmpty) {
          _trailerCache[currentSlide.id] = url;
          if (_currentIndex < widget.slides.length && widget.slides[_currentIndex].id == currentSlide.id) {
            setState(() {
              _activeVideoUrl = url;
            });
          }
        }
      } catch (_) {}
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

  void _toggleInlinePlayer() {
    setState(() {
      _isInlineVideoActive = !_isInlineVideoActive;
      if (_isInlineVideoActive) {
        _isPaused = true;
      }
    });
  }

  void _openTrailer(MediaItem slide) {
    TrailerModal.show(context, slide);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.slides.isEmpty) return const SizedBox.shrink();

    final screenHeight = MediaQuery.of(context).size.height;
    final heroHeight = (screenHeight * 0.62).clamp(460.0, 580.0);

    return SizedBox(
      height: heroHeight,
      child: Stack(
        children: [
          // Slide PageView
          PageView.builder(
            controller: _pageController,
            itemCount: widget.slides.length,
            onPageChanged: (index) {
              setState(() {
                _currentIndex = index;
                _isInlineVideoActive = false;
                _activeVideoUrl = null;
              });
              _scheduleVideoPreview();
            },
            itemBuilder: (context, index) {
              final slide = widget.slides[index];
              final imageUrl = slide.backdrop ?? slide.poster ?? '';
              final isCurrentSlide = index == _currentIndex;

              return Stack(
                fit: StackFit.expand,
                children: [
                  // 1. Image de fond Backdrop
                  imageUrl.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: imageUrl,
                          fit: BoxFit.cover,
                          alignment: Alignment.topCenter,
                          placeholder: (context, url) => Container(color: AppTheme.surface),
                          errorWidget: (context, url, error) => Container(
                            color: AppTheme.surface,
                            child: const FaIcon(FontAwesomeIcons.film, size: 64, color: Colors.white24),
                          ),
                        )
                      : Container(color: AppTheme.surface),

                  // 2. Inline Video Player Layer (si activé sur la slide active)
                  if (isCurrentSlide && _isInlineVideoActive && _activeVideoUrl != null && _activeVideoUrl!.isNotEmpty)
                    Positioned.fill(
                      child: Container(
                        color: Colors.black,
                        child: AppVideoPlayer(
                          videoUrl: _activeVideoUrl!,
                          title: slide.title,
                          autoPlay: true,
                        ),
                      ),
                    ),

                  // 3. Dégradé sombre style Web
                  if (!_isInlineVideoActive)
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
                          stops: [0.0, 0.22, 0.52, 0.80, 1.0],
                        ),
                      ),
                    ),

                  // 4. Central Play Glow Button (Permet de lancer direct la vidéo)
                  if (!_isInlineVideoActive)
                    Positioned(
                      top: 130,
                      right: 20,
                      child: GestureDetector(
                        onTap: () => widget.onWatchNow(slide),
                        child: Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: AppTheme.primary.withValues(alpha: 0.25),
                            border: Border.all(color: AppTheme.primary.withValues(alpha: 0.6), width: 1.5),
                            boxShadow: [
                              BoxShadow(
                                color: AppTheme.primary.withValues(alpha: 0.35),
                                blurRadius: 18,
                                spreadRadius: 2,
                              ),
                            ],
                          ),
                          child: Center(
                            child: Container(
                              width: 44,
                              height: 44,
                              decoration: const BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppTheme.primary,
                              ),
                              child: const Center(
                                child: FaIcon(
                                  FontAwesomeIcons.play,
                                  color: Colors.white,
                                  size: 18,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),

                  // 5. Bouton Quick Player Preview (Aperçu dans le Hero)
                  if (isCurrentSlide && _activeVideoUrl != null && _activeVideoUrl!.isNotEmpty && !_isInlineVideoActive)
                    Positioned(
                      top: 140,
                      left: 16,
                      child: GestureDetector(
                        onTap: _toggleInlinePlayer,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.75),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFF06B6D4).withValues(alpha: 0.6)),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              FaIcon(FontAwesomeIcons.video, color: Color(0xFF22D3EE), size: 11),
                              SizedBox(width: 6),
                              Text(
                                'Aperçu Player',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),

                  // 6. Contenu texte et métadonnées
                  if (!_isInlineVideoActive)
                    Positioned(
                      left: 16,
                      right: 16,
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
                                const FaIcon(FontAwesomeIcons.solidStar, color: Colors.amber, size: 14),
                                const SizedBox(width: 3),
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
                                  icon: const FaIcon(FontAwesomeIcons.play, size: 18),
                                  label: const Text(
                                    'REGARDER',
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                                  ),
                                ),
                                const SizedBox(width: 8),

                                // Bouton BANDE-ANNONCE
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
                                  icon: const FaIcon(FontAwesomeIcons.clapperboard, size: 14, color: Colors.amber),
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
                                  icon: const FaIcon(FontAwesomeIcons.circleInfo, size: 14),
                                  label: const Text('Détails', style: TextStyle(fontSize: 12)),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                  // Si le player inline est actif, afficher un bouton pour fermer le player
                  if (_isInlineVideoActive)
                    Positioned(
                      top: MediaQuery.of(context).padding.top + 10,
                      right: 16,
                      child: GestureDetector(
                        onTap: _toggleInlinePlayer,
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.8),
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white24),
                          ),
                          child: const FaIcon(FontAwesomeIcons.xmark, color: Colors.white, size: 16),
                        ),
                      ),
                    ),
                ],
              );
            },
          ),

          // Contrôles en bas à droite : Précédent / Pause / Suivant
          if (!_isInlineVideoActive)
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
                        _isPaused ? FontAwesomeIcons.play.data : FontAwesomeIcons.pause.data,
                        color: Colors.white,
                        size: 14,
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
                      child: const FaIcon(
                        FontAwesomeIcons.chevronLeft,
                        color: Colors.white,
                        size: 14,
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
                      child: const FaIcon(
                        FontAwesomeIcons.chevronRight,
                        color: Colors.white,
                        size: 14,
                      ),
                    ),
                  ),
                ],
              ),
            ),

          // Indicateurs de pagination en bas au centre (Dots)
          if (!_isInlineVideoActive)
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
