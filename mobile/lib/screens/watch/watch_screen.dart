import 'dart:math';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';
import '../../services/api_service.dart';
import '../../services/download_service.dart';
import '../../widgets/app_video_player.dart';

class WatchScreen extends StatefulWidget {
  final MediaItem item;
  final int? initialSeason;
  final int? initialEpisode;
  final String? initialVideoUrl;

  const WatchScreen({
    super.key,
    required this.item,
    this.initialSeason,
    this.initialEpisode,
    this.initialVideoUrl,
  });

  @override
  State<WatchScreen> createState() => _WatchScreenState();
}

class _WatchScreenState extends State<WatchScreen> {
  final ApiService _apiService = ApiService();

  late MediaItem _currentMedia;
  String _currentVideoUrl = '';
  bool _isLoadingStream = true;
  bool _streamUnavailable = false;

  // Séries & Épisodes
  bool get _isSeries => _currentMedia.type == 'series' || _currentMedia.type == 'tv' || _currentMedia.type == 'anime';
  int _selectedSeason = 1;
  int? _currentEpisodeNumber;
  String? _currentEpisodeTitle;
  List<EpisodeItem> _episodes = [];
  bool _isLoadingEpisodes = false;

  bool _isFavorite = false;
  bool _isWatchlist = false;

  @override
  void initState() {
    super.initState();
    _currentMedia = widget.item;
    _selectedSeason = widget.initialSeason ?? 1;
    _currentEpisodeNumber = widget.initialEpisode ?? 1;

    _loadMediaDetails();
    if (_isSeries) {
      _loadSeasonEpisodes(_selectedSeason);
    } else {
      _resolveMovieStream();
    }
  }

  Future<void> _loadMediaDetails() async {
    final detail = await _apiService.getMediaDetail(_currentMedia.id, isSeries: _isSeries);
    if (detail != null && mounted) {
      setState(() {
        _currentMedia = detail;
      });
    }
  }

  Future<void> _resolveMovieStream() async {
    if (widget.initialVideoUrl != null && widget.initialVideoUrl!.isNotEmpty) {
      if (mounted) {
        setState(() {
          _currentVideoUrl = widget.initialVideoUrl!;
          _isLoadingStream = false;
          _streamUnavailable = false;
        });
      }
      return;
    }

    setState(() {
      _isLoadingStream = true;
      _streamUnavailable = false;
    });

    final url = await _apiService.getMovieStreamUrl(_currentMedia.id, _currentMedia.title);
    if (!mounted) return;

    final validUrl = url ?? (_currentMedia.streamUrl != null && _currentMedia.streamUrl!.isNotEmpty ? _currentMedia.streamUrl : null);

    setState(() {
      if (validUrl != null && validUrl.isNotEmpty) {
        _currentVideoUrl = validUrl;
        _streamUnavailable = false;
      } else {
        _currentVideoUrl = '';
        _streamUnavailable = true;
      }
      _isLoadingStream = false;
    });
  }

  Future<void> _loadSeasonEpisodes(int seasonNumber) async {
    setState(() => _isLoadingEpisodes = true);
    final eps = await _apiService.getSeasonEpisodes(_currentMedia.id, seasonNumber);

    if (!mounted) return;

    setState(() {
      _episodes = eps;
      _isLoadingEpisodes = false;
    });

    if (eps.isNotEmpty) {
      final ep = eps.firstWhere(
        (e) => e.episodeNumber == _currentEpisodeNumber,
        orElse: () => eps.first,
      );
      _playEpisode(ep);
    }
  }

  Future<void> _playEpisode(EpisodeItem episode) async {
    setState(() {
      _isLoadingStream = true;
      _streamUnavailable = false;
      _currentEpisodeNumber = episode.episodeNumber;
      _currentEpisodeTitle = episode.episode;
    });

    final streamUrl = await _apiService.getEpisodeStreamUrl(
      _currentMedia.id,
      episode.season,
      episode.episodeNumber,
      _currentMedia.title,
    );

    if (!mounted) return;

    final validUrl = streamUrl ?? (episode.streamUrl.isNotEmpty ? episode.streamUrl : null);

    setState(() {
      if (validUrl != null && validUrl.isNotEmpty) {
        _currentVideoUrl = validUrl;
        _streamUnavailable = false;
      } else {
        _currentVideoUrl = '';
        _streamUnavailable = true;
      }
      _isLoadingStream = false;
    });
  }

