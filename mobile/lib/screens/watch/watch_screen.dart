import 'dart:math';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../widgets/download_modal.dart';
import '../../widgets/app_video_player.dart';
import '../../widgets/add_to_playlist_modal.dart';

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
  final StorageService _storage = StorageService();

  late MediaItem _currentMedia;
  String _currentVideoUrl = '';
  bool _isLoadingStream = true;
  bool _streamUnavailable = false;

  // Séries & Épisodes
  bool get _isSeries =>
      _currentMedia.type == 'serie' ||
      _currentMedia.type == 'series' ||
      _currentMedia.type == 'tv' ||
      _currentMedia.type == 'anime' ||
      (_currentMedia.numberOfSeasons != null && _currentMedia.numberOfSeasons! > 0);
  int _selectedSeason = 1;
  int? _currentEpisodeNumber;
  String? _currentEpisodeTitle;
  List<EpisodeItem> _episodes = [];
  bool _isLoadingEpisodes = false;

  // Audio, Serveurs & Reprise
  String _selectedAudioVersion = 'VF';
  String _selectedServer = 'VIP Ultra 4K (Fast CDN)';
  Duration? _savedResumePosition;
  DateTime _lastProgressSaveTime = DateTime.now();

  @override
  void initState() {
    super.initState();
    _currentMedia = widget.item;
    _selectedSeason = widget.initialSeason ?? 1;
    _currentEpisodeNumber = widget.initialEpisode ?? 1;

    _loadMediaDetails();
    _loadSavedProgress();

    if (_isSeries) {
      _loadSeasonEpisodes(_selectedSeason);
    } else {
      _resolveMovieStream();
    }
  }

  Future<void> _loadSavedProgress() async {
    final saved = await _storage.getProgress(_currentMedia.id);
    if (saved != null && saved['positionMs'] != null) {
      final ms = saved['positionMs'] as int;
      if (ms > 5000) {
        if (mounted) {
          setState(() {
            _savedResumePosition = Duration(milliseconds: ms);
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: AppTheme.card,
              content: Row(
                children: [
                  const Icon(Icons.history_rounded, color: AppTheme.primary, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Reprise de lecture à ${_formatDuration(_savedResumePosition!)}',
                      style: const TextStyle(color: Colors.white, fontSize: 12),
                    ),
                  ),
                ],
              ),
              duration: const Duration(seconds: 3),
            ),
          );
        }
      }
    }
  }

  void _onPlaybackProgress(Duration pos, Duration dur) {
    if (dur <= Duration.zero) return;
    final now = DateTime.now();
    if (now.difference(_lastProgressSaveTime).inSeconds >= 4) {
      _lastProgressSaveTime = now;
      _storage.saveWatchProgress(
        id: _currentMedia.id,
        title: _currentMedia.title,
        poster: _currentMedia.poster ?? '',
        positionMs: pos.inMilliseconds,
        durationMs: dur.inMilliseconds,
        type: _currentMedia.type,
        season: _isSeries ? _selectedSeason : null,
        episode: _isSeries ? _currentEpisodeNumber : null,
        streamUrl: _currentVideoUrl,
      );
    }
  }

  String _formatDuration(Duration d) {
    final m = d.inMinutes;
    final s = d.inSeconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
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

  String _formatRuntime(int? minutes) {
    if (minutes == null || minutes <= 0) return '';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    if (h > 0) return '$h h ${m > 0 ? '$m min' : ''}'.trim();
    return '$m min';
  }

  void _onDownload({EpisodeItem? episode}) {
    DownloadModal.show(
      context: context,
      item: _currentMedia,
      episode: episode,
      seasonNumber: _selectedSeason,
      streamUrl: _currentVideoUrl.isNotEmpty ? _currentVideoUrl : null,
    );
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
                          key: ValueKey('$_currentVideoUrl-$_selectedAudioVersion-$_selectedServer'),
                          videoUrl: _currentVideoUrl,
                          title: _currentMedia.title,
                          subtitle: _isSeries && _currentEpisodeNumber != null
                              ? 'S$_selectedSeason E$_currentEpisodeNumber - ${_currentEpisodeTitle ?? ''}'
                              : null,
                          initialPosition: _savedResumePosition,
                          onProgress: _onPlaybackProgress,
                          autoPlay: true,
                        )
                      : const SizedBox.shrink(),
        ),
      ),
    );
  }

  Widget _buildDetailsContent() {
    final validSeasons = _currentMedia.seasons?.where((s) => s.seasonNumber > 0).toList() ??
        _currentMedia.seasons ??
        [];

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
            else if (_isSeries)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '${validSeasons.isNotEmpty ? validSeasons.length : (_currentMedia.numberOfSeasons ?? 1)} Saison${(validSeasons.length > 1 || (_currentMedia.numberOfSeasons ?? 1) > 1) ? 's' : ''}',
                  style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
          ],
        ),

        const SizedBox(height: 16),

        // Barre d'Actions (Télécharger, Serveurs & Audio, Playlist, Partager)
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
                icon: Icons.tune_rounded,
                label: '$_selectedAudioVersion • Serveurs',
                onTap: _showServerAndAudioModal,
              ),
              const SizedBox(width: 8),
              _buildActionButton(
                icon: Icons.playlist_add_rounded,
                label: 'Playlist',
                onTap: () => AddToPlaylistModal.show(context, _currentMedia),
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
              if (validSeasons.length > 1 || (_currentMedia.numberOfSeasons != null && _currentMedia.numberOfSeasons! > 1))
                DropdownButtonHideUnderline(
                  child: DropdownButton<int>(
                    value: _selectedSeason,
                    dropdownColor: AppTheme.card,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                    icon: const Icon(Icons.arrow_drop_down, color: AppTheme.primary),
                    items: (validSeasons.isNotEmpty
                            ? validSeasons.map((s) => s.seasonNumber).toList()
                            : List.generate(_currentMedia.numberOfSeasons ?? 1, (i) => i + 1))
                        .map(
                          (sNum) => DropdownMenuItem<int>(
                            value: sNum,
                            child: Text('Saison $sNum'),
                          ),
                        )
                        .toList(),
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
          const SizedBox(height: 10),

          // Horizontal Season Chips for quick tap
          if (validSeasons.isNotEmpty && validSeasons.length > 1)
            SizedBox(
              height: 34,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: validSeasons.length,
                itemBuilder: (context, index) {
                  final season = validSeasons[index];
                  final isSelected = _selectedSeason == season.seasonNumber;

                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text(season.name.isNotEmpty ? season.name : 'Saison ${season.seasonNumber}'),
                      selected: isSelected,
                      selectedColor: AppTheme.primary,
                      backgroundColor: AppTheme.card,
                      labelStyle: TextStyle(
                        color: isSelected ? Colors.white : Colors.white70,
                        fontSize: 11,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      ),
                      side: BorderSide(
                        color: isSelected ? AppTheme.primary : Colors.white.withValues(alpha: 0.08),
                      ),
                      onSelected: (_) {
                        if (_selectedSeason != season.seasonNumber) {
                          setState(() => _selectedSeason = season.seasonNumber);
                          _loadSeasonEpisodes(season.seasonNumber);
                        }
                      },
                    ),
                  );
                },
              ),
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

              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Material(
                  color: isCurrent ? AppTheme.primary.withValues(alpha: 0.15) : AppTheme.card,
                  borderRadius: BorderRadius.circular(12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(
                      color: isCurrent ? AppTheme.primary : Colors.white.withValues(alpha: 0.05),
                      width: isCurrent ? 1.5 : 1,
                    ),
                  ),
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
    final themeColor = activeColor ?? AppTheme.primary;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isActive ? themeColor.withValues(alpha: 0.25) : AppTheme.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isActive ? themeColor : Colors.white10,
            width: isActive ? 1.5 : 1,
          ),
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: themeColor.withValues(alpha: 0.35),
                    blurRadius: 10,
                    spreadRadius: 1,
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              color: isActive ? themeColor : Colors.white70,
              size: 18,
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                color: isActive ? Colors.white : Colors.white70,
                fontSize: 12,
                fontWeight: isActive ? FontWeight.w900 : FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showServerAndAudioModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              decoration: const BoxDecoration(
                color: AppTheme.card,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.white24,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Pistes Audio & Serveurs',
                        style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close_rounded, color: Colors.white70),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Sélecteur VF / VOSTFR
                  const Text('Langue & Sous-titres', style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: ChoiceChip(
                          avatar: const Icon(Icons.record_voice_over_rounded, size: 16),
                          label: const Text('VF (Français)'),
                          selected: _selectedAudioVersion == 'VF',
                          selectedColor: AppTheme.primary,
                          onSelected: (val) {
                            if (val) {
                              setState(() => _selectedAudioVersion = 'VF');
                              setModalState(() {});
                            }
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ChoiceChip(
                          avatar: const Icon(Icons.subtitles_rounded, size: 16),
                          label: const Text('VOSTFR (Sous-titré)'),
                          selected: _selectedAudioVersion == 'VOSTFR',
                          selectedColor: AppTheme.primary,
                          onSelected: (val) {
                            if (val) {
                              setState(() => _selectedAudioVersion = 'VOSTFR');
                              setModalState(() {});
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Sélecteur de Serveurs
                  const Text('Serveur de Streaming', style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  _buildServerTile('VIP Ultra 4K (Fast CDN)', 'Ultra rapide sans mise en mémoire tampon', Icons.bolt_rounded, Colors.amber, setModalState),
                  _buildServerTile('Serveur VidLink (Direct MP4)', 'Lecteur direct fluide', Icons.speed_rounded, Colors.cyanAccent, setModalState),
                  _buildServerTile('Serveur Secours (FrenchStream)', 'Source alternative haute résolution', Icons.cloud_sync_rounded, Colors.blueAccent, setModalState),
                  const SizedBox(height: 12),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildServerTile(String name, String desc, IconData icon, Color color, StateSetter setModalState) {
    final isSelected = _selectedServer == name;
    return GestureDetector(
      onTap: () {
        setState(() => _selectedServer = name);
        setModalState(() {});
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppTheme.card,
            content: Text('Basculé sur $name ($_selectedAudioVersion)'),
            duration: const Duration(seconds: 2),
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primary.withValues(alpha: 0.15) : Colors.white.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isSelected ? AppTheme.primary : Colors.white10),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: TextStyle(color: isSelected ? Colors.white : Colors.white70, fontWeight: FontWeight.bold, fontSize: 13)),
                  Text(desc, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
                ],
              ),
            ),
            if (isSelected)
              const Icon(Icons.check_circle_rounded, color: AppTheme.primary, size: 18),
          ],
        ),
      ),
    );
  }
}
