import 'dart:math';
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../models/media_item.dart';
import '../../models/user_model.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../services/feedback_service.dart';
import '../../widgets/download_modal.dart';
import '../../widgets/app_video_player.dart';
import '../../widgets/add_to_playlist_modal.dart';
import '../../config/theme.dart';

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
  final GlobalKey<AppVideoPlayerState> _playerKey = GlobalKey<AppVideoPlayerState>();

  late MediaItem _currentMedia;
  UserModel? _user;
  String _currentVideoUrl = '';
  String _selectedLanguage = 'fr'; // 'fr' (VF) ou 'vostfr' (VOSTFR)
  bool _isLoadingStream = true;
  bool _streamUnavailable = false;
  bool _isPlaying = true;

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

  // Tabs (0: Épisodes, 1: Titres similaires, 2: Bandes-annonces & Plus)
  int _selectedTabIndex = 0;

  bool _isFavorite = false;
  bool _isWatchlist = false;

  Duration? _savedResumePosition;
  Duration? _currentDuration;
  Duration? _currentPosition;
  DateTime _lastProgressSaveTime = DateTime.now();

  @override
  void initState() {
    super.initState();
    _currentMedia = widget.item;
    _selectedSeason = widget.initialSeason ?? 1;
    _currentEpisodeNumber = widget.initialEpisode ?? 1;

    _loadUser();
    _checkFavoriteAndWatchlist();
    _loadMediaDetails();
    _loadSavedProgress();

    if (_isSeries) {
      _loadSeasonEpisodes(_selectedSeason);
    } else {
      _resolveMovieStream();
    }
  }

  Future<void> _loadUser() async {
    final user = await _storage.getUser();
    if (mounted) {
      setState(() => _user = user);
    }
  }

  Future<void> _checkFavoriteAndWatchlist() async {
    final fav = await _storage.isFavorite(_currentMedia.id);
    final wl = await _storage.isWatchlist(_currentMedia.id);
    if (mounted) {
      setState(() {
        _isFavorite = fav;
        _isWatchlist = wl;
      });
    }
  }

  void _toggleFavorite() async {
    await FeedbackService.feedbackLike();
    setState(() => _isFavorite = !_isFavorite);
    await _storage.toggleFavorite(_currentMedia.toJson());
    _apiService.toggleFavorite(_currentMedia.id, type: _currentMedia.type);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isFavorite ? 'Ajouté aux favoris' : 'Retiré des favoris'),
          duration: const Duration(seconds: 1),
        ),
      );
    }
  }

  void _toggleWatchlist() async {
    await FeedbackService.feedbackPlaylist();
    setState(() => _isWatchlist = !_isWatchlist);
    await _storage.toggleWatchlist(_currentMedia.toJson());
    _apiService.toggleWatchLater(_currentMedia.id);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isWatchlist ? 'Ajouté à Ma Liste' : 'Retiré de Ma Liste'),
          duration: const Duration(seconds: 1),
        ),
      );
    }
  }

  Future<void> _loadSavedProgress() async {
    final saved = await _storage.getProgress(_currentMedia.id);
    if (saved != null && saved['positionMs'] != null) {
      final ms = saved['positionMs'] as int;
      final durMs = saved['durationMs'] as int?;
      if (ms > 5000) {
        if (mounted) {
          setState(() {
            _savedResumePosition = Duration(milliseconds: ms);
            _currentPosition = Duration(milliseconds: ms);
            if (durMs != null && durMs > 0) {
              _currentDuration = Duration(milliseconds: durMs);
            }
          });
        }
      }
    }
  }

  void _onPlaybackProgress(Duration pos, Duration dur) {
    if (dur <= Duration.zero) return;
    setState(() {
      _currentPosition = pos;
      _currentDuration = dur;
    });

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

  List<MediaItem> _similarTitles = [];

  Future<void> _loadMediaDetails() async {
    final detail = await _apiService.getMediaDetail(_currentMedia.id, isSeries: _isSeries);
    if (detail != null && mounted) {
      List<MediaItem> recs = detail.recommendations ?? [];
      if (recs.length < 15) {
        try {
          final extra = _isSeries
              ? await _apiService.getPopularSeries(page: 1)
              : await _apiService.getPopularMovies(page: 1);
          final existingIds = {detail.id, ...recs.map((r) => r.id)};
          final additional = extra.where((m) => !existingIds.contains(m.id)).toList();
          recs = [...recs, ...additional];
        } catch (_) {}
      }
      setState(() {
        _currentMedia = detail;
        _similarTitles = recs.take(15).toList();
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

    final url = await _apiService.getMovieStreamUrl(
      _currentMedia.id,
      _currentMedia.title,
      language: _selectedLanguage,
    );
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

  void _onLanguageChanged(String lang) {
    if (_selectedLanguage == lang) return;
    setState(() {
      _selectedLanguage = lang;
    });
    if (_isSeries) {
      if (_episodes.isNotEmpty) {
        final ep = _episodes.firstWhere(
          (e) => e.episodeNumber == _currentEpisodeNumber,
          orElse: () => _episodes.first,
        );
        _playEpisode(ep);
      }
    } else {
      _resolveMovieStream();
    }
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
      language: _selectedLanguage,
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

  bool get _hasNextEpisode {
    if (!_isSeries || _episodes.isEmpty || _currentEpisodeNumber == null) return false;
    final currentIndex = _episodes.indexWhere((e) => e.episodeNumber == _currentEpisodeNumber);
    return currentIndex != -1 && currentIndex < _episodes.length - 1;
  }

  bool get _hasPrevEpisode {
    if (!_isSeries || _episodes.isEmpty || _currentEpisodeNumber == null) return false;
    final currentIndex = _episodes.indexWhere((e) => e.episodeNumber == _currentEpisodeNumber);
    return currentIndex > 0;
  }

  void _goToNextEpisode() {
    if (!_hasNextEpisode) return;
    final currentIndex = _episodes.indexWhere((e) => e.episodeNumber == _currentEpisodeNumber);
    if (currentIndex != -1 && currentIndex < _episodes.length - 1) {
      _playEpisode(_episodes[currentIndex + 1]);
    }
  }

  void _goToPrevEpisode() {
    if (!_hasPrevEpisode) return;
    final currentIndex = _episodes.indexWhere((e) => e.episodeNumber == _currentEpisodeNumber);
    if (currentIndex > 0) {
      _playEpisode(_episodes[currentIndex - 1]);
    }
  }

  String _formatRuntime(int? minutes) {
    if (minutes == null || minutes <= 0) return '';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    if (h > 0) return '$h h ${m > 0 ? '$m min' : ''}'.trim();
    return '$m min';
  }

  Widget _buildLanguagePill(String lang, String label) {
    final isSelected = _selectedLanguage == lang;
    return GestureDetector(
      onTap: () => _onLanguageChanged(lang),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : Colors.white60,
            fontSize: 11.5,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          ),
        ),
      ),
    );
  }

  void _onDownload({EpisodeItem? episode}) {
    DownloadModal.show(
      context: context,
      item: _currentMedia,
      user: _user,
      episode: episode,
      seasonNumber: _selectedSeason,
      streamUrl: _currentVideoUrl.isNotEmpty ? _currentVideoUrl : null,
    );
  }

  void _showSeasonPickerModal(List<SeasonItem> seasons) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF141416),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
                  child: Text(
                    'Sélectionner une saison',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const Divider(color: Colors.white12),
                Flexible(
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: seasons.length,
                    itemBuilder: (context, index) {
                      final season = seasons[index];
                      final isSelected = _selectedSeason == season.seasonNumber;
                      final sName = season.name.isNotEmpty
                          ? season.name
                          : 'Saison ${season.seasonNumber}';

                      return ListTile(
                        leading: FaIcon(
                          FontAwesomeIcons.film,
                          color: isSelected ? AppTheme.primary : Colors.white38,
                          size: 16,
                        ),
                        title: Text(
                          sName,
                          style: TextStyle(
                            color: isSelected ? Colors.white : Colors.white70,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                        trailing: Text(
                          '${season.episodeCount} épisodes',
                          style: const TextStyle(color: Colors.white38, fontSize: 12),
                        ),
                        selected: isSelected,
                        onTap: () {
                          Navigator.pop(context);
                          if (!isSelected) {
                            setState(() => _selectedSeason = season.seasonNumber);
                            _loadSeasonEpisodes(season.seasonNumber);
                          }
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
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
                      CircularProgressIndicator(color: AppTheme.primary, strokeWidth: 2.5),
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
                          const FaIcon(FontAwesomeIcons.videoSlash, color: Colors.white38, size: 36),
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
                            icon: const FaIcon(FontAwesomeIcons.arrowsRotate, size: 14),
                            label: const Text('Réessayer', style: TextStyle(fontSize: 12)),
                          ),
                        ],
                      ),
                    )
                  : _currentVideoUrl.isNotEmpty
                      ? AppVideoPlayer(
                          key: _playerKey,
                          videoUrl: _currentVideoUrl,
                          title: _currentMedia.title,
                          subtitle: _isSeries && _currentEpisodeNumber != null
                              ? 'S$_selectedSeason E$_currentEpisodeNumber - ${_currentEpisodeTitle ?? ''}'
                              : null,
                          initialPosition: _savedResumePosition,
                          onProgress: _onPlaybackProgress,
                          onPlayingChanged: (playing) {
                            if (mounted) {
                              setState(() => _isPlaying = playing);
                            }
                          },
                          autoPlay: true,
                          hasNextEpisode: _hasNextEpisode,
                          hasPrevEpisode: _hasPrevEpisode,
                          onNextEpisode: _hasNextEpisode ? _goToNextEpisode : null,
                          onPrevEpisode: _hasPrevEpisode ? _goToPrevEpisode : null,
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

    final seasonCount = _currentMedia.numberOfSeasons ?? validSeasons.length;
    final castNames = _currentMedia.cast?.take(4).map((c) => c.name).join(', ') ?? '';

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      children: [
        // ── 1. TITRE DU MÉDIA (SANS LE MOT CHILLERS) ──
        Text(
          _currentMedia.title,
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w900,
            color: Colors.white,
            letterSpacing: -0.3,
          ),
        ),

        const SizedBox(height: 8),

        // ── METADATA ROW ──
        Row(
          children: [
            // Year
            Text(
              _currentMedia.year != null && _currentMedia.year!.isNotEmpty ? _currentMedia.year! : '2025',
              style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600),
            ),
            const SizedBox(width: 8),

            // 18+ Outline Pill
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white30, width: 0.8),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                '18+',
                style: TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(width: 8),

            // Seasons / Runtime
            Text(
              _isSeries
                  ? (seasonCount > 1 ? '$seasonCount Seasons' : '1 Season')
                  : (_currentMedia.runtime != null ? _formatRuntime(_currentMedia.runtime) : '1 h 45 min'),
              style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600),
            ),
            const SizedBox(width: 8),

            // HD Badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white30, width: 0.8),
                borderRadius: BorderRadius.circular(3),
              ),
              child: const Text(
                'HD',
                style: TextStyle(color: Colors.white70, fontSize: 9.5, fontWeight: FontWeight.w900),
              ),
            ),
            const SizedBox(width: 8),

            // Audio / Subtitles icon badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white30, width: 0.8),
                borderRadius: BorderRadius.circular(3),
              ),
              child: Text(
                _selectedLanguage == 'fr' ? 'VF' : 'VOSTFR',
                style: const TextStyle(color: Colors.white70, fontSize: 9.5, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),

        const SizedBox(height: 12),

        // ── SÉLECTEUR DE VERSION AUDIO (VF / VOSTFR) ──
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0xFF18181C),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.white12),
          ),
          child: Row(
            children: [
              const FaIcon(
                FontAwesomeIcons.language,
                size: 13,
                color: AppTheme.primary,
              ),
              const SizedBox(width: 8),
              const Text(
                'Version audio :',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              Container(
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(8),
                ),
                padding: const EdgeInsets.all(2),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildLanguagePill('fr', '🇫🇷 VF'),
                    _buildLanguagePill('vostfr', '🌐 VOSTFR'),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // ── BOUTONS PRINCIPAUX EN GRILLE DE 2 (CÔTE À CÔTE) ──
        Row(
          children: [
            // 1. Bouton Blanc Synchronisé "Lecture" / "Pause" / "Reprendre"
            Expanded(
              child: SizedBox(
                height: 44,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: Colors.black,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                  icon: FaIcon(
                    _isPlaying ? FontAwesomeIcons.pause : FontAwesomeIcons.play,
                    size: 13,
                    color: Colors.black,
                  ),
                  label: Text(
                    _isPlaying
                        ? 'Pause'
                        : (_savedResumePosition != null || (_currentPosition != null && _currentPosition! > Duration.zero)
                            ? 'Reprendre'
                            : 'Lecture'),
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                    overflow: TextOverflow.ellipsis,
                  ),
                  onPressed: () {
                    if (_currentVideoUrl.isNotEmpty && _playerKey.currentState != null) {
                      _playerKey.currentState!.togglePlayPause();
                    } else {
                      if (_isSeries && _episodes.isNotEmpty) {
                        final currentEp = _episodes.firstWhere(
                          (e) => e.episodeNumber == _currentEpisodeNumber,
                          orElse: () => _episodes.first,
                        );
                        _playEpisode(currentEp);
                      } else {
                        _resolveMovieStream();
                      }
                    }
                  },
                ),
              ),
            ),

            const SizedBox(width: 10),

            // 2. Bouton Gris "Télécharger"
            Expanded(
              child: SizedBox(
                height: 44,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF262626),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                  icon: const FaIcon(FontAwesomeIcons.download, size: 13, color: Colors.white),
                  label: const Text(
                    'Télécharger',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                    overflow: TextOverflow.ellipsis,
                  ),
                  onPressed: () => _onDownload(),
                ),
              ),
            ),
          ],
        ),

        const SizedBox(height: 14),

        // ── TITRE ÉPISODE COURANT (SI SÉRIE) ──
        if (_isSeries && _currentEpisodeNumber != null) ...[
          Text(
            _currentEpisodeTitle != null && _currentEpisodeTitle!.isNotEmpty
                ? 'Épisode $_currentEpisodeNumber : $_currentEpisodeTitle'
                : 'Épisode $_currentEpisodeNumber',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
        ],

        // ── SYNOPSIS & CASTING ──
        Text(
          _currentMedia.description != null && _currentMedia.description!.isNotEmpty
              ? _currentMedia.description!
              : 'Aucune description disponible pour ce programme.',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12.5,
            height: 1.4,
          ),
        ),

        if (castNames.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(
            'Distribution : $castNames',
            style: const TextStyle(color: Colors.white54, fontSize: 11.5),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],

        const SizedBox(height: 18),

        // ── 3. BOUTONS D'ACTION (AVEC COEUR POUR J'AIME) ──
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildIconAction(
              icon: _isWatchlist ? Icons.check : Icons.add,
              label: 'Ma Liste',
              isActive: _isWatchlist,
              onTap: _toggleWatchlist,
            ),
            _buildIconAction(
              icon: _isFavorite ? Icons.favorite : Icons.favorite_border_rounded,
              label: 'J\'aime',
              isActive: _isFavorite,
              onTap: _toggleFavorite,
            ),
            _buildIconAction(
              icon: Icons.send_rounded,
              label: 'Partager',
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Lien copié dans le presse-papiers')),
                );
              },
            ),
            _buildIconAction(
              icon: Icons.playlist_add_rounded,
              label: 'Playlist',
              onTap: () => AddToPlaylistModal.show(context, _currentMedia),
            ),
          ],
        ),

        const SizedBox(height: 20),
        const Divider(color: Colors.white12, height: 1),
        const SizedBox(height: 12),

        // ── 4. ONGLETS (ÉPISODES & TITRES SIMILAIRES UNIQUEMENT - BANDE-ANNONCE SUPPRIMÉE) ──
        Row(
          children: [
            if (_isSeries) ...[
              _buildTabItem(title: 'Épisodes', index: 0),
              const SizedBox(width: 24),
            ],
            _buildTabItem(title: 'Titres similaires', index: 1),
          ],
        ),

        const SizedBox(height: 16),

        // ── CONTENU DE L'ONGLET SÉLECTIONNÉ ──
        if (_isSeries && _selectedTabIndex == 0) ...[
          // Header Saison Dropdown
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              GestureDetector(
                onTap: () {
                  if (validSeasons.isNotEmpty) {
                    _showSeasonPickerModal(validSeasons);
                  }
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    color: const Color(0xFF262626),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        validSeasons.any((s) => s.seasonNumber == _selectedSeason)
                            ? validSeasons.firstWhere((s) => s.seasonNumber == _selectedSeason).name
                            : 'Saison $_selectedSeason',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Icon(Icons.keyboard_arrow_down, color: Colors.white, size: 18),
                    ],
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.info_outline, color: Colors.white54, size: 20),
                onPressed: () {},
              ),
            ],
          ),

          const SizedBox(height: 14),

          // Liste des Épisodes
          if (_isLoadingEpisodes)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40.0),
              child: Center(
                child: CircularProgressIndicator(color: AppTheme.primary, strokeWidth: 2),
              ),
            )
          else if (_episodes.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24.0),
              child: Center(
                child: Text(
                  'Aucun épisode disponible pour cette saison.',
                  style: TextStyle(color: Colors.white38, fontSize: 13),
                ),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _episodes.length,
              separatorBuilder: (context, index) => const SizedBox(height: 18),
              itemBuilder: (context, index) {
                final ep = _episodes[index];
                final isCurrent = ep.episodeNumber == _currentEpisodeNumber;
                final thumb = ep.stillPath ?? _currentMedia.backdrop ?? _currentMedia.poster ?? '';
                final epTitle = ep.title != null && ep.title!.isNotEmpty
                    ? ep.title!
                    : (ep.episode.isNotEmpty ? ep.episode : 'Épisode ${ep.episodeNumber}');

                return GestureDetector(
                  onTap: () => _playEpisode(ep),
                  behavior: HitTestBehavior.opaque,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          // Vignette 16:9
                          ClipRRect(
                            borderRadius: BorderRadius.circular(6),
                            child: Container(
                              width: 120,
                              height: 68,
                              color: const Color(0xFF1C1C1E),
                              child: Stack(
                                fit: StackFit.expand,
                                children: [
                                  if (thumb.isNotEmpty)
                                    CachedNetworkImage(
                                      imageUrl: thumb,
                                      fit: BoxFit.cover,
                                      errorWidget: (context, url, error) => Container(
                                        color: const Color(0xFF1C1C1E),
                                        child: const Center(
                                          child: FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 18),
                                        ),
                                      ),
                                    )
                                  else
                                    const Center(
                                      child: FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 18),
                                    ),

                                  // Play icon center
                                  Center(
                                    child: Container(
                                      width: 26,
                                      height: 26,
                                      decoration: BoxDecoration(
                                        color: isCurrent
                                            ? AppTheme.primary
                                            : Colors.black.withValues(alpha: 0.55),
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: isCurrent ? AppTheme.primary : Colors.white70,
                                          width: 1,
                                        ),
                                      ),
                                      child: const Center(
                                        child: Padding(
                                          padding: EdgeInsets.only(left: 2.0),
                                          child: FaIcon(FontAwesomeIcons.play, color: Colors.white, size: 10),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),

                          const SizedBox(width: 12),

                          // Titre & Durée
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${ep.episodeNumber}. $epTitle',
                                  style: TextStyle(
                                    color: isCurrent ? AppTheme.primary : Colors.white,
                                    fontSize: 13.5,
                                    fontWeight: isCurrent ? FontWeight.bold : FontWeight.w600,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  ep.runtime != null ? '${ep.runtime} min' : '45 min',
                                  style: const TextStyle(color: Colors.white38, fontSize: 11),
                                ),
                              ],
                            ),
                          ),

                          // Download button
                          IconButton(
                            icon: const FaIcon(FontAwesomeIcons.download, color: Colors.white70, size: 16),
                            tooltip: 'Télécharger cet épisode',
                            onPressed: () => _onDownload(episode: ep),
                          ),
                        ],
                      ),

                      // Synopsis épisode en dessous
                      const SizedBox(height: 6),
                      Text(
                        ep.overview != null && ep.overview!.trim().isNotEmpty
                            ? ep.overview!
                            : 'Aucun résumé disponible pour cet épisode.',
                        style: const TextStyle(color: Colors.white54, fontSize: 11.5, height: 1.35),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                );
              },
            ),
        ] else ...[
          // ── 5. TITRES SIMILAIRES (15 TITRES EN GRILLE 3 COLONNES) ──
          Builder(
            builder: (context) {
              final displayRecs = _similarTitles.isNotEmpty
                  ? _similarTitles
                  : (_currentMedia.recommendations?.take(15).toList() ?? []);

              if (displayRecs.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 30.0),
                  child: Center(
                    child: Text('Aucun titre similaire disponible.', style: TextStyle(color: Colors.white38)),
                  ),
                );
              }

              return GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: displayRecs.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                  childAspectRatio: 0.68,
                ),
                itemBuilder: (context, index) {
                  final rec = displayRecs[index];
                  return GestureDetector(
                    onTap: () {
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(
                          builder: (_) => WatchScreen(item: rec),
                        ),
                      );
                    },
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: rec.poster != null && rec.poster!.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: rec.poster!,
                              fit: BoxFit.cover,
                              placeholder: (context, url) => Container(color: const Color(0xFF1C1C1E)),
                              errorWidget: (context, url, error) => Container(
                                color: const Color(0xFF1C1C1E),
                                child: const Center(
                                  child: FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 20),
                                ),
                              ),
                            )
                          : Container(color: const Color(0xFF1C1C1E)),
                    ),
                  );
                },
              );
            },
          ),
        ],

        const SizedBox(height: 40),
      ],
    );
  }

  Widget _buildIconAction({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool isActive = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            color: isActive ? AppTheme.primary : Colors.white,
            size: 20,
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: TextStyle(
              color: isActive ? AppTheme.primary : Colors.white70,
              fontSize: 10.5,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabItem({required String title, required int index}) {
    final isSelected = _selectedTabIndex == index;

    return GestureDetector(
      onTap: () => setState(() => _selectedTabIndex = index),
      behavior: HitTestBehavior.opaque,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: isSelected ? Colors.white : Colors.white54,
              fontSize: 13.5,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            ),
          ),
          const SizedBox(height: 6),
          Container(
            height: 3,
            width: isSelected ? 30 : 0,
            decoration: BoxDecoration(
              color: AppTheme.primary,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF000000),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isLandscape = constraints.maxWidth > constraints.maxHeight && constraints.maxWidth > 650;
            final maxPlayerHeight = isLandscape
                ? constraints.maxHeight - 56
                : min(constraints.maxWidth * 9 / 16, constraints.maxHeight * 0.42);

            return Column(
              children: [
                // ── TOP PLAYER WITH EMBEDDED CLOSE BUTTON ──
                Stack(
                  children: [
                    _buildPlayerWidget(maxHeight: maxPlayerHeight),
                    Positioned(
                      top: 8,
                      right: 8,
                      child: GestureDetector(
                        onTap: () => Navigator.pop(context),
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.6),
                            shape: BoxShape.circle,
                          ),
                          child: const FaIcon(FontAwesomeIcons.xmark, color: Colors.white, size: 14),
                        ),
                      ),
                    ),
                  ],
                ),

                // ── RESPONSIVE DETAILS BODY ──
                Expanded(
                  child: _buildDetailsContent(),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
