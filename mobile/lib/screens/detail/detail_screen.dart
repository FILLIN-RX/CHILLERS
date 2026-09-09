import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';
import '../../services/api_service.dart';
import '../../services/download_service.dart';
import '../watch/watch_screen.dart';

class DetailScreen extends StatefulWidget {
  final MediaItem item;

  const DetailScreen({super.key, required this.item});

  @override
  State<DetailScreen> createState() => _DetailScreenState();
}

class _DetailScreenState extends State<DetailScreen> {
  final ApiService _apiService = ApiService();

  late MediaItem _currentMedia;

  // Gestion des séries / saisons
  SeasonItem? _selectedSeason;
  List<EpisodeItem> _episodes = [];
  bool _isLoadingSeason = false;

  bool _isFavorite = false;
  bool _isWatchlist = false;

  @override
  void initState() {
    super.initState();
    _currentMedia = widget.item;
    _loadFullDetails();
  }

  bool get _isSeries => _currentMedia.type == 'series' || _currentMedia.type == 'tv' || _currentMedia.type == 'anime';

  Future<void> _loadFullDetails() async {
    final detail = await _apiService.getMediaDetail(_currentMedia.id, isSeries: _isSeries);
    if (detail != null && mounted) {
      setState(() {
        _currentMedia = detail;
        if (_isSeries && detail.seasons != null && detail.seasons!.isNotEmpty) {
          _selectedSeason = detail.seasons!.first;
          _loadSeasonEpisodes(_selectedSeason!.seasonNumber);
        }
      });
    }
  }

  Future<void> _loadSeasonEpisodes(int seasonNumber) async {
    setState(() => _isLoadingSeason = true);
    final episodes = await _apiService.getSeasonEpisodes(_currentMedia.id, seasonNumber);
    if (mounted) {
      setState(() {
        _episodes = episodes;
        _isLoadingSeason = false;
      });
    }
  }

