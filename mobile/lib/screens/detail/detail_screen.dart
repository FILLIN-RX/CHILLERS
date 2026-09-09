import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../widgets/download_modal.dart';
import '../../widgets/add_to_playlist_modal.dart';
import '../watch/watch_screen.dart';

class DetailScreen extends StatefulWidget {
  final MediaItem item;

  const DetailScreen({super.key, required this.item});

  @override
  State<DetailScreen> createState() => _DetailScreenState();
}

class _DetailScreenState extends State<DetailScreen> {
  final ApiService _apiService = ApiService();
  final StorageService _storage = StorageService();

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
    _checkFavoriteAndWatchlist();
    _loadFullDetails();
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

  bool get _isSeries =>
      _currentMedia.type == 'serie' ||
      _currentMedia.type == 'series' ||
      _currentMedia.type == 'tv' ||
      _currentMedia.type == 'anime' ||
      (_currentMedia.numberOfSeasons != null && _currentMedia.numberOfSeasons! > 0);

  Future<void> _loadFullDetails() async {
    final detail = await _apiService.getMediaDetail(_currentMedia.id, isSeries: _isSeries);
    if (detail != null && mounted) {
      final validSeasons = detail.seasons?.where((s) => s.seasonNumber >= 0).toList() ?? [];
      // Prefer season 1 over specials season 0 if available
      SeasonItem? initialSeason;
      if (validSeasons.isNotEmpty) {
        initialSeason = validSeasons.firstWhere(
          (s) => s.seasonNumber > 0,
          orElse: () => validSeasons.first,
        );
      }

      setState(() {
        _currentMedia = detail;
        if (_isSeries && initialSeason != null) {
          _selectedSeason = initialSeason;
          _loadSeasonEpisodes(initialSeason.seasonNumber);
        }
      });
    }
  }

  Future<void> _loadSeasonEpisodes(int seasonNumber) async {
    setState(() => _isLoadingSeason = true);
    final eps = await _apiService.getSeasonEpisodes(_currentMedia.id, seasonNumber);
    if (mounted) {
      setState(() {
        _episodes = eps;
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
          initialSeason: _selectedSeason?.seasonNumber ?? 1,
          initialEpisode: episode.episodeNumber,
          initialVideoUrl: episode.streamUrl.isNotEmpty ? episode.streamUrl : null,
        ),
      ),
    );
  }

