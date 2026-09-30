import 'dart:async';
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../config/theme.dart';
import '../models/media_item.dart';
import 'trailer_modal.dart';

class UpcomingSection extends StatefulWidget {
  final List<MediaItem> items;
  final Function(MediaItem) onWatchNow;
  final Function(MediaItem) onOpenDetails;

  const UpcomingSection({
    super.key,
    required this.items,
    required this.onWatchNow,
    required this.onOpenDetails,
  });

  @override
  State<UpcomingSection> createState() => _UpcomingSectionState();
}

class _UpcomingSectionState extends State<UpcomingSection> {
  int _currentIndex = 0;
  Timer? _autoSlideTimer;
  bool _isPaused = false;

  void togglePause() {
    setState(() => _isPaused = !_isPaused);
  }

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  @override
  void dispose() {
    _autoSlideTimer?.cancel();
    super.dispose();
  }

  void _startTimer() {
    _autoSlideTimer?.cancel();
    _autoSlideTimer = Timer.periodic(const Duration(seconds: 7), (timer) {
      if (_isPaused || widget.items.isEmpty) return;
      if (mounted) {
        setState(() {
          _currentIndex = (_currentIndex + 1) % widget.items.length;
        });
      }
    });
  }

  void _onNext() {
    if (widget.items.isEmpty) return;
    setState(() {
      _currentIndex = (_currentIndex + 1) % widget.items.length;
    });
  }

  void _onPrev() {
    if (widget.items.isEmpty) return;
    setState(() {
      _currentIndex = (_currentIndex - 1 + widget.items.length) % widget.items.length;
    });
  }

  String _formatReleaseDate(String? raw) {
    if (raw == null || raw.isEmpty) return '';
    try {
      final parts = raw.split('-');
      if (parts.length == 3) {
        final year = parts[0];
        final month = int.tryParse(parts[1]) ?? 1;
        final day = parts[2];
        const monthsFr = [
          'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
          'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
        ];
        final monthName = monthsFr[(month - 1).clamp(0, 11)];
        return '$day $monthName $year';
      }
    } catch (_) {}
    return raw;
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) return const SizedBox.shrink();