  void _onPlayMovie() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => WatchScreen(item: _currentMedia),
      ),
    );
  }

  void _onPlayEpisode(EpisodeItem episode) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => WatchScreen(
          item: _currentMedia,
          initialSeason: episode.season,
          initialEpisode: episode.episodeNumber,
          initialVideoUrl: episode.streamUrl.isNotEmpty ? episode.streamUrl : null,
        ),
      ),
    );
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
      seasonNumber: _selectedSeason?.seasonNumber ?? 1,
    );
    if (mounted) {
      final label = episode != null
          ? '${_currentMedia.title} (S${_selectedSeason?.seasonNumber ?? 1}:E${episode.episodeNumber})'
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
                  'Téléchargement ajouté : $label',
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

  @override
  Widget build(BuildContext context) {
    final backdropUrl = _currentMedia.backdrop ?? _currentMedia.poster ?? '';

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: CustomScrollView(
        slivers: [
          // APP BAR AVEC HERO BANNER
          SliverAppBar(
            expandedHeight: 340,
            pinned: true,
            backgroundColor: AppTheme.background,
            leading: Padding(
              padding: const EdgeInsets.all(8.0),
              child: CircleAvatar(
                backgroundColor: Colors.black54,
                child: IconButton(
                  icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 18),
                  onPressed: () => Navigator.pop(context),
                ),
              ),
            ),
            actions: [
              Padding(
                padding: const EdgeInsets.only(right: 8.0),
                child: CircleAvatar(
                  backgroundColor: Colors.black54,
                  child: IconButton(
                    icon: Icon(
                      _isWatchlist ? Icons.bookmark_rounded : Icons.bookmark_outline_rounded,
                      color: _isWatchlist ? AppTheme.primary : Colors.white,
                      size: 20,
                    ),
                    onPressed: _toggleWatchlist,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(right: 12.0),
                child: CircleAvatar(
                  backgroundColor: Colors.black54,
                  child: IconButton(
                    icon: Icon(
                      _isFavorite ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                      color: _isFavorite ? Colors.redAccent : Colors.white,
                      size: 20,
                    ),
                    onPressed: _toggleFavorite,
                  ),
                ),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  if (backdropUrl.isNotEmpty)
                    CachedNetworkImage(
                      imageUrl: backdropUrl,
                      fit: BoxFit.cover,
                      errorWidget: (context, url, error) => Container(color: AppTheme.surface),
                    )
                  else
                    Container(color: AppTheme.surface),

                  // Dégradé sombre pour lisibilité
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.3),
                          Colors.transparent,
                          AppTheme.background.withValues(alpha: 0.8),
                          AppTheme.background,
                        ],
                        stops: const [0.0, 0.4, 0.8, 1.0],
                      ),
                    ),
                  ),

                  // Bouton Play Hero central
                  Center(
                    child: GestureDetector(
                      onTap: () {
                        if (_isSeries) {
                          if (_episodes.isNotEmpty) {
                            _onPlayEpisode(_episodes.first);
                          }
                        } else {
                          _onPlayMovie();
                        }
                      },
                      child: Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppTheme.primary,
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.primary.withValues(alpha: 0.5),
                              blurRadius: 20,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.play_arrow_rounded,
                          color: Colors.white,
                          size: 40,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // CONTENU DES DÉTAILS
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // TITRE DU MÉDIA
                  Text(
                    _currentMedia.title,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      height: 1.2,
                    ),
                  ),

                  if (_currentMedia.tagline != null && _currentMedia.tagline!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      _currentMedia.tagline!,
                      style: const TextStyle(
                        fontSize: 13,
                        fontStyle: FontStyle.italic,
                        color: Colors.white60,
                      ),
                    ),
                  ],

                  const SizedBox(height: 12),

                  // BADGES : Note, Année, Qualité, Durée / Saisons
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      // Note TMDB
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
                              const Icon(Icons.star_rounded, color: Colors.amber, size: 16),
                              const SizedBox(width: 4),
                              Text(
                                _currentMedia.rating!,
                                style: const TextStyle(
                                  color: Colors.amber,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),

                      // Année
                      if (_currentMedia.year != null && _currentMedia.year!.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppTheme.card,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            _currentMedia.year!,
                            style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                        ),

                      // Qualité (HD / 4K)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppTheme.primary.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppTheme.primary.withValues(alpha: 0.4)),
                        ),
                        child: Text(
                          _currentMedia.quality ?? 'HD',
                          style: const TextStyle(
                            color: AppTheme.primary,
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),

                      // Durée / Nombre de saisons
                      if (!_isSeries && _currentMedia.runtime != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppTheme.card,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            _formatRuntime(_currentMedia.runtime),
                            style: const TextStyle(color: Colors.white70, fontSize: 12),
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
                            style: const TextStyle(color: Colors.white70, fontSize: 12),
                          ),
                        ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // BOUTONS PRINCIPAUX "REGARDER" ET "TÉLÉCHARGER"
                  Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: SizedBox(
                          height: 48,
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primary,
                              foregroundColor: Colors.white,
                              elevation: 4,
                              shadowColor: AppTheme.primary.withValues(alpha: 0.5),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            onPressed: () {
                              if (_isSeries) {
                                if (_episodes.isNotEmpty) {
                                  _onPlayEpisode(_episodes.first);
                                } else {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Chargement des épisodes en cours...')),
                                  );
                                }
                              } else {
                                _onPlayMovie();
                              }
                            },
                            icon: const Icon(Icons.play_arrow_rounded, size: 26),
                            label: Text(
                              _isSeries ? 'COMMENCER' : 'REGARDER',
                              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 0.5),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        flex: 2,
                        child: SizedBox(
                          height: 48,
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.white,
                              side: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
                              backgroundColor: AppTheme.card,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            onPressed: () => _onDownload(),
                            icon: const Icon(Icons.download_rounded, color: AppTheme.primary, size: 20),
                            label: const Text(
                              'TÉLÉCHARGER',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // GENRES
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
                    const SizedBox(height: 16),
                  ],

                  // SYNOPSIS
                  const Text(
                    'Synopsis',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _currentMedia.description != null && _currentMedia.description!.isNotEmpty
                        ? _currentMedia.description!
                        : 'Aucun résumé détaillé disponible pour le moment.',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 13,
                      height: 1.5,
                    ),
                  ),

                  // SECTION SÉRIES : SAISONS & ÉPISODES
                  if (_isSeries) ...[
                    const SizedBox(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Épisodes & Saisons',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                        if (_isLoadingSeason)
                          const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Sélecteur horizontal de saisons
                    if (_currentMedia.seasons != null && _currentMedia.seasons!.isNotEmpty)
                      SizedBox(
                        height: 38,
                        child: ListView.builder(
                          scrollDirection: Axis.horizontal,
                          itemCount: _currentMedia.seasons!.length,
                          itemBuilder: (context, index) {
                            final season = _currentMedia.seasons![index];
                            final isSelected = _selectedSeason?.seasonNumber == season.seasonNumber;

                            return GestureDetector(
                              onTap: () {
                                setState(() => _selectedSeason = season);
                                _loadSeasonEpisodes(season.seasonNumber);
                              },
                              child: Container(
                                margin: const EdgeInsets.only(right: 8),
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                decoration: BoxDecoration(
                                  color: isSelected ? AppTheme.primary : AppTheme.card,
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: isSelected ? AppTheme.primary : Colors.white12,
                                  ),
                                ),
                                child: Text(
                                  season.name.isNotEmpty ? season.name : 'Saison ${season.seasonNumber}',
                                  style: TextStyle(
                                    color: isSelected ? Colors.white : Colors.white70,
                                    fontSize: 12,
                                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),

                    const SizedBox(height: 16),

                    // Liste des Épisodes de la saison sélectionnée
                    if (_isLoadingSeason)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.all(32.0),
                          child: CircularProgressIndicator(color: AppTheme.primary),
                        ),
                      )
                    else if (_episodes.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 20.0),
                        child: Center(
                          child: Text(
                            'Aucun épisode disponible pour cette saison.',
                            style: TextStyle(color: Colors.white54, fontSize: 13),
                          ),
                        ),
                      )
                    else
                      ListView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _episodes.length,
                        itemBuilder: (context, index) {
                          final ep = _episodes[index];

                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            decoration: BoxDecoration(
                              color: AppTheme.card,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                            ),
                            child: ListTile(
                              contentPadding: const EdgeInsets.all(8),
                              leading: ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: ep.stillPath != null && ep.stillPath!.isNotEmpty
                                    ? CachedNetworkImage(
                                        imageUrl: ep.stillPath!,
                                        width: 80,
                                        height: 50,
                                        fit: BoxFit.cover,
                                        errorWidget: (context, url, error) => Container(
                                          width: 80,
                                          height: 50,
                                          color: Colors.white10,
                                          child: const Icon(Icons.movie, color: Colors.white24),
                                        ),
                                      )
                                    : Container(
                                        width: 80,
                                        height: 50,
                                        color: Colors.white10,
                                        child: const Icon(Icons.movie, color: Colors.white24),
                                      ),
                              ),
                              title: Text(
                                '${ep.episodeNumber}. ${ep.episode}',
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              subtitle: ep.overview != null && ep.overview!.isNotEmpty
                                  ? Text(
                                      ep.overview!,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                                    )
                                  : null,
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.download_rounded, color: Colors.white70, size: 22),
                                    tooltip: 'Télécharger cet épisode',
                                    onPressed: () => _onDownload(episode: ep),
                                  ),
                                  const Icon(Icons.play_circle_fill_rounded, color: AppTheme.primary, size: 28),
                                ],
                              ),
                              onTap: () => _onPlayEpisode(ep),
                            ),
                          );
                        },
                      ),
                  ],

                  // CASTING
                  if (_currentMedia.cast != null && _currentMedia.cast!.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    const Text(
                      'Distribution & Casting',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 120,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: _currentMedia.cast!.length,
                        itemBuilder: (context, index) {
                          final actor = _currentMedia.cast![index];
                          return Container(
                            width: 80,
                            margin: const EdgeInsets.only(right: 12),
                            child: Column(
                              children: [
                                CircleAvatar(
                                  radius: 30,
                                  backgroundColor: AppTheme.card,
                                  backgroundImage: actor.profileUrl != null
                                      ? CachedNetworkImageProvider(actor.profileUrl!)
                                      : null,
                                  child: actor.profileUrl == null
                                      ? const Icon(Icons.person, color: Colors.white54)
                                      : null,
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  actor.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                                  textAlign: TextAlign.center,
                                ),
                                Text(
                                  actor.character,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: AppTheme.textSecondary, fontSize: 10),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                  ],

                  // TITRES SIMILAIRES & RECOMMANDATIONS
                  if (_currentMedia.recommendations != null && _currentMedia.recommendations!.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    const Text(
                      'Titres similaires recommandés',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 190,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: _currentMedia.recommendations!.length,
                        itemBuilder: (context, index) {
                          final rec = _currentMedia.recommendations![index];
                          return GestureDetector(
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => DetailScreen(item: rec),
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
                                    borderRadius: BorderRadius.circular(10),
                                    child: rec.poster != null && rec.poster!.isNotEmpty
                                        ? CachedNetworkImage(
                                            imageUrl: rec.poster!,
                                            height: 150,
                                            width: 110,
                                            fit: BoxFit.cover,
                                            placeholder: (context, url) => Container(color: AppTheme.card),
                                            errorWidget: (context, url, error) => Container(
                                              height: 150,
                                              width: 110,
                                              color: AppTheme.card,
                                              child: const Icon(Icons.movie, color: Colors.white24),
                                            ),
                                          )
                                        : Container(
                                            height: 150,
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
              ),
            ),
          ),
        ],
      ),
    );
  }
}
