import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';
import '../../services/api_service.dart';
import '../../widgets/app_video_player.dart';

class PlayerScreen extends StatefulWidget {
  final String title;
  final String videoUrl;
  final String? subtitle;
  final MediaItem? mediaItem;
  final int? currentSeason;
  final int? currentEpisode;
  final List<EpisodeItem>? episodes;

  const PlayerScreen({
    super.key,
    required this.title,
    required this.videoUrl,
    this.subtitle,
    this.mediaItem,
    this.currentSeason,
    this.currentEpisode,
    this.episodes,
  });

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  final ApiService _apiService = ApiService();

  late String _currentVideoUrl;
  late String _currentTitle;
  String? _currentSubtitle;
  int? _currentEpisode;

  @override
  void initState() {
    super.initState();
    _currentVideoUrl = widget.videoUrl;
    _currentTitle = widget.title;
    _currentSubtitle = widget.subtitle;
    _currentEpisode = widget.currentEpisode;

    // Favoriser le mode paysage à l'ouverture
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
      DeviceOrientation.portraitUp,
    ]);
  }

  @override
  void dispose() {
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    super.dispose();
  }

  bool get _hasNextEpisode {
    if (widget.episodes == null || _currentEpisode == null) return false;
    final idx = widget.episodes!.indexWhere((e) => e.episodeNumber == _currentEpisode);
    return idx >= 0 && idx < widget.episodes!.length - 1;
  }

  bool get _hasPrevEpisode {
    if (widget.episodes == null || _currentEpisode == null) return false;
    final idx = widget.episodes!.indexWhere((e) => e.episodeNumber == _currentEpisode);
    return idx > 0;
  }

  Future<void> _playNextEpisode() async {
    if (widget.episodes == null || _currentEpisode == null) return;
    final currentIndex = widget.episodes!.indexWhere((e) => e.episodeNumber == _currentEpisode);
    if (currentIndex >= 0 && currentIndex < widget.episodes!.length - 1) {
      final nextEp = widget.episodes![currentIndex + 1];
      await _switchEpisode(nextEp);
    }
  }

  Future<void> _playPrevEpisode() async {
    if (widget.episodes == null || _currentEpisode == null) return;
    final currentIndex = widget.episodes!.indexWhere((e) => e.episodeNumber == _currentEpisode);
    if (currentIndex > 0) {
      final prevEp = widget.episodes![currentIndex - 1];
      await _switchEpisode(prevEp);
    }
  }

  Future<void> _switchEpisode(EpisodeItem episode) async {
    if (widget.mediaItem == null) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(
        child: CircularProgressIndicator(color: AppTheme.primary),
      ),
    );

    final streamUrl = await _apiService.getEpisodeStreamUrl(
      widget.mediaItem!.id,
      episode.season,
      episode.episodeNumber,
      widget.mediaItem!.title,
    );

    if (!mounted) return;
    Navigator.pop(context);

    final validUrl = streamUrl ?? episode.streamUrl;
    if (validUrl.isNotEmpty) {
      setState(() {
        _currentVideoUrl = validUrl;
        _currentTitle = widget.mediaItem!.title;
        _currentSubtitle = 'S${episode.season} E${episode.episodeNumber} - ${episode.episode}';
        _currentEpisode = episode.episodeNumber;
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Flux vidéo introuvable pour cet épisode')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            // Composant Réutilisable AppVideoPlayer
            Center(
              child: AppVideoPlayer(
                videoUrl: _currentVideoUrl,
                title: _currentTitle,
                subtitle: _currentSubtitle,
                isFullScreen: true,
                hasNextEpisode: _hasNextEpisode,
                hasPrevEpisode: _hasPrevEpisode,
                onNextEpisode: _playNextEpisode,
                onPrevEpisode: _playPrevEpisode,
              ),
            ),

            // Barre supérieure personnalisée avec titre et contrôles d'épisodes
            Positioned(
              top: 8,
              left: 8,
              right: 8,
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white),
                    onPressed: () => Navigator.pop(context),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _currentTitle,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            shadows: [Shadow(blurRadius: 4, color: Colors.black)],
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (_currentSubtitle != null)
                          Text(
                            _currentSubtitle!,
                            style: const TextStyle(
                              color: AppTheme.primary,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              shadows: [Shadow(blurRadius: 4, color: Colors.black)],
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),

                  // Bouton Épisode Précédent & Suivant si série
                  if (widget.episodes != null && widget.episodes!.isNotEmpty) ...[
                    if (_hasPrevEpisode)
                      IconButton(
                        icon: const Icon(Icons.skip_previous_rounded, color: Colors.white),
                        tooltip: 'Épisode précédent',
                        onPressed: _playPrevEpisode,
                      ),
                    if (_hasNextEpisode)
                      IconButton(
                        icon: const Icon(Icons.skip_next_rounded, color: Colors.white),
                        tooltip: 'Épisode suivant',
                        onPressed: _playNextEpisode,
                      ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