    final current = widget.items[_currentIndex.clamp(0, widget.items.length - 1)];
    final posterUrl = current.poster ?? current.backdrop ?? '';
    final dateStr = _formatReleaseDate(current.releaseDate ?? current.year);

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
                  color: const Color(0xFF06B6D4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Films à venir & Prochainement',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: -0.2,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF06B6D4).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF06B6D4).withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const FaIcon(FontAwesomeIcons.hourglassHalf, color: Color(0xFF06B6D4), size: 10),
                    const SizedBox(width: 4),
                    Text(
                      '${widget.items.length} exclusivités',
                      style: const TextStyle(
                        color: Color(0xFF06B6D4),
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        // Featured Hero Spotlight Card
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12.0),
          child: GestureDetector(
            onHorizontalDragEnd: (details) {
              if (details.primaryVelocity != null) {
                if (details.primaryVelocity! < -200) {
                  _onNext();
                } else if (details.primaryVelocity! > 200) {
                  _onPrev();
                }
              }
            },
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFF0A192F),
                    Color(0xFF0D223F),
                    Color(0xFF071324),
                  ],
                ),
                border: Border.all(
                  color: const Color(0xFF06B6D4).withValues(alpha: 0.2),
                  width: 1,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF06B6D4).withValues(alpha: 0.08),
                    blurRadius: 20,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Poster Vertical (2:3)
                      GestureDetector(
                        onTap: () => widget.onOpenDetails(current),
                        child: Container(
                          width: 120,
                          height: 180,
                          color: Colors.black26,
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
                                top: 6,
                                left: 6,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.75),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text(
                                    'EXCLU',
                                    style: TextStyle(
                                      color: Color(0xFF06B6D4),
                                      fontSize: 8,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                      // Details
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.all(12.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Badges
                              Wrap(
                                spacing: 6,
                                runSpacing: 4,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF06B6D4).withValues(alpha: 0.2),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        FaIcon(FontAwesomeIcons.hourglassHalf, color: Color(0xFF22D3EE), size: 9),
                                        SizedBox(width: 4),
                                        Text(
                                          'Bientôt',
                                          style: TextStyle(
                                            color: Color(0xFF22D3EE),
                                            fontSize: 9,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  if (dateStr.isNotEmpty)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                                      decoration: BoxDecoration(
                                        color: Colors.blueAccent.withValues(alpha: 0.2),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const FaIcon(FontAwesomeIcons.calendarDay, color: Colors.lightBlueAccent, size: 9),
                                          const SizedBox(width: 4),
                                          Text(
                                            dateStr,
                                            style: const TextStyle(
                                              color: Colors.lightBlueAccent,
                                              fontSize: 9,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 6),

                              // Title
                              GestureDetector(
                                onTap: () => widget.onOpenDetails(current),
                                child: Text(
                                  current.title,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    height: 1.15,
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(height: 6),

                              // Description
                              Text(
                                current.description ?? 'Retrouvez très prochainement ce film à l\'affiche et en streaming sur CHILLERS.',
                                style: const TextStyle(
                                  color: Color(0xFF94A3B8),
                                  fontSize: 11,
                                  height: 1.25,
                                ),
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),

                  // Actions & Slide Controls
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
                    child: Row(
                      children: [
                        // Voir la fiche
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0284C7),
                            foregroundColor: Colors.white,
                            visualDensity: VisualDensity.compact,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            elevation: 0,
                          ),
                          onPressed: () => widget.onOpenDetails(current),
                          icon: const FaIcon(FontAwesomeIcons.circleInfo, size: 12),
                          label: const Text('Fiche', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        ),
                        const SizedBox(width: 8),

                        // Bande-annonce
                        OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF22D3EE),
                            side: BorderSide(color: const Color(0xFF06B6D4).withValues(alpha: 0.4)),
                            visualDensity: VisualDensity.compact,
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: () => TrailerModal.show(context, current),
                          icon: const FaIcon(FontAwesomeIcons.clapperboard, size: 11, color: Color(0xFF22D3EE)),
                          label: const Text('Trailer', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        ),

                        const Spacer(),

                        // Pagination Dots & Arrows
                        if (widget.items.length > 1) ...[
                          InkWell(
                            onTap: _onPrev,
                            borderRadius: BorderRadius.circular(16),
                            child: Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.08),
                                shape: BoxShape.circle,
                              ),
                              child: const FaIcon(FontAwesomeIcons.chevronLeft, color: Colors.white70, size: 10),
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '${_currentIndex + 1}/${widget.items.length}',
                            style: const TextStyle(
                              color: Color(0xFF06B6D4),
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(width: 4),
                          InkWell(
                            onTap: _onNext,
                            borderRadius: BorderRadius.circular(16),
                            child: Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.08),
                                shape: BoxShape.circle,
                              ),
                              child: const FaIcon(FontAwesomeIcons.chevronRight, color: Colors.white70, size: 10),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),

        // Horizontal Row of Upcoming Cards
        if (widget.items.length > 1) ...[
          const SizedBox(height: 10),
          SizedBox(
            height: 155,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: widget.items.length,
              itemBuilder: (context, index) {
                final item = widget.items[index];
                final isSelected = index == _currentIndex;
                final releaseText = _formatReleaseDate(item.releaseDate ?? item.year);

                return GestureDetector(
                  onTap: () {
                    setState(() => _currentIndex = index);
                  },
                  child: Container(
                    width: 100,
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isSelected ? const Color(0xFF06B6D4) : Colors.transparent,
                        width: 1.5,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Stack(
                            children: [
                              (item.poster != null && item.poster!.isNotEmpty)
                                  ? CachedNetworkImage(
                                      imageUrl: item.poster!,
                                      height: 115,
                                      width: 100,
                                      fit: BoxFit.cover,
                                      placeholder: (context, url) => Container(color: AppTheme.card),
                                      errorWidget: (context, url, error) => Container(
                                        height: 115,
                                        color: AppTheme.card,
                                        child: const Center(
                                          child: FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 20),
                                        ),
                                      ),
                                    )
                                  : Container(
                                      height: 115,
                                      width: 100,
                                      color: AppTheme.card,
                                      child: const Center(
                                        child: FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 20),
                                      ),
                                    ),
                              if (releaseText.isNotEmpty)
                                Positioned(
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 4),
                                    color: Colors.black.withValues(alpha: 0.8),
                                    child: Text(
                                      releaseText,
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(
                                        color: Color(0xFF22D3EE),
                                        fontSize: 8,
                                        fontWeight: FontWeight.bold,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          item.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                            color: isSelected ? const Color(0xFF22D3EE) : Colors.white70,
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
      ],
    );
  }
}