  void _toggleFavorite() async {
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
    setState(() => _isWatchlist = !_isWatchlist);
    await _storage.toggleWatchlist(_currentMedia.toJson());
    _apiService.toggleWatchLater(_currentMedia.id);
    if (mounted) {
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

  void _onDownload({EpisodeItem? episode}) {
    DownloadModal.show(
      context: context,
      item: _currentMedia,
      episode: episode,
      seasonNumber: _selectedSeason?.seasonNumber ?? 1,
    );
  }

  @override
  Widget build(BuildContext context) {
    final backdropUrl = _currentMedia.backdrop ?? _currentMedia.poster ?? '';
    final validSeasons = _currentMedia.seasons?.where((s) => s.seasonNumber > 0).toList() ??
        _currentMedia.seasons ??
        [];

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
                padding: const EdgeInsets.only(right: 6.0),
                child: Container(
                  decoration: const BoxDecoration(
                    color: Colors.black54,
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.playlist_add_rounded, color: Colors.white, size: 20),
                    tooltip: 'Ajouter à une playlist',
                    onPressed: () => AddToPlaylistModal.show(context, _currentMedia),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(right: 6.0),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  decoration: BoxDecoration(
                    color: _isWatchlist ? AppTheme.primary : Colors.black54,
                    shape: BoxShape.circle,
                    boxShadow: _isWatchlist
                        ? [
                            BoxShadow(
                              color: AppTheme.primary.withValues(alpha: 0.5),
                              blurRadius: 10,
                              spreadRadius: 2,
                            ),
                          ]
                        : null,
                  ),
                  child: IconButton(
                    icon: Icon(
                      _isWatchlist ? Icons.bookmark_rounded : Icons.bookmark_outline_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                    tooltip: 'Ma Liste',
                    onPressed: _toggleWatchlist,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(right: 12.0),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  decoration: BoxDecoration(
                    color: _isFavorite ? const Color(0xFFFF2D55) : Colors.black54,
                    shape: BoxShape.circle,
                    boxShadow: _isFavorite
                        ? [
                            BoxShadow(
                              color: const Color(0xFFFF2D55).withValues(alpha: 0.55),
                              blurRadius: 12,
                              spreadRadius: 2,
                            ),
                          ]
                        : null,
                  ),
                  child: IconButton(
                    icon: Icon(
                      _isFavorite ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                    tooltip: 'Favoris',
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
                          } else {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => WatchScreen(
                                  item: _currentMedia,
                                  initialSeason: _selectedSeason?.seasonNumber ?? 1,
                                  initialEpisode: 1,
                                ),
                              ),
                            );
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
                  // SÉRIE CHILLERS BADGE
                  if (_isSeries)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8.0),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppTheme.primary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.auto_awesome_rounded, color: AppTheme.primary, size: 14),
                            SizedBox(width: 6),
                            Text(
                              'SÉRIE CHILLERS',
                              style: TextStyle(
                                color: AppTheme.primary,
                                fontSize: 11,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.8,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

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
                      else if (_isSeries)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppTheme.card,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '${validSeasons.isNotEmpty ? validSeasons.length : (_currentMedia.numberOfSeasons ?? 1)} Saison${(validSeasons.length > 1 || (_currentMedia.numberOfSeasons ?? 1) > 1) ? 's' : ''}',
                            style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold),
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
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => WatchScreen(
                                        item: _currentMedia,
                                        initialSeason: _selectedSeason?.seasonNumber ?? 1,
                                        initialEpisode: 1,
                                      ),
                                    ),
                                  );
                                }
                              } else {
                                _onPlayMovie();
                              }
                            },
                            icon: const Icon(Icons.play_arrow_rounded, size: 26),
                            label: Text(
                              _isSeries
                                  ? 'REGARDER SAISON ${_selectedSeason?.seasonNumber ?? 1}'
                                  : 'REGARDER LE FILM',
                              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 0.5),
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

                  const SizedBox(height: 12),

