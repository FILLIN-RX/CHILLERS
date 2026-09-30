import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../models/media_item.dart';
import '../../models/user_model.dart';
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
  UserModel? _user;

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
    _loadUser();
    _checkFavoriteAndWatchlist();
    _loadFullDetails();
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

  void _onPlayMain() {
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
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => WatchScreen(item: _currentMedia),
        ),
      );
    }
  }

  void _onPlayEpisode(EpisodeItem episode) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => WatchScreen(
          item: _currentMedia,
          initialSeason: _selectedSeason?.seasonNumber ?? episode.season,
          initialEpisode: episode.episodeNumber,
          initialVideoUrl: episode.streamUrl.isNotEmpty ? episode.streamUrl : null,
        ),
      ),
    );
  }

  void _toggleFavorite() async {
    HapticFeedback.mediumImpact();
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
    HapticFeedback.mediumImpact();
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

  void _onDownload({EpisodeItem? episode}) {
    DownloadModal.show(
      context: context,
      item: _currentMedia,
      user: _user,
      episode: episode,
      seasonNumber: _selectedSeason?.seasonNumber ?? 1,
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
                      final isSelected = _selectedSeason?.seasonNumber == season.seasonNumber;
                      final sName = season.name.isNotEmpty
                          ? season.name
                          : 'Saison ${season.seasonNumber}';

                      return ListTile(
                        leading: FaIcon(
                          FontAwesomeIcons.film,
                          color: isSelected ? const Color(0xFFE50914) : Colors.white38,
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
                            setState(() => _selectedSeason = season);
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

  Widget _buildStarRating() {
    double score = 4.5;
    if (_currentMedia.rating != null && _currentMedia.rating!.isNotEmpty) {
      final parsed = double.tryParse(_currentMedia.rating!);
      if (parsed != null && parsed > 0) {
        score = (parsed / 2.0).clamp(0.0, 5.0);
      }
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        final starValue = index + 1;
        if (score >= starValue) {
          return const Padding(
            padding: EdgeInsets.only(right: 3.0),
            child: FaIcon(FontAwesomeIcons.solidStar, color: Color(0xFFFFC107), size: 13),
          );
        } else if (score >= starValue - 0.5) {
          return const Padding(
            padding: EdgeInsets.only(right: 3.0),
            child: FaIcon(FontAwesomeIcons.starHalfStroke, color: Color(0xFFFFC107), size: 13),
          );
        } else {
          return const Padding(
            padding: EdgeInsets.only(right: 3.0),
            child: FaIcon(FontAwesomeIcons.star, color: Colors.white24, size: 13),
          );
        }
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final heroImageUrl = _currentMedia.backdrop ?? _currentMedia.poster ?? '';

    final validSeasons = _currentMedia.seasons?.where((s) => s.seasonNumber > 0).toList() ??
        _currentMedia.seasons ??
        [];

    final currentSeasonTitle = _selectedSeason?.name.isNotEmpty == true
        ? _selectedSeason!.name
        : 'Season ${_selectedSeason?.seasonNumber ?? 1}';

    final episodeCount = _episodes.isNotEmpty
        ? _episodes.length
        : (_selectedSeason?.episodeCount ?? (_currentMedia.numberOfEpisodes ?? 0));

    final seasonCount = _currentMedia.numberOfSeasons ?? validSeasons.length;

    return Scaffold(
      backgroundColor: const Color(0xFF000000),
      body: CustomScrollView(
        slivers: [
          // ── HERO BANNER EXACT MOCKUP ──
          SliverAppBar(
            expandedHeight: 380,
            pinned: true,
            backgroundColor: const Color(0xFF000000),
            leading: Padding(
              padding: const EdgeInsets.all(8.0),
              child: GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.4),
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: FaIcon(FontAwesomeIcons.chevronLeft, color: Colors.white, size: 16),
                  ),
                ),
              ),
            ),
            actions: [
              PopupMenuButton<String>(
                icon: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.4),
                    shape: BoxShape.circle,
                  ),
                  child: const FaIcon(FontAwesomeIcons.ellipsisVertical, color: Colors.white, size: 16),
                ),
                color: const Color(0xFF1C1C1E),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                onSelected: (value) {
                  if (value == 'playlist') {
                    AddToPlaylistModal.show(context, _currentMedia);
                  } else if (value == 'favorite') {
                    _toggleFavorite();
                  } else if (value == 'download') {
                    _onDownload();
                  }
                },
                itemBuilder: (context) => [
                  PopupMenuItem(
                    value: 'playlist',
                    child: Row(
                      children: const [
                        FaIcon(FontAwesomeIcons.listUl, color: Colors.white70, size: 14),
                        SizedBox(width: 10),
                        Text('Ajouter à une playlist', style: TextStyle(color: Colors.white)),
                      ],
                    ),
                  ),
                  PopupMenuItem(
                    value: 'favorite',
                    child: Row(
                      children: [
                        FaIcon(
                          _isFavorite ? FontAwesomeIcons.solidHeart : FontAwesomeIcons.heart,
                          color: _isFavorite ? const Color(0xFFFF2D55) : Colors.white70,
                          size: 14,
                        ),
                        const SizedBox(width: 10),
                        Text(_isFavorite ? 'Retirer des favoris' : 'Favoris', style: const TextStyle(color: Colors.white)),
                      ],
                    ),
                  ),
                  if (!_isSeries)
                    PopupMenuItem(
                      value: 'download',
                      child: Row(
                        children: const [
                          FaIcon(FontAwesomeIcons.download, color: Colors.white70, size: 14),
                          SizedBox(width: 10),
                          Text('Télécharger', style: TextStyle(color: Colors.white)),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 8),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  // Affiche Backdrop Hero
                  if (heroImageUrl.isNotEmpty)
                    CachedNetworkImage(
                      imageUrl: heroImageUrl,
                      fit: BoxFit.cover,
                      alignment: Alignment.topCenter,
                      errorWidget: (context, url, error) => Container(color: const Color(0xFF141416)),
                    )
                  else
                    Container(color: const Color(0xFF141416)),

                  // Dégradé cinématique sombre immersif
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.4),
                          Colors.transparent,
                          Colors.black.withValues(alpha: 0.5),
                          const Color(0xFF000000).withValues(alpha: 0.95),
                          const Color(0xFF000000),
                        ],
                        stops: const [0.0, 0.25, 0.65, 0.9, 1.0],
                      ),
                    ),
                  ),

                  // Grand Bouton Play Circulaire Translucide au centre (Mockup)
                  Center(
                    child: GestureDetector(
                      onTap: _onPlayMain,
                      child: Container(
                        width: 62,
                        height: 62,
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.5),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.75),
                            width: 1.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.6),
                              blurRadius: 20,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: const Center(
                          child: Padding(
                            padding: EdgeInsets.only(left: 3.0),
                            child: FaIcon(FontAwesomeIcons.play, color: Colors.white, size: 22),
                          ),
                        ),
                      ),
                    ),
                  ),

                  // Overlay Bas du Hero : Titre, Métas, Étoiles + Bouton "+" Rouge
                  Positioned(
                    left: 16,
                    right: 16,
                    bottom: 12,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        // Titre & Métas (Gauche)
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                _currentMedia.title,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 24,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -0.3,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  // Année / Plage d'années
                                  Text(
                                    _currentMedia.year != null && _currentMedia.year!.isNotEmpty
                                        ? _currentMedia.year!
                                        : '2024',
                                    style: const TextStyle(
                                      color: Colors.white60,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(width: 8),

                                  // Badge 18+ (Pill rectangle aux bords arrondis du mockup)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(4),
                                      border: Border.all(
                                        color: Colors.white.withValues(alpha: 0.35),
                                        width: 0.8,
                                      ),
                                    ),
                                    child: const Text(
                                      '18+',
                                      style: TextStyle(
                                        color: Colors.white70,
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),

                                  // Nombre de Saisons / Qualité
                                  Text(
                                    _isSeries
                                        ? (seasonCount > 1 ? '$seasonCount SEASONS' : '1 SEASON')
                                        : (_currentMedia.quality ?? 'HD'),
                                    style: const TextStyle(
                                      color: Colors.white60,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),

                              // 5 Étoiles
                              _buildStarRating(),
                            ],
                          ),
                        ),

                        const SizedBox(width: 12),

                        // Bouton "+" Rouge Rond Flottant (Watchlist / Bookmark)
                        GestureDetector(
                          onTap: _toggleWatchlist,
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: const Color(0xFFE50914), // Rouge signature Money Heist
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFFE50914).withValues(alpha: 0.5),
                                  blurRadius: 12,
                                  spreadRadius: 1,
                                ),
                              ],
                            ),
                            child: Center(
                              child: Icon(
                                _isWatchlist ? Icons.check : Icons.add,
                                color: Colors.white,
                                size: 24,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── CONTENU DU CORPS : SYNOPSIS, SAISONS & ÉPISODES ──
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 14),

                  // SYNOPSIS (Texte élégant du Mockup)
                  Text(
                    _currentMedia.description != null && _currentMedia.description!.isNotEmpty
                        ? _currentMedia.description!
                        : 'Aucune description disponible pour ce contenu.',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 13,
                      height: 1.45,
                    ),
                  ),

                  const SizedBox(height: 24),

                  // ── SECTION SÉRIES : HEADER DE SÉLECTION DE SAISON ──
                  if (_isSeries) ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Dropdown Saison cliquable (ex: Season 1 ▾)
                        GestureDetector(
                          onTap: () {
                            if (validSeasons.isNotEmpty) {
                              _showSeasonPickerModal(validSeasons);
                            }
                          },
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                currentSeasonTitle,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(width: 4),
                              const Icon(
                                Icons.arrow_drop_down,
                                color: Color(0xFFE50914),
                                size: 22,
                              ),
                            ],
                          ),
                        ),

                        // Compteur d'épisodes (ex: 15 Episodes)
                        Text(
                          '$episodeCount Episodes',
                          style: const TextStyle(
                            color: Colors.white38,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 16),

                    // LISTE VERTICALE DES ÉPISODES (STYLE MOCKUP)
                    if (_isLoadingSeason)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 40.0),
                        child: Center(
                          child: CircularProgressIndicator(
                            color: Color(0xFFE50914),
                            strokeWidth: 2,
                          ),
                        ),
                      )
                    else if (_episodes.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 30.0),
                        child: Center(
                          child: Text(
                            'Aucun épisode disponible pour cette saison.',
                            style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 13),
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
                          final thumb = ep.stillPath ?? _currentMedia.backdrop ?? _currentMedia.poster ?? '';
                          final epTitle = ep.title != null && ep.title!.isNotEmpty
                              ? ep.title!
                              : (ep.episode.isNotEmpty ? ep.episode : 'Episode ${ep.episodeNumber}');

                          return GestureDetector(
                            onTap: () => _onPlayEpisode(ep),
                            behavior: HitTestBehavior.opaque,
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                // Vignette 16:9 avec bouton Play translucide au centre
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(10),
                                  child: Container(
                                    width: 124,
                                    height: 72,
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
                                                child: FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 20),
                                              ),
                                            ),
                                          )
                                        else
                                          const Center(
                                            child: FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 20),
                                          ),

                                        // Overlay sombre subtil
                                        Container(color: Colors.black.withValues(alpha: 0.25)),

                                        // Petit Play button au centre de la vignette
                                        Center(
                                          child: Container(
                                            width: 28,
                                            height: 28,
                                            decoration: BoxDecoration(
                                              color: Colors.black.withValues(alpha: 0.55),
                                              shape: BoxShape.circle,
                                              border: Border.all(
                                                color: Colors.white.withValues(alpha: 0.8),
                                                width: 1.2,
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

                                const SizedBox(width: 14),

                                // Titre & Description de l'épisode
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        epTitle,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 14,
                                          fontWeight: FontWeight.bold,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        ep.overview != null && ep.overview!.trim().isNotEmpty
                                            ? ep.overview!
                                            : 'Lorem Ipsum is simply dummy text of the printing and typesetting industry.',
                                        style: const TextStyle(
                                          color: Colors.white54,
                                          fontSize: 11.5,
                                          height: 1.3,
                                        ),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),

                                const SizedBox(width: 8),

                                // Bouton Téléchargement à droite (Mockup)
                                IconButton(
                                  icon: const FaIcon(
                                    FontAwesomeIcons.download,
                                    color: Colors.white70,
                                    size: 17,
                                  ),
                                  tooltip: 'Télécharger cet épisode',
                                  onPressed: () => _onDownload(episode: ep),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                  ] else ...[
                    // Pour les films : Bouton regarder / Télécharger
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFE50914),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            icon: const FaIcon(FontAwesomeIcons.play, size: 14),
                            label: const Text('Lire le film', style: TextStyle(fontWeight: FontWeight.bold)),
                            onPressed: _onPlayMain,
                          ),
                        ),
                        const SizedBox(width: 12),
                        IconButton(
                          style: IconButton.styleFrom(
                            backgroundColor: const Color(0xFF1C1C1E),
                            padding: const EdgeInsets.all(14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          icon: const FaIcon(FontAwesomeIcons.download, color: Colors.white, size: 16),
                          tooltip: 'Télécharger le film',
                          onPressed: () => _onDownload(),
                        ),
                      ],
                    ),
                  ],

                  // ── CASTING (OPTIONNEL EN BAS) ──
                  if (_currentMedia.cast != null && _currentMedia.cast!.isNotEmpty) ...[
                    const SizedBox(height: 32),
                    const Text(
                      'Distribution',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 100,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: _currentMedia.cast!.length,
                        itemBuilder: (context, index) {
                          final actor = _currentMedia.cast![index];
                          return Container(
                            width: 75,
                            margin: const EdgeInsets.only(right: 12),
                            child: Column(
                              children: [
                                CircleAvatar(
                                  radius: 26,
                                  backgroundColor: const Color(0xFF1C1C1E),
                                  backgroundImage: actor.profileUrl != null
                                      ? CachedNetworkImageProvider(actor.profileUrl!)
                                      : null,
                                  child: actor.profileUrl == null
                                      ? const FaIcon(FontAwesomeIcons.user, color: Colors.white38, size: 16)
                                      : null,
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  actor.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.bold),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                  ],

                  // ── RECOMMANDATIONS (EN BAS) ──
                  if (_currentMedia.recommendations != null && _currentMedia.recommendations!.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    const Text(
                      'Titres similaires',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 165,
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
                              width: 105,
                              margin: const EdgeInsets.only(right: 10),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(10),
                                    child: rec.poster != null && rec.poster!.isNotEmpty
                                        ? CachedNetworkImage(
                                            imageUrl: rec.poster!,
                                            height: 135,
                                            width: 105,
                                            fit: BoxFit.cover,
                                            placeholder: (context, url) => Container(color: const Color(0xFF1C1C1E)),
                                            errorWidget: (context, url, error) => Container(
                                              height: 135,
                                              width: 105,
                                              color: const Color(0xFF1C1C1E),
                                              child: const Center(
                                                child: FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 20),
                                              ),
                                            ),
                                          )
                                        : Container(
                                            height: 135,
                                            width: 105,
                                            color: const Color(0xFF1C1C1E),
                                            child: const Center(
                                              child: FaIcon(FontAwesomeIcons.film, color: Colors.white24, size: 20),
                                            ),
                                          ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    rec.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],

                  const SizedBox(height: 36),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
