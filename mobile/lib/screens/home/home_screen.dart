import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';
import '../../models/live_match.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../services/pagination_service.dart';
import '../../widgets/hero_carousel.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/infinite_media_section.dart';
import '../detail/detail_screen.dart';
import '../watch/watch_screen.dart';
import '../live/live_screen.dart';
import '../search/optimized_search_screen.dart';
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
  final PaginationService _paginationService = PaginationService();

  List<MediaItem> _heroSlides = [];
  List<Map<String, dynamic>> _continueWatching = [];
  List<LiveMatch> _liveMatches = [];
  List<MediaItem> _infiniteFeedItems = [];
  int _infiniteFeedPage = 1;
  bool _isLoadingMoreFeed = false;
  bool _hasMoreFeed = true;
  String _selectedMatchLeague = 'all';

  final List<Map<String, dynamic>> _homeLeagueFilters = const [
    {'id': 'all', 'label': 'Tous', 'icon': Icons.sports_soccer_rounded},
    {'id': 'live', 'label': 'En Direct', 'icon': Icons.circle_rounded},
    {'id': 'uefa', 'label': 'Champions League', 'icon': Icons.emoji_events_rounded},
    {'id': 'premier-league', 'label': 'Premier League', 'icon': Icons.sports_soccer_rounded},
    {'id': 'la-liga', 'label': 'La Liga', 'icon': Icons.sports_soccer_rounded},
    {'id': 'serie-a', 'label': 'Serie A', 'icon': Icons.sports_soccer_rounded},
    {'id': 'bundesliga', 'label': 'Bundesliga', 'icon': Icons.sports_soccer_rounded},
    {'id': 'ligue-1', 'label': 'Ligue 1', 'icon': Icons.sports_soccer_rounded},
  ];

  bool _isLoading = true;
  late ScrollController _mainScrollController;

  @override
  void initState() {
    super.initState();
    _mainScrollController = ScrollController();
    _mainScrollController.addListener(_onMainScroll);
    _loadData();
  }

  @override
  void dispose() {
    _mainScrollController.removeListener(_onMainScroll);
    _mainScrollController.dispose();
    _paginationService.resetAll();
    super.dispose();
  }

  void _onMainScroll() {
    if (!_mainScrollController.hasClients) return;
    if (_mainScrollController.position.pixels >=
        _mainScrollController.position.maxScrollExtent - 500) {
      if (!_isLoadingMoreFeed && _hasMoreFeed && !_isLoading) {
        _loadMoreFeed();
      }
    }
  }

  Future<T?> _safeCall<T>(Future<T> Function() call) async {
    try {
      return await call();
    } catch (_) {
      return null;
    }
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _infiniteFeedPage = 1;
      _hasMoreFeed = true;
    });

    try {
      final continueWatchingRes = await _storage.getContinueWatching();

      // Load all matches + champions league matches
      final allMatchesFuture = _safeCall(() => _apiService.getLiveMatches());
      final uefaMatchesFuture = _safeCall(() => _apiService.getChampionsLeagueMatches());

      final results = await Future.wait([allMatchesFuture, uefaMatchesFuture]);
      final allMatches = results[0] ?? [];
      final uefaMatches = results[1] ?? [];

      // Merge and deduplicate matches
      final matchesMap = <String, LiveMatch>{};
      for (final m in [...allMatches, ...uefaMatches]) {
        matchesMap[m.id] = m;
      }
      final mergedMatches = matchesMap.values.toList();

      // Load initial trending data for hero slides
      final trendingRes = await _paginationService.loadInitial(MediaSection.trending);
      final heroSlides = trendingRes.take(7).toList();

      // Load initial infinite discovery feed
      final feedRes = await _safeCall(() => _apiService.getPopularMovies(page: 1)) ?? [];

      if (!mounted) return;

      setState(() {
        _continueWatching = continueWatchingRes;
        _liveMatches = mergedMatches;
        _heroSlides = heroSlides;
        _infiniteFeedItems = feedRes;
        _hasMoreFeed = feedRes.isNotEmpty;
        _isLoading = false;
      });

      // Enrich hero slides with trailers in background
      if (heroSlides.isNotEmpty) {
        _apiService.enrichHeroSlidesWithTrailers(heroSlides).then((enriched) {
          if (mounted && enriched.isNotEmpty) {
            setState(() {
              _heroSlides = enriched;
            });
          }
        });
      }
    } catch (e) {
      debugPrint('Error loading home data: $e');
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _loadMoreFeed() async {
    if (_isLoadingMoreFeed || !_hasMoreFeed) return;
    setState(() => _isLoadingMoreFeed = true);

    final nextPage = _infiniteFeedPage + 1;
    try {
      List<MediaItem> newItems;
      if (nextPage % 3 == 0) {
        newItems = await _apiService.getTopRatedMovies(page: nextPage ~/ 3);
      } else if (nextPage % 2 == 0) {
        newItems = await _apiService.getPopularSeries(page: nextPage ~/ 2);
      } else {
        newItems = await _apiService.getPopularMovies(page: nextPage);
      }

      if (!mounted) return;

      if (newItems.isEmpty) {
        setState(() {
          _hasMoreFeed = false;
          _isLoadingMoreFeed = false;
        });
      } else {
        final existingIds = _infiniteFeedItems.map((e) => e.id).toSet();
        final uniqueNew = newItems.where((e) => !existingIds.contains(e.id)).toList();

        setState(() {
          _infiniteFeedItems.addAll(uniqueNew);
          _infiniteFeedPage = nextPage;
          _isLoadingMoreFeed = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading more feed: $e');
      if (mounted) {
        setState(() => _isLoadingMoreFeed = false);
      }
    }
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

  void _openSearch() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => const OptimizedSearchScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isDesktop = screenWidth >= 850;

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: AppTheme.background,
      drawer: isDesktop
          ? null
          : AppDrawer(
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
                // Main Scrollable Content with Infinite Scroll
                RefreshIndicator(
                  color: AppTheme.primary,
                  onRefresh: _loadData,
                  child: SingleChildScrollView(
                    controller: _mainScrollController,
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // HERO CAROUSEL
                        if (_heroSlides.isNotEmpty)
                          HeroCarousel(
                            slides: _heroSlides,
                            onWatchNow: _onWatchMedia,
                            onOpenDetails: _onOpenMediaDetails,
                          )
                        else
                          SizedBox(height: MediaQuery.of(context).padding.top + 70),

                        // Continue Watching
                        if (_continueWatching.isNotEmpty)
                          _buildContinueWatchingSection(),

                        // Champions League Matches (if available)
                        if (_liveMatches.isNotEmpty)
                          _buildLiveMatchesRow(_liveMatches),

                        // Infinite Scroll Sections
                        InfiniteMediaSection(
                          section: MediaSection.trending,
                          title: 'Tendance actuellement',
                          onItemTap: _onWatchMedia,
                          onDetailsTab: _onOpenMediaDetails,
                        ),
                        const SizedBox(height: 12),

                        InfiniteMediaSection(
                          section: MediaSection.upcoming,
                          title: 'Nouveautés & Sorties',
                          onItemTap: _onWatchMedia,
                          onDetailsTab: _onOpenMediaDetails,
                        ),
                        const SizedBox(height: 12),

                        InfiniteMediaSection(
                          section: MediaSection.series,
                          title: 'Séries TV Populaires',
                          onItemTap: _onWatchMedia,
                          onDetailsTab: _onOpenMediaDetails,
                        ),
                        const SizedBox(height: 12),

                        InfiniteMediaSection(
                          section: MediaSection.animes,
                          title: 'Animes & Mangas',
                          onItemTap: _onWatchMedia,
                          onDetailsTab: _onOpenMediaDetails,
                        ),
                        const SizedBox(height: 12),

                        InfiniteMediaSection(
                          section: MediaSection.african,
                          title: 'Cinéma & Séries Africains',
                          onItemTap: _onWatchMedia,
                          onDetailsTab: _onOpenMediaDetails,
                        ),
                        const SizedBox(height: 12),

                        InfiniteMediaSection(
                          section: MediaSection.actionMovies,
                          title: 'Films d\'Action & Aventure',
                          onItemTap: _onWatchMedia,
                          onDetailsTab: _onOpenMediaDetails,
                        ),
                        const SizedBox(height: 12),

                        InfiniteMediaSection(
                          section: MediaSection.comedyMovies,
                          title: 'Films de Comédie',
                          onItemTap: _onWatchMedia,
                          onDetailsTab: _onOpenMediaDetails,
                        ),
                        const SizedBox(height: 12),

                        InfiniteMediaSection(
                          section: MediaSection.horrorMovies,
                          title: 'Films d\'Horreur & Thriller',
                          onItemTap: _onWatchMedia,
                          onDetailsTab: _onOpenMediaDetails,
                        ),
                        const SizedBox(height: 16),

                        // ── INFINITE DISCOVERY FEED (EXPLORER SANS FIN) ──
                        if (_infiniteFeedItems.isNotEmpty) ...[
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                            child: Row(
                              children: [
                                const Icon(Icons.auto_awesome_rounded, color: AppTheme.primary, size: 20),
                                const SizedBox(width: 8),
                                const Text(
                                  'Explorer sans fin',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                                const Spacer(),
                                Text(
                                  '${_infiniteFeedItems.length} titres',
                                  style: const TextStyle(
                                    color: AppTheme.textSecondary,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12.0),
                            child: LayoutBuilder(
                              builder: (context, constraints) {
                                final crossAxisCount = (constraints.maxWidth / 120).floor().clamp(3, 8);
                                return GridView.builder(
                                  shrinkWrap: true,
                                  physics: const NeverScrollableScrollPhysics(),
                                  itemCount: _infiniteFeedItems.length,
                                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                                    crossAxisCount: crossAxisCount,
                                    childAspectRatio: 0.62,
                                    crossAxisSpacing: 8,
                                    mainAxisSpacing: 10,
                                  ),
                                  itemBuilder: (context, index) {
                                    final item = _infiniteFeedItems[index];
                                    return GestureDetector(
                                      onTap: () => _onOpenMediaDetails(item),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Expanded(
                                            child: ClipRRect(
                                              borderRadius: BorderRadius.circular(10),
                                              child: (item.poster != null && item.poster!.isNotEmpty)
                                                  ? CachedNetworkImage(
                                                      imageUrl: item.poster!,
                                                      fit: BoxFit.cover,
                                                      width: double.infinity,
                                                      placeholder: (context, url) => Container(color: AppTheme.card),
                                                      errorWidget: (context, url, error) => Container(
                                                        color: AppTheme.card,
                                                        child: const Icon(Icons.movie, color: Colors.white24),
                                                      ),
                                                    )
                                                  : Container(
                                                      color: AppTheme.card,
                                                      child: const Icon(Icons.movie, color: Colors.white24),
                                                    ),
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            item.title,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 11,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  },
                                );
                              },
                            ),
                          ),
                        ],

                        if (_isLoadingMoreFeed)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 24),
                            child: Center(
                              child: CircularProgressIndicator(
                                color: AppTheme.primary,
                                strokeWidth: 2.5,
                              ),
                            ),
                          ),

                        const SizedBox(height: 60),
                      ],
                    ),
                  ),
                ),

                // Floating Header with Search Button (Mobile Only)
                if (!isDesktop)
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.black.withValues(alpha: 0.6),
                            Colors.transparent,
                          ],
                        ),
                      ),
                      padding: EdgeInsets.fromLTRB(
                        16,
                        MediaQuery.of(context).padding.top + 8,
                        16,
                        16,
                      ),
                      child: Row(
                        children: [
                          // Menu Button
                          GestureDetector(
                            onTap: () => _scaffoldKey.currentState?.openDrawer(),
                            child: const Icon(
                              Icons.menu_rounded,
                              color: Colors.white,
                              size: 24,
                            ),
                          ),
                          const Spacer(),

                          // Search Button
                          GestureDetector(
                            onTap: _openSearch,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 8,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.1),
                                ),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.search_rounded,
                                    color: AppTheme.primary,
                                    size: 18,
                                  ),
                                  SizedBox(width: 6),
                                  Text(
                                    'Rechercher',
                                    style: TextStyle(
                                      color: Colors.white70,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
    );
  }

  List<LiveMatch> _filterMatches(List<LiveMatch> matches, String leagueFilter) {
    if (leagueFilter == 'all') return matches;
    if (leagueFilter == 'live') {
      return matches.where((m) => m.status == 'live').toList();
    }
    if (leagueFilter == 'uefa') {
      return matches.where((m) =>
          m.league != null &&
          (m.league!.toLowerCase().contains('champion') || m.league!.toLowerCase().contains('uefa'))).toList();
    }
    if (leagueFilter == 'premier-league') {
      return matches.where((m) =>
          m.league != null &&
          (m.league!.toLowerCase().contains('premier') || m.league!.toLowerCase().contains('epl') || m.league!.toLowerCase().contains('england'))).toList();
    }
    if (leagueFilter == 'la-liga') {
      return matches.where((m) =>
          m.league != null &&
          (m.league!.toLowerCase().contains('liga') || m.league!.toLowerCase().contains('spain') || m.league!.toLowerCase().contains('primera'))).toList();
    }
    if (leagueFilter == 'serie-a') {
      return matches.where((m) =>
          m.league != null &&
          (m.league!.toLowerCase().contains('serie a') || m.league!.toLowerCase().contains('italy') || m.league!.toLowerCase().contains('italia'))).toList();
    }
    if (leagueFilter == 'bundesliga') {
      return matches.where((m) =>
          m.league != null &&
          (m.league!.toLowerCase().contains('bundesliga') || m.league!.toLowerCase().contains('germany'))).toList();
    }
    if (leagueFilter == 'ligue-1') {
      return matches.where((m) =>
          m.league != null &&
          (m.league!.toLowerCase().contains('ligue 1') || m.league!.toLowerCase().contains('france'))).toList();
    }
    return matches;
  }

  Widget _buildLiveMatchesRow(List<LiveMatch> matches) {
    final displayedMatches = _filterMatches(matches, _selectedMatchLeague);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
          child: Row(
            children: [
              const Icon(Icons.sports_soccer_rounded, color: AppTheme.primary, size: 20),
              const SizedBox(width: 8),
              const Text(
                'Matchs de Football en Direct',
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

        // ── LEAGUE FILTER PILLS ──
        SizedBox(
          height: 38,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: _homeLeagueFilters.length,
            itemBuilder: (context, index) {
              final filter = _homeLeagueFilters[index];
              final isSelected = _selectedMatchLeague == filter['id'];

              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: InkWell(
                  onTap: () {
                    setState(() {
                      _selectedMatchLeague = filter['id'] as String;
                    });
                  },
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: isSelected ? AppTheme.primary : AppTheme.card,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: isSelected ? AppTheme.primary : Colors.white10,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          filter['icon'] as IconData,
                          size: 14,
                          color: isSelected ? Colors.white : (filter['id'] == 'live' ? Colors.redAccent : Colors.white60),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          filter['label'] as String,
                          style: TextStyle(
                            color: isSelected ? Colors.white : Colors.white70,
                            fontSize: 11,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
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
        const SizedBox(height: 10),

        displayedMatches.isEmpty
            ? Container(
                height: 100,
                margin: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.white10),
                ),
                child: Center(
                  child: Text(
                    'Aucun match programmé pour ce championnat en ce moment',
                    style: TextStyle(color: Colors.white54, fontSize: 12),
                    textAlign: TextAlign.center,
                  ),
                ),
              )
            : SizedBox(
                height: 135,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: displayedMatches.length,
                  itemBuilder: (context, index) {
                    final match = displayedMatches[index];
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
                            // Header : League + Live Badge
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

                            // Teams with logos
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

                          // Score
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