  void _toggleFavorite() async {
    setState(() => _isFavorite = !_isFavorite);
    final ok = await _apiService.toggleFavorite(_currentMedia.id, type: _currentMedia.type);
    if (!ok && mounted) {
      setState(() => _isFavorite = !_isFavorite);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isFavorite ? 'Ajouté aux favoris' : 'Retiré des favoris'),
          duration: const Duration(seconds: 1),
        ),
      );
    }
  }

  void _toggleWatchlist() async {
    setState(() => _isWatchlist = !_isWatchlist);
    final ok = await _apiService.toggleWatchLater(_currentMedia.id);
    if (!ok && mounted) {
      setState(() => _isWatchlist = !_isWatchlist);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isWatchlist ? 'Ajouté à votre liste' : 'Retiré de votre liste'),
          duration: const Duration(seconds: 1),
        ),
      );
    }
  }

  String _formatRuntime(int? minutes) {
    if (minutes == null || minutes <= 0) return '';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    if (h > 0) return '$h h ${m > 0 ? '$m min' : ''}'.trim();
    return '$m min';
  }

  void _onDownload({EpisodeItem? episode}) async {
    final downloadService = DownloadService();
    await downloadService.startDownload(
      item: _currentMedia,
      episode: episode,
      seasonNumber: _selectedSeason,
      streamUrl: _currentVideoUrl.isNotEmpty ? _currentVideoUrl : null,
    );
    if (mounted) {
      final label = episode != null
          ? '${_currentMedia.title} (S$_selectedSeason:E${episode.episodeNumber})'
          : _currentMedia.title;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppTheme.card,
          content: Row(
            children: [
              const Icon(Icons.download_done_rounded, color: AppTheme.primary, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Téléchargement démarré : $label',
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          duration: const Duration(seconds: 3),
        ),
      );
    }
  }

  Widget _buildPlayerWidget({required double maxHeight}) {
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: maxHeight),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: Container(
          color: Colors.black,
          child: _isLoadingStream
              ? const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircularProgressIndicator(color: AppTheme.primary),
                      SizedBox(height: 10),
                      Text(
                        'Chargement du flux...',
                        style: TextStyle(color: Colors.white70, fontSize: 12),
                      ),
                    ],
                  ),
                )
              : _streamUnavailable
                  ? Container(
                      padding: const EdgeInsets.all(20),
                      alignment: Alignment.center,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.videocam_off_rounded, color: Colors.white38, size: 36),
                          const SizedBox(height: 8),
                          const Text(
                            'Flux indisponible pour le moment',
                            style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 10),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primary,
                              foregroundColor: Colors.white,
                              visualDensity: VisualDensity.compact,
                            ),
                            onPressed: _isSeries
                                ? () => _loadSeasonEpisodes(_selectedSeason)
                                : _resolveMovieStream,
                            icon: const Icon(Icons.refresh_rounded, size: 16),
                            label: const Text('Réessayer', style: TextStyle(fontSize: 12)),
                          ),
                        ],
                      ),
                    )
                  : _currentVideoUrl.isNotEmpty
                      ? AppVideoPlayer(
                          key: ValueKey(_currentVideoUrl),
                          videoUrl: _currentVideoUrl,
                          title: _currentMedia.title,
                          subtitle: _isSeries && _currentEpisodeNumber != null
                              ? 'S$_selectedSeason E$_currentEpisodeNumber - ${_currentEpisodeTitle ?? ''}'
                              : null,
                          autoPlay: true,
                        )
                      : const SizedBox.shrink(),
        ),
      ),
    );
  }

  Widget _buildDetailsContent() {
    return ListView(
      padding: const EdgeInsets.all(16.0),
      children: [
        // Titre Principal
        Text(
          _currentMedia.title,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w900,
            color: Colors.white,
            height: 1.2,
          ),
        ),

        const SizedBox(height: 10),

        // Badges (Note TMDB, Année, Qualité, Durée)
        Wrap(
          spacing: 8,
          runSpacing: 6,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            if (_currentMedia.rating != null && _currentMedia.rating!.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.amber.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.star_rounded, color: Colors.amber, size: 15),
                    const SizedBox(width: 4),
                    Text(
                      _currentMedia.rating!,
                      style: const TextStyle(color: Colors.amber, fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            if (_currentMedia.year != null && _currentMedia.year!.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  _currentMedia.year!,
                  style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600),
                ),
              ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: AppTheme.primary.withValues(alpha: 0.4)),
              ),
              child: Text(
                _currentMedia.quality ?? 'HD',
                style: const TextStyle(color: AppTheme.primary, fontSize: 11, fontWeight: FontWeight.w900),
              ),
            ),
            if (!_isSeries && _currentMedia.runtime != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  _formatRuntime(_currentMedia.runtime),
                  style: const TextStyle(color: Colors.white70, fontSize: 11),
                ),
              )
            else if (_isSeries && _currentMedia.numberOfSeasons != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '${_currentMedia.numberOfSeasons} Saison${_currentMedia.numberOfSeasons! > 1 ? 's' : ''}',
                  style: const TextStyle(color: Colors.white70, fontSize: 11),
                ),
              ),
          ],
        ),

        const SizedBox(height: 16),

        // Barre d'Actions (Ma Liste, Favoris, Télécharger, Partager)
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _buildActionButton(
                icon: Icons.download_rounded,
                label: 'Télécharger',
                activeColor: AppTheme.primary,
                onTap: () => _onDownload(),
              ),
              const SizedBox(width: 8),
              _buildActionButton(
                icon: _isWatchlist ? Icons.bookmark_rounded : Icons.bookmark_outline_rounded,
                label: 'Ma Liste',
                isActive: _isWatchlist,
                onTap: _toggleWatchlist,
              ),
              const SizedBox(width: 8),
              _buildActionButton(
                icon: _isFavorite ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                label: 'Favoris',
                isActive: _isFavorite,
                activeColor: Colors.redAccent,
                onTap: _toggleFavorite,
              ),
              const SizedBox(width: 8),
              _buildActionButton(
                icon: Icons.share_rounded,
                label: 'Partager',
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Lien de partage copié')),
                  );
                },
              ),
            ],
          ),
        ),

        // ── SECTION SÉRIES : SAISONS & PLAYLIST DES ÉPISODES ──
        if (_isSeries) ...[
          const SizedBox(height: 20),
          const Divider(color: Colors.white10),
          const SizedBox(height: 12),

          // Sélecteur de Saisons
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Épisodes & Saisons',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              if (_currentMedia.numberOfSeasons != null && _currentMedia.numberOfSeasons! > 1)
                DropdownButtonHideUnderline(
                  child: DropdownButton<int>(
                    value: _selectedSeason,
                    dropdownColor: AppTheme.card,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                    icon: const Icon(Icons.arrow_drop_down, color: AppTheme.primary),
                    items: List.generate(
                      _currentMedia.numberOfSeasons!,
                      (idx) => DropdownMenuItem(
                        value: idx + 1,
                        child: Text('Saison ${idx + 1}'),
                      ),
                    ),
                    onChanged: (val) {
                      if (val != null && val != _selectedSeason) {
                        setState(() => _selectedSeason = val);
                        _loadSeasonEpisodes(val);
                      }
                    },
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),

          if (_isLoadingEpisodes)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(20.0),
                child: CircularProgressIndicator(color: AppTheme.primary),
              ),
            )
          else if (_episodes.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16.0),
              child: Text(
                'Aucun épisode listé pour cette saison.',
                style: TextStyle(color: Colors.white54, fontSize: 12),
              ),
            )
          else
            ..._episodes.map((ep) {
              final isCurrent = ep.episodeNumber == _currentEpisodeNumber;

              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: isCurrent ? AppTheme.primary.withValues(alpha: 0.15) : AppTheme.card,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isCurrent ? AppTheme.primary : Colors.white.withValues(alpha: 0.05),
                    width: isCurrent ? 1.5 : 1,
                  ),
                ),
                child: Material(
                  color: Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                  child: ListTile(
                    dense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    leading: Stack(
                      alignment: Alignment.center,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: (ep.stillPath != null && ep.stillPath!.isNotEmpty)
                              ? CachedNetworkImage(
                                  imageUrl: ep.stillPath!,
                                  width: 75,
                                  height: 48,
                                  fit: BoxFit.cover,
                                  errorWidget: (context, url, error) => Container(
                                    width: 75,
                                    height: 48,
                                    color: Colors.white10,
                                    child: const Icon(Icons.movie, color: Colors.white24, size: 20),
                                  ),
                                )
                              : Container(
                                  width: 75,
                                  height: 48,
                                  color: Colors.white10,
                                  child: const Icon(Icons.movie, color: Colors.white24, size: 20),
                                ),
                        ),
                        if (isCurrent)
                          Container(
                            width: 26,
                            height: 26,
                            decoration: const BoxDecoration(
                              color: AppTheme.primary,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 18),
                          ),
                      ],
                    ),
                    title: Text(
                      '${ep.episodeNumber}. ${ep.episode}',
                      style: TextStyle(
                        color: isCurrent ? AppTheme.primary : Colors.white,
                        fontSize: 13,
                        fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      (ep.overview != null && ep.overview!.isNotEmpty)
                          ? ep.overview!
                          : (ep.runtime != null ? '${ep.runtime} min' : 'Épisode complet'),
                      style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.download_rounded, color: Colors.white60, size: 20),
                          tooltip: 'Télécharger cet épisode',
                          onPressed: () => _onDownload(episode: ep),
                        ),
                        if (isCurrent)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppTheme.primary,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text(
                              'EN COURS',
                              style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900),
                            ),
                          ),
                      ],
                    ),
                    onTap: () => _playEpisode(ep),
                  ),
                ),
              );
            }),
        ],

        const SizedBox(height: 20),
        const Divider(color: Colors.white10),
        const SizedBox(height: 12),

        // Genres
        if (_currentMedia.genres != null && _currentMedia.genres!.isNotEmpty) ...[
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: _currentMedia.genres!.map((g) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white10),
                ),
                child: Text(
                  g,
                  style: const TextStyle(color: Colors.white70, fontSize: 11),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 14),
        ],

        // Synopsis
        const Text(
          'Synopsis',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        const SizedBox(height: 6),
        Text(
          _currentMedia.description != null && _currentMedia.description!.isNotEmpty
              ? _currentMedia.description!
              : 'Aucun résumé détaillé disponible.',
          style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
        ),

        // Recommandations
        if (_currentMedia.recommendations != null && _currentMedia.recommendations!.isNotEmpty) ...[
          const SizedBox(height: 24),
          const Text(
            'Titres similaires recommandés',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 170,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: _currentMedia.recommendations!.length,
              itemBuilder: (context, index) {
                final rec = _currentMedia.recommendations![index];
                return GestureDetector(
                  onTap: () {
                    Navigator.pushReplacement(
                      context,
                      MaterialPageRoute(
                        builder: (_) => WatchScreen(item: rec),
                      ),
                    );
                  },
                  child: Container(
                    width: 110,
                    margin: const EdgeInsets.only(right: 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: rec.poster != null && rec.poster!.isNotEmpty
                              ? CachedNetworkImage(
                                  imageUrl: rec.poster!,
                                  height: 140,
                                  width: 110,
                                  fit: BoxFit.cover,
                                )
                              : Container(
                                  height: 140,
                                  width: 110,
                                  color: AppTheme.card,
                                  child: const Icon(Icons.movie, color: Colors.white24),
                                ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          rec.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],

        const SizedBox(height: 40),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isLandscape = constraints.maxWidth > constraints.maxHeight && constraints.maxWidth > 650;
            final maxPlayerHeight = isLandscape
                ? constraints.maxHeight - 56
                : min(constraints.maxWidth * 9 / 16, constraints.maxHeight * 0.45);

            return Column(
              children: [
                // ── TOP NAVIGATION BAR ──
                Container(
                  height: 48,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  color: const Color(0xFF0C0C0E),
                  child: Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 18),
                        onPressed: () => Navigator.pop(context),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              _currentMedia.title,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (_isSeries && _currentEpisodeNumber != null)
                              Text(
                                'Saison $_selectedSeason • Épisode $_currentEpisodeNumber ${_currentEpisodeTitle != null ? '($_currentEpisodeTitle)' : ''}',
                                style: const TextStyle(color: AppTheme.primary, fontSize: 11, fontWeight: FontWeight.w600),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // ── RESPONSIVE BODY (PORTRAIT: STACKED, LANDSCAPE: SIDE-BY-SIDE) ──
                Expanded(
                  child: isLandscape
                      ? Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Left Column: Player (16:9)
                            Expanded(
                              flex: 6,
                              child: Center(
                                child: _buildPlayerWidget(maxHeight: maxPlayerHeight),
                              ),
                            ),
                            // Right Column: Details & Episode Playlist
                            Expanded(
                              flex: 4,
                              child: _buildDetailsContent(),
                            ),
                          ],
                        )
                      : Column(
                          children: [
                            // Top: Constrained 16:9 Player
                            _buildPlayerWidget(maxHeight: maxPlayerHeight),
                            // Bottom: Scrollable Content
                            Expanded(
                              child: _buildDetailsContent(),
                            ),
                          ],
                        ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool isActive = false,
    Color? activeColor,
  }) {
    final effectiveColor = isActive ? (activeColor ?? AppTheme.primary) : Colors.white70;

    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isActive ? (activeColor ?? AppTheme.primary).withValues(alpha: 0.15) : AppTheme.card,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isActive ? (activeColor ?? AppTheme.primary).withValues(alpha: 0.3) : Colors.white10,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: effectiveColor, size: 16),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(color: effectiveColor, fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
