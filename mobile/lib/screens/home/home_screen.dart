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

  List<LiveMatch> _liveMatches = [];
  List<LiveChannel> _liveChannels = [];

  String _selectedCategory = 'Tous';
  bool _isLoading = true;

  final List<String> _categories = [
    'Tous',
    'Films',
    'Séries',
    'Animes',
    'Africains',
    'Action',
    'Comédie',
    'Horreur',
    'En Direct',
  ];

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
    final channelsRes = await _safeCall(() => _apiService.getLiveChannels()) ?? [];

    if (!mounted) return;

    setState(() {
      _user = cachedUser;
      _trending = trendingRes;
      _upcoming = upcomingRes;
      _series = seriesRes;
      _animes = animesRes;
      _african = africanRes;
      _actionMovies = actionRes;
      _comedyMovies = comedyRes;
      _horrorMovies = horrorRes;

      _liveMatches = matchesRes;
      _liveChannels = channelsRes;

      _heroSlides = [
        if (_trending.isNotEmpty) ..._trending.take(3),
        if (_series.isNotEmpty) ..._series.take(2),
        if (_animes.isNotEmpty) ..._animes.take(2),
      ];

      _isLoading = false;
    });

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
        activeCategory: _selectedCategory,
        onSelectCategory: (cat) {
          setState(() => _selectedCategory = cat);
        },
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : RefreshIndicator(
              color: AppTheme.primary,
              onRefresh: _loadData,
              child: CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(
                    child: AppHeader(
                      scaffoldKey: _scaffoldKey,
                      user: _user,
                      selectedCategory: _selectedCategory,
                      categories: _categories,
                      onSelectCategory: (cat) => setState(() => _selectedCategory = cat),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (_selectedCategory == 'Tous' && _heroSlides.isNotEmpty)
                          HeroCarousel(
                            slides: _heroSlides,
                            onWatchNow: _onWatchMedia,
                            onOpenDetails: _onOpenMediaDetails,
                          ),

                        if (_selectedCategory == 'En Direct') ...[
                          _buildLiveSection(),
                        ] else if (!_hasDataForCategory(_selectedCategory)) ...[
                          _buildEmptyOrErrorState(),
                        ] else ...[
                          if (_shouldShowSection('Films')) ...[
                            _buildMediaSection('Tendance actuellement', _trending),
                            _buildMediaSection('Nouveautés & Sorties', _upcoming),
                          ],
                          if (_shouldShowSection('Séries'))
                            _buildMediaSection('Séries TV Populaires', _series),
                          if (_shouldShowSection('Animes'))
                            _buildMediaSection('Animes & Mangas', _animes),
                          if (_shouldShowSection('Africains'))
                            _buildMediaSection('Cinéma & Séries Africains', _african),
                          if (_shouldShowSection('Action'))
                            _buildMediaSection('Films d\'Action & Aventure', _actionMovies),
                          if (_shouldShowSection('Comédie'))
                            _buildMediaSection('Films de Comédie', _comedyMovies),
                          if (_shouldShowSection('Horreur'))
                            _buildMediaSection('Films d\'Horreur & Thriller', _horrorMovies),
                        ],

                        const SizedBox(height: 40),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  bool _hasDataForCategory(String category) {
    if (category == 'Tous') {
      return _trending.isNotEmpty ||
          _upcoming.isNotEmpty ||
          _series.isNotEmpty ||
          _animes.isNotEmpty ||
          _african.isNotEmpty ||
          _actionMovies.isNotEmpty ||
          _comedyMovies.isNotEmpty ||
          _horrorMovies.isNotEmpty;
    }
    if (category == 'Films') return _trending.isNotEmpty || _upcoming.isNotEmpty;
    if (category == 'Séries') return _series.isNotEmpty;
    if (category == 'Animes') return _animes.isNotEmpty;
    if (category == 'Africains') return _african.isNotEmpty;
    if (category == 'Action') return _actionMovies.isNotEmpty;
    if (category == 'Comédie') return _comedyMovies.isNotEmpty;
    if (category == 'Horreur') return _horrorMovies.isNotEmpty;
    return false;
  }

  Widget _buildEmptyOrErrorState() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 64),
      alignment: Alignment.center,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.signal_wifi_off_rounded, size: 64, color: AppTheme.textSecondary),
          const SizedBox(height: 16),
          const Text(
            'Aucun contenu disponible',
            style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'Vérifiez la connexion avec le serveur ou actualisez la page.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 20),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            ),
            onPressed: _loadData,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Réessayer', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  bool _shouldShowSection(String category) {
    return _selectedCategory == 'Tous' || _selectedCategory == category;
  }

  Widget _buildLiveSection() {
    if (_liveMatches.isEmpty && _liveChannels.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(32),
        alignment: Alignment.center,
        child: const Column(
          children: [
            Icon(Icons.live_tv_rounded, size: 64, color: AppTheme.textSecondary),
            SizedBox(height: 16),
            Text(
              'Aucun flux en direct disponible',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 8),
            Text(
              'Les chaînes IPTV et événements sportifs apparaîtront dès qu\'ils seront en ligne.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_liveMatches.isNotEmpty) _buildLiveMatchesRow(_liveMatches),
        if (_liveChannels.isNotEmpty) _buildLiveChannelsRow(_liveChannels),
      ],
    );
  }

  Widget _buildLiveMatchesRow(List<LiveMatch> matches) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
          child: Row(
            children: [
              Icon(Icons.sports_soccer, color: AppTheme.primary, size: 20),
              SizedBox(width: 8),
              Text(
                'Matchs en Direct & à venir',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 120,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: matches.length,
            itemBuilder: (context, index) {
              final match = matches[index];
              final isLive = match.status == 'live';

              return Container(
                width: 220,
                margin: const EdgeInsets.symmetric(horizontal: 4),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(12),
                  border: isLive ? Border.all(color: AppTheme.primary) : null,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          match.league ?? 'Football',
                          style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                        ),
                        if (isLive)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.red,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text(
                              'DIRECT',
                              style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                            ),
                          ),
                      ],
                    ),
                    Text(
                      '${match.home} vs ${match.away}',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      match.score != null ? 'Score: ${match.score}' : (match.minute ?? 'Bientôt'),
                      style: TextStyle(
                        color: isLive ? AppTheme.primary : AppTheme.textSecondary,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildLiveChannelsRow(List<LiveChannel> channels) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
          child: Row(
            children: [
              Icon(Icons.live_tv, color: AppTheme.primary, size: 20),
              SizedBox(width: 8),
              Text(
                'Chaînes TV en Direct',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
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
              return Container(
                width: 100,
                margin: const EdgeInsets.symmetric(horizontal: 4),
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    channel.logo.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: channel.logo,
                            height: 40,
                            fit: BoxFit.contain,
                            errorWidget: (context, url, error) =>
                                const Icon(Icons.tv, color: Colors.white54, size: 32),
                          )
                        : const Icon(Icons.tv, color: Colors.white54, size: 32),
                    const SizedBox(height: 6),
                    Text(
                      channel.name,
                      style: const TextStyle(color: Colors.white, fontSize: 11),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
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
}
