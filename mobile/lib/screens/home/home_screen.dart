import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';
import '../../models/live_channel.dart';
import '../../models/live_match.dart';
import '../../models/user_model.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../widgets/hero_carousel.dart';
import '../../widgets/app_header.dart';
import '../../widgets/app_drawer.dart';
import '../detail/detail_screen.dart';
import '../watch/watch_screen.dart';
import '../live/live_screen.dart';
import '../main_navigation.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final ApiService _apiService = ApiService();
  final StorageService _storage = StorageService();

  UserModel? _user;
  List<MediaItem> _heroSlides = [];
  List<MediaItem> _trending = [];
  List<MediaItem> _upcoming = [];
  List<MediaItem> _series = [];
  List<MediaItem> _animes = [];
  List<MediaItem> _african = [];
  List<MediaItem> _actionMovies = [];
  List<MediaItem> _comedyMovies = [];
  List<MediaItem> _horrorMovies = [];
  List<Map<String, dynamic>> _continueWatching = [];

  List<LiveMatch> _liveMatches = [];
  List<LiveChannel> _liveChannels = [];

  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<T?> _safeCall<T>(Future<T> Function() call) async {
    try {
      return await call();
    } catch (_) {
      return null;
    }
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);

    final cachedUser = await _storage.getUser();
    final trendingRes = await _safeCall(() => _apiService.getTrendingMovies()) ?? [];
    final upcomingRes = await _safeCall(() => _apiService.getUpcomingMovies()) ?? [];
    final seriesRes = await _safeCall(() => _apiService.getPopularSeries()) ?? [];
    final animesRes = await _safeCall(() => _apiService.getAnimeSeries()) ?? [];
    final africanRes = await _safeCall(() => _apiService.getAfricanMovies()) ?? [];
    final actionRes = await _safeCall(() => _apiService.getMoviesByGenre('28')) ?? [];
    final comedyRes = await _safeCall(() => _apiService.getMoviesByGenre('35')) ?? [];
    final horrorRes = await _safeCall(() => _apiService.getMoviesByGenre('27')) ?? [];

    final matchesRes = await _safeCall(() => _apiService.getLiveMatches()) ?? [];
    final uefaMatchesRes = await _safeCall(() => _apiService.getChampionsLeagueMatches()) ?? [];
    final channelsRes = await _safeCall(() => _apiService.getLiveChannels()) ?? [];
    final continueWatchingRes = await _storage.getContinueWatching();

    // Fusionner les matchs généraux et les matchs Champions League sans doublons
    final allMatchesMap = <String, LiveMatch>{};
    for (final m in [...matchesRes, ...uefaMatchesRes]) {
      allMatchesMap[m.id] = m;
    }
    final combinedMatches = allMatchesMap.values.toList();

    final rawHero = [
      if (trendingRes.isNotEmpty) ...trendingRes.take(3),
      if (seriesRes.isNotEmpty) ...seriesRes.take(2),
      if (animesRes.isNotEmpty) ...animesRes.take(2),
    ];

    if (!mounted) return;

    setState(() {
      _user = cachedUser;
      _continueWatching = continueWatchingRes;
      _trending = trendingRes;
      _upcoming = upcomingRes;
      _series = seriesRes;
      _animes = animesRes;
      _african = africanRes;
      _actionMovies = actionRes;
      _comedyMovies = comedyRes;
      _horrorMovies = horrorRes;

      _liveMatches = combinedMatches;
      _liveChannels = channelsRes;
      _heroSlides = rawHero;

      _isLoading = false;
    });

    // Enrichir les vidéos de trailers en arrière-plan comme sur le Web
    if (rawHero.isNotEmpty) {
      _apiService.enrichHeroSlidesWithTrailers(rawHero).then((enriched) {
        if (mounted && enriched.isNotEmpty) {
          setState(() {
            _heroSlides = enriched;
          });
        }
      });
    }

    _safeCall(() => _apiService.getProfile()).then((freshUser) {
      if (mounted && freshUser != null) {
        setState(() => _user = freshUser);
      }
    });
  }

  void _onWatchMedia(MediaItem item) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => WatchScreen(item: item),
      ),
    );
  }

  void _onOpenMediaDetails(MediaItem item) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => DetailScreen(item: item)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: AppTheme.background,
      drawer: AppDrawer(
        activeCategory: 'Tous',
        onSelectCategory: (cat) {
          if (cat == 'En Direct') {
            MainNavigation.switchTab(context, 2);
          }
        },
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : Stack(
              children: [
                // Scrollable Content
                RefreshIndicator(
                  color: AppTheme.primary,
                  onRefresh: _loadData,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // HERO CAROUSEL (Blended with transparent navbar above)
                        if (_heroSlides.isNotEmpty)
                          HeroCarousel(
                            slides: _heroSlides,
                            onWatchNow: _onWatchMedia,
                            onOpenDetails: _onOpenMediaDetails,
                          )
                        else
                          SizedBox(height: MediaQuery.of(context).padding.top + 70),

                        // Reprendre la lecture
                        if (_continueWatching.isNotEmpty)
                          _buildContinueWatchingSection(),

                        // Matchs en Direct (avec logos des clubs et score)
                        if (_liveMatches.isNotEmpty)
                          _buildLiveMatchesRow(_liveMatches),

                        // Sections Vidéos
                        _buildMediaSection('Tendance actuellement', _trending),
                        _buildMediaSection('Nouveautés & Sorties', _upcoming),

                        // Chaînes TV
                        if (_liveChannels.isNotEmpty)
                          _buildLiveChannelsRow(_liveChannels),

                        _buildMediaSection('Séries TV Populaires', _series),
                        _buildMediaSection('Animes & Mangas', _animes),
                        _buildMediaSection('Cinéma & Séries Africains', _african),
                        _buildMediaSection('Films d\'Action & Aventure', _actionMovies),
                        _buildMediaSection('Films de Comédie', _comedyMovies),
                        _buildMediaSection('Films d\'Horreur & Thriller', _horrorMovies),

                        const SizedBox(height: 50),
                      ],
                    ),
                  ),
                ),

                // Floating Blended AppHeader
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: AppHeader(
                    scaffoldKey: _scaffoldKey,
                    user: _user,
                    onLogoTap: _loadData,
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildLiveMatchesRow(List<LiveMatch> matches) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
          child: Row(
            children: [
              const Icon(Icons.sports_soccer_rounded, color: AppTheme.primary, size: 20),
              const SizedBox(width: 8),
              const Text(
                'Matchs en Direct & à venir',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () {
                  MainNavigation.switchTab(context, 2, subTab: 1);
                },
                child: const Text(
                  'Voir tout',
                  style: TextStyle(color: AppTheme.primary, fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 130,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: matches.length,
            itemBuilder: (context, index) {
              final match = matches[index];
              final isLive = match.status == 'live';
              final isUefa = match.league != null &&
                  (match.league!.toLowerCase().contains('champion') || match.league!.toLowerCase().contains('uefa'));

              return GestureDetector(
                onTap: () {
                  LiveScreen.playMatch(match);
                  MainNavigation.switchTab(context, 2, subTab: 1);
                },
                child: Container(
                  width: 250,
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.card,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: isLive ? AppTheme.primary.withValues(alpha: 0.6) : Colors.white10,
                      width: isLive ? 1.5 : 1,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Header : Ligue + Badge Direct
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (isUefa) ...[
                                const Icon(Icons.emoji_events_rounded, color: Colors.amber, size: 14),
                                const SizedBox(width: 4),
                              ],
                              Text(
                                match.league ?? 'Football',
                                style: TextStyle(
                                  color: isUefa ? Colors.amber : AppTheme.primary,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: isLive ? Colors.redAccent : Colors.white10,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              isLive ? 'DIRECT' : (match.minute ?? 'Bientôt'),
                              style: TextStyle(
                                color: isLive ? Colors.white : Colors.white70,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),

                      // Teams Row with Logo Images
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          // Home Team
                          Expanded(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _buildTeamLogo(match.homeLogo, match.home),
                                const SizedBox(height: 4),
                                Text(
                                  match.home,
                                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                                  textAlign: TextAlign.center,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),

                          // Score or VS
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            child: Text(
                              (match.score != null && match.score!.isNotEmpty) ? match.score! : 'VS',
                              style: TextStyle(
                                color: isLive ? Colors.amber : Colors.white54,
                                fontSize: 13,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),

                          // Away Team
                          Expanded(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _buildTeamLogo(match.awayLogo, match.away),
                                const SizedBox(height: 4),
                                Text(
                                  match.away,
                                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                                  textAlign: TextAlign.center,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildTeamLogo(String? logoUrl, String teamName) {
    if (logoUrl != null && logoUrl.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: CachedNetworkImage(
          imageUrl: logoUrl,
          width: 32,
          height: 32,
          fit: BoxFit.contain,
          placeholder: (context, url) => Container(
            width: 32,
            height: 32,
            decoration: const BoxDecoration(
              color: Colors.white10,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.shield_outlined, color: Colors.white24, size: 16),
          ),
          errorWidget: (context, url, error) => Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                teamName.isNotEmpty ? teamName[0].toUpperCase() : '?',
                style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ),
      );
    }
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          teamName.isNotEmpty ? teamName[0].toUpperCase() : '?',
          style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  Widget _buildLiveChannelsRow(List<LiveChannel> channels) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
          child: Row(
            children: [
              const Icon(Icons.live_tv_rounded, color: AppTheme.primary, size: 20),
              const SizedBox(width: 8),
              const Text(
                'Chaînes TV en Direct',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () {
                  MainNavigation.switchTab(context, 2, subTab: 0);
                },
                child: const Text(
                  'Voir tout',
                  style: TextStyle(color: AppTheme.primary, fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 100,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: channels.length,
            itemBuilder: (context, index) {
              final channel = channels[index];
              return GestureDetector(
                onTap: () {
                  MainNavigation.switchTab(context, 2, subTab: 0);
                },
                child: Container(
                  width: 100,
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white10),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      channel.logo.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: channel.logo,
                              height: 38,
                              fit: BoxFit.contain,
                              errorWidget: (context, url, error) =>
                                  const Icon(Icons.tv, color: Colors.white54, size: 28),
                            )
                          : const Icon(Icons.tv, color: Colors.white54, size: 28),
                      const SizedBox(height: 6),
                      Text(
                        channel.name,
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w500),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildMediaSection(String title, List<MediaItem> items) {
    if (items.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 10.0),
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
        ),
        SizedBox(
          height: 220,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: items.length,
            itemBuilder: (context, index) {
              final item = items[index];
              return GestureDetector(
                onTap: () => _onOpenMediaDetails(item),
                child: Container(
                  width: 130,
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: item.poster != null && item.poster!.isNotEmpty
                            ? CachedNetworkImage(
                                imageUrl: item.poster!,
                                height: 175,
                                width: 130,
                                fit: BoxFit.cover,
                                placeholder: (context, url) => Container(color: AppTheme.card),
                                errorWidget: (context, url, error) => Container(
                                  color: AppTheme.card,
                                  child: const Icon(Icons.movie, color: Colors.white30),
                                ),
                              )
                            : Container(
                                height: 175,
                                width: 130,
                                color: AppTheme.card,
                                child: const Icon(Icons.movie, color: Colors.white30),
                              ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        item.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
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
    );
  }

  Widget _buildContinueWatchingSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
          child: Row(
            children: [
              const Icon(Icons.play_circle_outline_rounded, color: AppTheme.primary, size: 20),
              const SizedBox(width: 8),
              const Text(
                'Reprendre la lecture',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const Spacer(),
              Text(
                '${_continueWatching.length}',
                style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13, fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 145,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: _continueWatching.length,
            itemBuilder: (context, index) {
              final item = _continueWatching[index];
              final percentage = (item['percentage'] as num?)?.toDouble() ?? 0.0;
              final isSeries = item['type'] == 'series' || item['type'] == 'anime' || item['season'] != null;

              return Container(
                width: 200,
                margin: const EdgeInsets.symmetric(horizontal: 4),
                child: GestureDetector(
                  onTap: () => _resumeContinueWatching(item),
                  child: Stack(
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                (item['poster'] != null && item['poster'].toString().isNotEmpty)
                                    ? CachedNetworkImage(
                                        imageUrl: item['poster'] as String,
                                        height: 100,
                                        width: 200,
                                        fit: BoxFit.cover,
                                        placeholder: (context, url) => Container(color: AppTheme.card),
                                        errorWidget: (context, url, error) => Container(
                                          height: 100,
                                          color: AppTheme.card,
                                          child: const Icon(Icons.movie, color: Colors.white24),
                                        ),
                                      )
                                    : Container(
                                        height: 100,
                                        width: 200,
                                        color: AppTheme.card,
                                        child: const Icon(Icons.movie, color: Colors.white24),
                                      ),
                                Container(
                                  height: 100,
                                  width: 200,
                                  color: Colors.black.withValues(alpha: 0.35),
                                ),
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.6),
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.white30),
                                  ),
                                  child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 22),
                                ),
                                Positioned(
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  child: LinearProgressIndicator(
                                    value: percentage,
                                    color: AppTheme.primary,
                                    backgroundColor: Colors.white24,
                                    minHeight: 4,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            item['title']?.toString() ?? 'Titre',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          if (isSeries && item['episode'] != null)
                            Text(
                              'Saison ${item['season'] ?? 1} • Ép. ${item['episode']}',
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppTheme.primary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                        ],
                      ),
                      Positioned(
                        top: 4,
                        right: 4,
                        child: GestureDetector(
                          onTap: () async {
                            await _storage.removeWatchProgress(item['id'].toString());
                            _loadData();
                          },
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.7),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.close_rounded, color: Colors.white70, size: 14),
                          ),
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
    );
  }

  void _resumeContinueWatching(Map<String, dynamic> item) {
    final media = MediaItem(
      id: item['id']?.toString() ?? '',
      title: item['title'] ?? 'Vidéo',
      poster: item['poster'],
      type: item['type'] ?? 'movie',
    );

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => WatchScreen(
          item: media,
          initialSeason: item['season'] as int?,
          initialEpisode: item['episode'] as int?,
          initialVideoUrl: item['streamUrl'] as String?,
        ),
      ),
    ).then((_) => _loadData());
  }
}