                  // Barre d'Actions Visuelle (Favoris, Ma Liste, Playlist, Partager)
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildActionButton(
                          icon: _isFavorite ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                          label: _isFavorite ? 'Aimé' : 'J\'aime',
                          isActive: _isFavorite,
                          activeColor: const Color(0xFFFF2D55),
                          onTap: _toggleFavorite,
                        ),
                        const SizedBox(width: 8),
                        _buildActionButton(
                          icon: _isWatchlist ? Icons.bookmark_rounded : Icons.bookmark_outline_rounded,
                          label: _isWatchlist ? 'Dans Ma Liste' : 'Ma Liste',
                          isActive: _isWatchlist,
                          activeColor: AppTheme.primary,
                          onTap: _toggleWatchlist,
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

                  // ── SECTION SÉRIES : SAISONS DISPONIBLES (STYLE WEB) ──
                  if (_isSeries) ...[
                    const SizedBox(height: 28),

                    // Titre de section "Saisons Disponibles"
                    Row(
                      children: [
                        const Icon(Icons.layers_rounded, color: AppTheme.primary, size: 22),
                        const SizedBox(width: 8),
                        const Text(
                          'Saisons Disponibles',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.white),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '(${validSeasons.length})',
                          style: const TextStyle(fontSize: 13, color: Colors.white38, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Grille Horizontale des Cartes de Saisons (Affiches 2:3 avec badge épisodes & effet actif)
                    if (validSeasons.isNotEmpty)
                      SizedBox(
                        height: 200,
                        child: ListView.builder(
                          scrollDirection: Axis.horizontal,
                          itemCount: validSeasons.length,
                          itemBuilder: (context, index) {
                            final season = validSeasons[index];
                            final isSelected = _selectedSeason?.seasonNumber == season.seasonNumber;
                            final poster = season.posterPath ?? _currentMedia.poster;

                            return GestureDetector(
                              onTap: () {
                                setState(() => _selectedSeason = season);
                                _loadSeasonEpisodes(season.seasonNumber);
                              },
                              child: Container(
                                width: 120,
                                margin: const EdgeInsets.only(right: 12),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: isSelected ? AppTheme.primary : Colors.white.withValues(alpha: 0.08),
                                    width: isSelected ? 2 : 1,
                                  ),
                                  boxShadow: isSelected
                                      ? [
                                          BoxShadow(
                                            color: AppTheme.primary.withValues(alpha: 0.4),
                                            blurRadius: 14,
                                            spreadRadius: 1,
                                          ),
                                        ]
                                      : null,
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(14),
                                  child: Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      // Image poster de la saison
                                      if (poster != null && poster.isNotEmpty)
                                        CachedNetworkImage(
                                          imageUrl: poster,
                                          fit: BoxFit.cover,
                                          errorWidget: (context, url, error) => Container(color: AppTheme.card),
                                        )
                                      else
                                        Container(
                                          color: AppTheme.card,
                                          child: const Icon(Icons.movie_rounded, color: Colors.white24, size: 36),
                                        ),

                                      // Gradient sombre
                                      Container(
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            begin: Alignment.topCenter,
                                            end: Alignment.bottomCenter,
                                            colors: [
                                              Colors.transparent,
                                              Colors.black.withValues(alpha: 0.3),
                                              Colors.black.withValues(alpha: 0.95),
                                            ],
                                            stops: const [0.3, 0.6, 1.0],
                                          ),
                                        ),
                                      ),

                                      // Badge nombre d'épisodes en haut à droite
                                      Positioned(
                                        top: 8,
                                        right: 8,
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: Colors.black.withValues(alpha: 0.8),
                                            borderRadius: BorderRadius.circular(6),
                                            border: Border.all(color: Colors.white24),
                                          ),
                                          child: Text(
                                            '${season.episodeCount} ep',
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 9,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ),
                                      ),

                                      // Indicateur / Bouton Play au centre si sélectionné
                                      if (isSelected)
                                        Center(
                                          child: Container(
                                            width: 36,
                                            height: 36,
                                            decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              color: AppTheme.primary,
                                              boxShadow: [
                                                BoxShadow(
                                                  color: AppTheme.primary.withValues(alpha: 0.6),
                                                  blurRadius: 10,
                                                ),
                                              ],
                                            ),
                                            child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 24),
                                          ),
                                        ),

                                      // Titre et sous-titre de la saison en bas
                                      Positioned(
                                        bottom: 8,
                                        left: 8,
                                        right: 8,
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Text(
                                              season.name.isNotEmpty ? season.name : 'Saison ${season.seasonNumber}',
                                              style: TextStyle(
                                                color: isSelected ? AppTheme.primary : Colors.white,
                                                fontWeight: FontWeight.w900,
                                                fontSize: 12,
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            Text(
                                              '${season.episodeCount} épisodes',
                                              style: const TextStyle(
                                                color: Colors.white60,
                                                fontSize: 10,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),

                    const SizedBox(height: 24),

                    // Titre "Épisodes de la Saison [X]" & Pills de bascule rapide
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Épisodes (${_selectedSeason?.name ?? 'Saison ${_selectedSeason?.seasonNumber ?? 1}'})',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                        if (_isLoadingSeason)
                          const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary),
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Sélecteur horizontal de saisons (Chips)
                    if (validSeasons.isNotEmpty)
                      SizedBox(
                        height: 36,
                        child: ListView.builder(
                          scrollDirection: Axis.horizontal,
                          itemCount: validSeasons.length,
                          itemBuilder: (context, index) {
                            final season = validSeasons[index];
                            final isSelected = _selectedSeason?.seasonNumber == season.seasonNumber;

                            return Padding(
                              padding: const EdgeInsets.only(right: 8),
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
                                  setState(() => _selectedSeason = season);
                                  _loadSeasonEpisodes(season.seasonNumber);
                                },
                              ),
                            );
                          },
                        ),
                      ),

                    const SizedBox(height: 14),

                    // Liste des Épisodes de la saison sélectionnée
                    if (_isLoadingSeason)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.all(32.0),
                          child: CircularProgressIndicator(color: AppTheme.primary),
                        ),
                      )
                    else if (_episodes.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: AppTheme.card,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                        ),
                        child: const Center(
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

                          return Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Material(
                              color: AppTheme.card,
                              borderRadius: BorderRadius.circular(14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                                side: BorderSide(color: Colors.white.withValues(alpha: 0.06)),
                              ),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(14),
                                onTap: () => _onPlayEpisode(ep),
                                child: Padding(
                                  padding: const EdgeInsets.all(10.0),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.center,
                                    children: [
                                      // Image miniature 16:9 avec overlay Play
                                      Stack(
                                        alignment: Alignment.center,
                                        children: [
                                          ClipRRect(
                                            borderRadius: BorderRadius.circular(10),
                                            child: ep.stillPath != null && ep.stillPath!.isNotEmpty
                                                ? CachedNetworkImage(
                                                    imageUrl: ep.stillPath!,
                                                    width: 100,
                                                    height: 60,
                                                    fit: BoxFit.cover,
                                                    errorWidget: (context, url, error) => Container(
                                                      width: 100,
                                                      height: 60,
                                                      color: Colors.white10,
                                                      child: const Icon(Icons.movie_rounded, color: Colors.white24),
                                                    ),
                                                  )
                                                : Container(
                                                    width: 100,
                                                    height: 60,
                                                    color: Colors.white10,
                                                    child: const Icon(Icons.movie_rounded, color: Colors.white24),
                                                  ),
                                          ),
                                          Container(
                                            width: 28,
                                            height: 28,
                                            decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              color: Colors.black.withValues(alpha: 0.6),
                                              border: Border.all(color: Colors.white38),
                                            ),
                                            child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 20),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(width: 12),

                                      // Détails de l'épisode (Numéro, Titre, Durée, Synopsis)
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                                  decoration: BoxDecoration(
                                                    color: AppTheme.primary.withValues(alpha: 0.2),
                                                    borderRadius: BorderRadius.circular(4),
                                                  ),
                                                  child: Text(
                                                    'EP ${ep.episodeNumber}',
                                                    style: const TextStyle(
                                                      color: AppTheme.primary,
                                                      fontSize: 10,
                                                      fontWeight: FontWeight.w900,
                                                    ),
                                                  ),
                                                ),
                                                if (ep.runtime != null) ...[
                                                  const SizedBox(width: 6),
                                                  Text(
                                                    '${ep.runtime} min',
                                                    style: const TextStyle(color: Colors.white38, fontSize: 11),
                                                  ),
                                                ],
                                              ],
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              ep.episode,
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontWeight: FontWeight.bold,
                                                fontSize: 13,
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            if (ep.overview != null && ep.overview!.isNotEmpty) ...[
                                              const SizedBox(height: 2),
                                              Text(
                                                ep.overview!,
                                                maxLines: 2,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),

                                      // Bouton Télécharger
                                      IconButton(
                                        icon: const Icon(Icons.download_rounded, color: Colors.white70, size: 22),
                                        tooltip: 'Télécharger cet épisode',
                                        onPressed: () => _onDownload(episode: ep),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                  ],

                  // CASTING
                  if (_currentMedia.cast != null && _currentMedia.cast!.isNotEmpty) ...[
                    const SizedBox(height: 28),
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
                    const SizedBox(height: 28),
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
}
