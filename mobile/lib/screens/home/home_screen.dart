import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/media_item.dart';
import '../../models/live_match.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../services/app_update_service.dart';
import '../../widgets/hero_carousel.dart';
import '../../widgets/top_10_section.dart';
import '../../widgets/upcoming_section.dart';
import '../../widgets/spotlight_grid.dart';
import '../../widgets/media_scroll_row.dart';
import '../detail/detail_screen.dart';
import '../watch/watch_screen.dart';
import '../live/live_matches_screen.dart';
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

  // All Sections data synchronized with Web App
  List<MediaItem> _heroSlides = [];
  List<Map<String, dynamic>> _continueWatching = [];
  List<LiveMatch> _liveMatches = [];
  List<MediaItem> _trendingAll = [];
  List<MediaItem> _newReleases = [];
  List<MediaItem> _upcomingMovies = [];
  List<MediaItem> _top10Items = [];
  List<MediaItem> _tvForYou = [];
  List<MediaItem> _allTimeFavorites = [];
  List<MediaItem> _boxOffice = [];
  List<MediaItem> _newAnime = [];
  List<MediaItem> _martialArts = [];
  List<MediaItem> _realityShows = [];
  List<MediaItem> _barbieMovies = [];
  List<MediaItem> _actionMovies = [];
  List<MediaItem> _comedyMovies = [];
  List<MediaItem> _actionSeries = [];
  List<MediaItem> _africanMovies = [];
  List<MediaItem> _africanSeries = [];
  List<MediaItem> _saDrama = [];
  List<MediaItem> _madeInChina = [];
  List<MediaItem> _popularSeries = [];
  List<MediaItem> _animeCollection = [];
  List<MediaItem> _animationSeries = [];

  // Infinite Discovery Feed
  List<MediaItem> _infiniteFeedItems = [];
  int _infiniteFeedPage = 1;
  bool _isLoadingMoreFeed = false;
  bool _hasMoreFeed = true;

  String _selectedMatchLeague = 'all';
  bool _isLoading = true;
  late ScrollController _mainScrollController;

  final List<Map<String, dynamic>> _homeLeagueFilters = [
    {'id': 'all', 'label': 'Tous', 'icon': FontAwesomeIcons.futbol},
    {'id': 'live', 'label': 'En Direct', 'icon': FontAwesomeIcons.circle},
    {'id': 'uefa', 'label': 'Champions League', 'icon': FontAwesomeIcons.trophy},
    {'id': 'premier-league', 'label': 'Premier League', 'icon': FontAwesomeIcons.futbol},
    {'id': 'la-liga', 'label': 'La Liga', 'icon': FontAwesomeIcons.futbol},
    {'id': 'serie-a', 'label': 'Serie A', 'icon': FontAwesomeIcons.futbol},
    {'id': 'bundesliga', 'label': 'Bundesliga', 'icon': FontAwesomeIcons.futbol},
    {'id': 'ligue-1', 'label': 'Ligue 1', 'icon': FontAwesomeIcons.futbol},
  ];

  @override
  void initState() {
    super.initState();
    _mainScrollController = ScrollController();
    _mainScrollController.addListener(_onMainScroll);
    _loadAllHomeData();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      AppUpdateService().showUpdateDialogIfAvailable(context, checkSilently: true);
    });
  }

  @override
  void dispose() {
    _mainScrollController.removeListener(_onMainScroll);
    _mainScrollController.dispose();
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

  Future<void> _loadAllHomeData() async {
    setState(() {
      _isLoading = true;
      _infiniteFeedPage = 1;
      _hasMoreFeed = true;
    });

    try {
      // 1. Load Continue Watching and Matches
      final continueWatchingFuture = _storage.getContinueWatching();
      final allMatchesFuture = _safeCall(() => _apiService.getLiveMatches());
      final uefaMatchesFuture = _safeCall(() => _apiService.getChampionsLeagueMatches());

      // 2. Load Core Sections matching Web
      final trendingMoviesFuture = _safeCall(() => _apiService.getTrendingMovies());
      final trendingTvFuture = _safeCall(() => _apiService.getTrendingSeries());
      final popularMoviesFuture = _safeCall(() => _apiService.getPopularMovies(page: 1));
      final popularSeriesFuture = _safeCall(() => _apiService.getPopularSeries(page: 1));
      final animeFuture = _safeCall(() => _apiService.getAnimeSeries(page: 1));
      final upcomingFuture = _safeCall(() => _apiService.getUpcomingMovies(page: 1));

      // 3. Load Additional Web Categories in Parallel
      final tvForYouFuture = _safeCall(() => _apiService.getTVForYou(page: 2));
      final allTimeFavoritesFuture = _safeCall(() => _apiService.getAllTimeFavorites(page: 1));
      final boxOfficeFuture = _safeCall(() => _apiService.getBoxOfficeMovies(page: 1));
      final newAnimeFuture = _safeCall(() => _apiService.getNewAnime(page: 1));
      final martialArtsFuture = _safeCall(() => _apiService.getMartialArtsMovies(page: 1));
      final realityShowsFuture = _safeCall(() => _apiService.getRealityShows(page: 1));
      final barbieMoviesFuture = _safeCall(() => _apiService.getBarbieMovies(page: 1));
      final actionMoviesFuture = _safeCall(() => _apiService.getActionMovies(page: 1));
      final comedyMoviesFuture = _safeCall(() => _apiService.getComedyMovies(page: 1));
      final actionSeriesFuture = _safeCall(() => _apiService.getActionSeries(page: 1));
      final africanMoviesFuture = _safeCall(() => _apiService.getAfricanMovies(page: 1));
      final africanSeriesFuture = _safeCall(() => _apiService.getAfricanSeries(page: 1));
      final saDramaFuture = _safeCall(() => _apiService.getSADrama(page: 1));
      final madeInChinaFuture = _safeCall(() => _apiService.getMadeInChina(page: 1));
      final animationSeriesFuture = _safeCall(() => _apiService.getAnimationSeries(page: 1));

      final results = await Future.wait([
        continueWatchingFuture,
        allMatchesFuture,
        uefaMatchesFuture,
        trendingMoviesFuture,
        trendingTvFuture,
        popularMoviesFuture,
        popularSeriesFuture,
        animeFuture,
        upcomingFuture,
        tvForYouFuture,
        allTimeFavoritesFuture,
        boxOfficeFuture,
        newAnimeFuture,
        martialArtsFuture,
        realityShowsFuture,
        barbieMoviesFuture,
        actionMoviesFuture,
        comedyMoviesFuture,
        actionSeriesFuture,
        africanMoviesFuture,
        africanSeriesFuture,
        saDramaFuture,
        madeInChinaFuture,
        animationSeriesFuture,
      ]);

      final cw = results[0] as List<Map<String, dynamic>>? ?? [];
      final matches1 = (results[1] as List<LiveMatch>?) ?? [];
      final matches2 = (results[2] as List<LiveMatch>?) ?? [];
      final trendM = (results[3] as List<MediaItem>?) ?? [];
      final trendTV = (results[4] as List<MediaItem>?) ?? [];
      final popM = (results[5] as List<MediaItem>?) ?? [];
      final popTV = (results[6] as List<MediaItem>?) ?? [];
      final animes = (results[7] as List<MediaItem>?) ?? [];
      final upcoming = (results[8] as List<MediaItem>?) ?? [];
      final tvForYou = (results[9] as List<MediaItem>?) ?? [];
      final allTimeFav = (results[10] as List<MediaItem>?) ?? [];
      final boxOffice = (results[11] as List<MediaItem>?) ?? [];
      final newAnime = (results[12] as List<MediaItem>?) ?? [];
      final martialArts = (results[13] as List<MediaItem>?) ?? [];
      final realityShows = (results[14] as List<MediaItem>?) ?? [];
      final barbie = (results[15] as List<MediaItem>?) ?? [];
      final actionM = (results[16] as List<MediaItem>?) ?? [];
      final comedyM = (results[17] as List<MediaItem>?) ?? [];
      final actionS = (results[18] as List<MediaItem>?) ?? [];
      final africanM = (results[19] as List<MediaItem>?) ?? [];
      final africanS = (results[20] as List<MediaItem>?) ?? [];
      final saDrama = (results[21] as List<MediaItem>?) ?? [];
      final madeInChina = (results[22] as List<MediaItem>?) ?? [];
      final animSeries = (results[23] as List<MediaItem>?) ?? [];

      // Merge and deduplicate matches
      final matchMap = <String, LiveMatch>{};
      for (final m in [...matches1, ...matches2]) {
        matchMap[m.id] = m;
      }
      final mergedMatches = matchMap.values.toList();

      // Combined Trending
      final trendingAll = <MediaItem>[];
      final maxTrend = trendM.length > trendTV.length ? trendM.length : trendTV.length;
      for (int i = 0; i < maxTrend; i++) {
        if (i < trendM.length) trendingAll.add(trendM[i]);
        if (i < trendTV.length) trendingAll.add(trendTV[i]);
      }

      // Hero Carousel balanced mix (matching web HeroBase logic)
      final heroList = <MediaItem>[];
      final mSlice = popM.take(5).toList();
      final sSlice = popTV.take(4).toList();
      final aSlice = animes.take(3).toList();
      final maxHero = [mSlice.length, sSlice.length, aSlice.length].reduce((a, b) => a > b ? a : b);
      for (int i = 0; i < maxHero; i++) {
        if (i < mSlice.length) heroList.add(mSlice[i]);
        if (i < sSlice.length) heroList.add(sSlice[i]);
        if (i < aSlice.length) heroList.add(aSlice[i]);
      }
      final heroSlides = heroList.isNotEmpty ? heroList.take(10).toList() : trendingAll.take(7).toList();

      // Top 10 items
      final top10Items = trendingAll.isNotEmpty ? trendingAll.take(10).toList() : popM.take(10).toList();

      // Upcoming movies
      final upcomingMovies = upcoming.isNotEmpty ? upcoming : popM.take(8).toList();

      if (!mounted) return;

      setState(() {
        _continueWatching = cw;
        _liveMatches = mergedMatches;
        _heroSlides = heroSlides;
        _top10Items = top10Items;
        _trendingAll = trendingAll.isNotEmpty ? trendingAll : popM;
        _newReleases = popM;
        _upcomingMovies = upcomingMovies;
        _tvForYou = tvForYou.isNotEmpty ? tvForYou : popTV;
        _allTimeFavorites = allTimeFav.isNotEmpty ? allTimeFav : trendM;
        _boxOffice = boxOffice.isNotEmpty ? boxOffice : popM;
        _newAnime = newAnime.isNotEmpty ? newAnime : animes;
        _martialArts = martialArts.isNotEmpty ? martialArts : actionM;
        _realityShows = realityShows.isNotEmpty ? realityShows : popTV;
        _barbieMovies = barbie.isNotEmpty ? barbie : comedyM;
        _actionMovies = actionM;
        _comedyMovies = comedyM;
        _actionSeries = actionS;
        _africanMovies = africanM;
        _africanSeries = africanS;
        _saDrama = saDrama;
        _madeInChina = madeInChina;
        _popularSeries = popTV;
        _animeCollection = animes;
        _animationSeries = animSeries;
        _infiniteFeedItems = popM;
        _hasMoreFeed = popM.isNotEmpty;
        _isLoading = false;
      });

      // Background enrichment for hero slides with trailers
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
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : Stack(
              children: [
                // Main Scrollable Body
                RefreshIndicator(
                  color: AppTheme.primary,
                  onRefresh: _loadAllHomeData,
                  child: SingleChildScrollView(
                    controller: _mainScrollController,
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // 1. HERO CAROUSEL (AVEC LECTEUR VIDÉO INTÉGRÉ)
                        if (_heroSlides.isNotEmpty)
                          HeroCarousel(
                            slides: _heroSlides,
                            onWatchNow: _onWatchMedia,
                            onOpenDetails: _onOpenMediaDetails,
                          )
                        else
                          SizedBox(height: MediaQuery.of(context).padding.top + 70),

                        // 2. REPRENDRE LA LECTURE (CONTINUE WATCHING)
                        if (_continueWatching.isNotEmpty)
                          _buildContinueWatchingSection(),

                        // 3. MATCHS EN DIRECT (SPORTS ROW)
                        if (_liveMatches.isNotEmpty)
                          _buildLiveMatchesRow(_liveMatches),

                        // 4. ROW 1 : TENDANCE ACTUELLEMENT (TRENDING ALL)
                        if (_trendingAll.isNotEmpty) ...[
                          MediaScrollRow(
                            title: 'Tendance actuellement',
                            items: _trendingAll,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 12),
                        ],

                        // 5. ROW 2 : NOUVEAUTÉS (NEW RELEASES)
                        if (_newReleases.isNotEmpty) ...[
                          MediaScrollRow(
                            title: 'Nouveautés',
                            items: _newReleases,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 12),
                        ],

                        // 6. FILMS À VENIR / PROCHAINEMENT (UPCOMING SPOTLIGHT SECTION)
                        if (_upcomingMovies.isNotEmpty) ...[
                          UpcomingSection(
                            items: _upcomingMovies,
                            onWatchNow: _onWatchMedia,
                            onOpenDetails: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 16),
                        ],

                        // 7. TOP 10 : CE QUE TOUT LE MONDE REGARDE (GRANDS NUMÉROS 1 À 10)
                        if (_top10Items.isNotEmpty) ...[
                          Top10Section(
                            title: 'Top 10 : Ce que tout le monde regarde',
                            items: _top10Items,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 14),
                        ],

                        // 8. ROW 3 : TV FOR YOU
                        if (_tvForYou.isNotEmpty) ...[
                          MediaScrollRow(
                            title: 'TV for you',
                            items: _tvForYou,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 12),
                        ],

                        // 9. ROW 4 : ALL TIME FAVORITE
                        if (_allTimeFavorites.isNotEmpty) ...[
                          MediaScrollRow(
                            title: 'All time favorite',
                            items: _allTimeFavorites,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 12),
                        ],

                        // 10. ROW 5 : BOX OFFICE
                        if (_boxOffice.isNotEmpty) ...[
                          MediaScrollRow(
                            title: 'Box office',
                            items: _boxOffice,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 14),
                        ],

                        // 11. SPOTLIGHT GRID (COUPS DE CŒUR & SÉLECTION 4-CARTES)
                        if (_trendingAll.length >= 5) ...[
                          SpotlightGrid(
                            items: _trendingAll.skip(1).take(4).toList(),
                            onWatchNow: _onWatchMedia,
                            onOpenDetails: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 16),
                        ],

                        // 12. ROW 6 : NEW ANIME
                        if (_newAnime.isNotEmpty) ...[
                          MediaScrollRow(
                            title: 'New Anime',
                            items: _newAnime,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 12),
                        ],

                        // 13. ROW 7 : MARTIAL ART
                        if (_martialArts.isNotEmpty) ...[
                          MediaScrollRow(
                            title: 'Martial art',
                            items: _martialArts,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 12),
                        ],

                        // 14. ROW 8 : REALITY SHOW
                        if (_realityShows.isNotEmpty) ...[
                          MediaScrollRow(
                            title: 'Reality Show',
                            items: _realityShows,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 12),
                        ],

                        // 15. ROW 9 : BARBIE WORLD
                        if (_barbieMovies.isNotEmpty) ...[
                          MediaScrollRow(
                            title: 'Barbie World',
                            items: _barbieMovies,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 12),
                        ],

                        // 16. ROW 10 : FILMS D'ACTION
                        if (_actionMovies.isNotEmpty) ...[
                          MediaScrollRow(
                            title: 'Films d\'Action',
                            items: _actionMovies,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 12),
                        ],

                        // 17. ROW 11 : COMÉDIES À VOIR
                        if (_comedyMovies.isNotEmpty) ...[
                          MediaScrollRow(
                            title: 'Comédies à voir',
                            items: _comedyMovies,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 12),
                        ],

                        // 18. ROW 12 : SÉRIES ACTION & AVENTURE
                        if (_actionSeries.isNotEmpty) ...[
                          MediaScrollRow(
                            title: 'Séries Action & Aventure',
                            items: _actionSeries,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 12),
                        ],

                        // 19. ROW 13 : FILMS AFRICAINS
                        if (_africanMovies.isNotEmpty) ...[
                          MediaScrollRow(
                            title: 'Films Africains',
                            items: _africanMovies,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 12),
                        ],

                        // 20. ROW 14 : SÉRIES AFRICAINES
                        if (_africanSeries.isNotEmpty) ...[
                          MediaScrollRow(
                            title: 'Séries Africaines',
                            items: _africanSeries,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 12),
                        ],

                        // 21. ROW 15 : SA DRAMA
                        if (_saDrama.isNotEmpty) ...[
                          MediaScrollRow(
                            title: 'SA Drama',
                            items: _saDrama,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 12),
                        ],

                        // 22. ROW 16 : MADE IN CHINA
                        if (_madeInChina.isNotEmpty) ...[
                          MediaScrollRow(
                            title: 'Made in China',
                            items: _madeInChina,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 12),
                        ],

                        // 23. ROW 17 : SÉRIES POPULAIRES
                        if (_popularSeries.isNotEmpty) ...[
                          MediaScrollRow(
                            title: 'Séries Populaires',
                            items: _popularSeries,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 12),
                        ],

                        // 24. ROW 18 : COLLECTION ANIME
                        if (_animeCollection.isNotEmpty) ...[
                          MediaScrollRow(
                            title: 'Collection Anime',
                            items: _animeCollection,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 12),
                        ],

                        // 25. ROW 19 : SÉRIES D'ANIMATION
                        if (_animationSeries.isNotEmpty) ...[
                          MediaScrollRow(
                            title: 'Séries d\'Animation',
                            items: _animationSeries,
                            onItemTap: _onWatchMedia,
                            onDetailsTap: _onOpenMediaDetails,
                          ),
                          const SizedBox(height: 16),
                        ],

                        // 26. INFINITE DISCOVERY FEED (EXPLORER SANS FIN)
                        if (_infiniteFeedItems.isNotEmpty) ...[
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                            child: Row(
                              children: [
                                const FaIcon(FontAwesomeIcons.wandMagicSparkles, color: AppTheme.primary, size: 18),
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
                                final crossAxisCount = (constraints.maxWidth / 115).floor().clamp(3, 8);
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
                                              borderRadius: BorderRadius.circular(14),
                                              child: (item.poster != null && item.poster!.isNotEmpty)
                                                  ? CachedNetworkImage(
                                                      imageUrl: item.poster!,
                                                      fit: BoxFit.cover,
                                                      width: double.infinity,
                                                      placeholder: (context, url) => Container(color: AppTheme.card),
                                                      errorWidget: (context, url, error) => Container(
                                                        color: AppTheme.card,
                                                        child: const FaIcon(FontAwesomeIcons.film, color: Colors.white24),
                                                      ),
                                                    )
                                                  : Container(
                                                      color: AppTheme.card,
                                                      child: const FaIcon(FontAwesomeIcons.film, color: Colors.white24),
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

                        const SizedBox(height: 70),
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
                            Colors.black.withValues(alpha: 0.65),
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
                          const Spacer(),
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
                                  color: Colors.white.withValues(alpha: 0.12),
                                ),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  FaIcon(
                                    FontAwesomeIcons.magnifyingGlass,
                                    color: AppTheme.primary,
                                    size: 16,
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
              const FaIcon(FontAwesomeIcons.futbol, color: AppTheme.primary, size: 18),
              const SizedBox(width: 8),
              const Text(
                'Matchs de Football en Direct',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Colors.white),
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

        // League Filter Pills
        SizedBox(
          height: 36,
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
                        FaIcon(
                          filter['icon'],
                          size: 13,
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
                height: 90,
                margin: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white10),
                ),
                child: const Center(
                  child: Text(
                    'Aucun match programmé pour ce championnat en ce moment',
                    style: TextStyle(color: Colors.white54, fontSize: 12),
                    textAlign: TextAlign.center,
                  ),
                ),
              )
            : SizedBox(
                height: 130,
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
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => LiveMatchesScreen(initialMatch: match),
                          ),
                        );
                      },
                      child: Container(
                        width: 245,
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppTheme.card,
                          borderRadius: BorderRadius.circular(16),
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
                                      const FaIcon(FontAwesomeIcons.trophy, color: Colors.amber, size: 13),
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
          width: 28,
          height: 28,
          fit: BoxFit.contain,
          placeholder: (context, url) => Container(
            width: 28,
            height: 28,
            decoration: const BoxDecoration(
              color: Colors.white10,
              shape: BoxShape.circle,
            ),
            child: const FaIcon(FontAwesomeIcons.shield, color: Colors.white24, size: 14),
          ),
          errorWidget: (context, url, error) => Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                teamName.isNotEmpty ? teamName[0].toUpperCase() : '?',
                style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ),
      );
    }
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          teamName.isNotEmpty ? teamName[0].toUpperCase() : '?',
          style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
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
              const FaIcon(FontAwesomeIcons.circlePlay, color: AppTheme.primary, size: 18),
              const SizedBox(width: 8),
              const Text(
                'Reprendre la lecture',
                style: TextStyle(
                  fontSize: 17,
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
                width: 195,
                margin: const EdgeInsets.symmetric(horizontal: 4),
                child: GestureDetector(
                  onTap: () => _resumeContinueWatching(item),
                  child: Stack(
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(14),
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                (item['poster'] != null && item['poster'].toString().isNotEmpty)
                                    ? CachedNetworkImage(
                                        imageUrl: item['poster'] as String,
                                        height: 100,
                                        width: 195,
                                        fit: BoxFit.cover,
                                        placeholder: (context, url) => Container(color: AppTheme.card),
                                        errorWidget: (context, url, error) => Container(
                                          height: 100,
                                          color: AppTheme.card,
                                          child: const FaIcon(FontAwesomeIcons.film, color: Colors.white24),
                                        ),
                                      )
                                    : Container(
                                        height: 100,
                                        width: 195,
                                        color: AppTheme.card,
                                        child: const FaIcon(FontAwesomeIcons.film, color: Colors.white24),
                                      ),
                                Container(
                                  height: 100,
                                  width: 195,
                                  color: Colors.black.withValues(alpha: 0.35),
                                ),
                                Container(
                                  padding: const EdgeInsets.all(7),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.6),
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.white30),
                                  ),
                                  child: const FaIcon(FontAwesomeIcons.play, color: Colors.white, size: 20),
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
                          const SizedBox(height: 5),
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
                            _loadAllHomeData();
                          },
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.7),
                              shape: BoxShape.circle,
                            ),
                            child: const FaIcon(FontAwesomeIcons.xmark, color: Colors.white70, size: 13),
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
    ).then((_) => _loadAllHomeData());
  }
}
