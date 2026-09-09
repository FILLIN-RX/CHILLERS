import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/media_item.dart';
import '../services/api_service.dart';
import '../screens/watch/watch_screen.dart';
import 'app_video_player.dart';

class TrailerModal extends StatefulWidget {
  final MediaItem item;

  const TrailerModal({super.key, required this.item});

  static Future<void> show(BuildContext context, MediaItem item) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => TrailerModal(item: item),
    );
  }

  @override
  State<TrailerModal> createState() => _TrailerModalState();
}

class _TrailerModalState extends State<TrailerModal> {
  final ApiService _apiService = ApiService();
  String? _trailerUrl;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadTrailer();
  }

  Future<void> _loadTrailer() async {
    if (widget.item.trailerUrl != null && widget.item.trailerUrl!.isNotEmpty) {
      if (mounted) {
        setState(() {
          _trailerUrl = widget.item.trailerUrl;
          _isLoading = false;
        });
      }
      return;
    }

    try {
      final isSeries = widget.item.type == 'serie' || widget.item.type == 'series' || widget.item.type == 'anime';
      final details = await _apiService.getMediaDetail(widget.item.id, isSeries: isSeries);
      if (mounted) {
        setState(() {
          _trailerUrl = details?.trailerUrl ?? widget.item.streamUrl;
          _isLoading = false;
          if (_trailerUrl == null || _trailerUrl!.isEmpty) {
            _error = 'Aucune bande-annonce vidéo disponible pour ce titre.';
          }
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _trailerUrl = widget.item.streamUrl;
          _isLoading = false;
          if (_trailerUrl == null || _trailerUrl!.isEmpty) {
            _error = 'Impossible de charger la bande-annonce.';
          }
        });
      }
    }
  }

  void _watchFullMedia() {
    Navigator.pop(context);
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => WatchScreen(item: widget.item),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;

    return Container(
      height: screenHeight * 0.75,
      decoration: const BoxDecoration(
        color: Color(0xFF141418),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 12, bottom: 8),
            width: 44,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Row(
              children: [
                const Icon(Icons.movie_creation_rounded, color: AppTheme.primary, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.item.title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const Text(
                        'Bande-annonce officielle',
                        style: TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: Colors.white70),
                  onPressed: () => Navigator.pop(context),
                  tooltip: 'Fermer',
                ),
              ],
            ),
          ),

          const Divider(color: Colors.white10, height: 1),

          // Video player area
          Expanded(
            child: _isLoading
                ? const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircularProgressIndicator(color: AppTheme.primary),
                        SizedBox(height: 12),
                        Text(
                          'Chargement de la bande-annonce...',
                          style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                        ),
                      ],
                    ),
                  )
                : _trailerUrl != null && _trailerUrl!.isNotEmpty
                    ? Container(
                        color: Colors.black,
                        child: AppVideoPlayer(
                          videoUrl: _trailerUrl!,
                          title: widget.item.title,
                          subtitle: 'Bande-annonce',
                          autoPlay: true,
                        ),
                      )
                    : Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24.0),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.videocam_off_rounded, color: Colors.white30, size: 48),
                              const SizedBox(height: 12),
                              Text(
                                _error ?? 'Bande-annonce introuvable',
                                style: const TextStyle(color: Colors.white70, fontSize: 14),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppTheme.primary,
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                                ),
                                onPressed: _watchFullMedia,
                                icon: const Icon(Icons.play_arrow_rounded),
                                label: const Text('Lancer le film directement'),
                              ),
                            ],
                          ),
                        ),
                      ),
          ),

          // Bottom action button
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            decoration: const BoxDecoration(
              color: Color(0xFF0F0F12),
              border: Border(top: BorderSide(color: Colors.white10)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      elevation: 4,
                      shadowColor: AppTheme.primary.withValues(alpha: 0.5),
                    ),
                    onPressed: _watchFullMedia,
                    icon: const Icon(Icons.play_circle_fill_rounded, size: 22),
                    label: const Text(
                      'REGARDER EN ENTIER',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, letterSpacing: 0.5),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
