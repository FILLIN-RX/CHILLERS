import 'dart:async';
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/live_channel.dart';
import '../../models/live_match.dart';
import '../../models/media_item.dart';
import '../../services/api_service.dart';
import '../watch/watch_screen.dart';
import '../search/optimized_search_screen.dart';

class LiveScreen extends StatefulWidget {
  static final GlobalKey<LiveScreenState> liveKey = GlobalKey<LiveScreenState>();

  static void selectTab(int index) {
    liveKey.currentState?.switchCategoryByIndex(index);
  }

  static void playMatch(LiveMatch match) {
    liveKey.currentState?.openMatchPlayer(match);
  }

  static void playChannel(LiveChannel channel) {
    liveKey.currentState?.openChannelPlayer(channel);
  }

  const LiveScreen({super.key});

  @override
  State<LiveScreen> createState() => LiveScreenState();
}

class LiveScreenState extends State<LiveScreen> {
  final ApiService _apiService = ApiService();

  List<LiveChannel> _channels = [];
  List<LiveMatch> _matches = [];
  bool _isLoading = true;

  String _selectedCategory = 'all';
  String _selectedLeague = 'all';
  String _viewMode = 'mosaic'; // 'mosaic' (Canal+ logos) or 'cards' (16:9 affiches)
  String _searchQuery = '';
  final Set<String> _favoriteSlugs = {};

  final TextEditingController _searchController = TextEditingController();

  // Hero Promo Carousel State
  int _heroSlideIndex = 0;
  Timer? _heroTimer;

  static const List<Map<String, dynamic>> _heroPromos = [
    {
      'id': 'can-2027',
      'badge': 'CAN 2027 QUALIFIERS',
      'title': 'SUIVEZ LES QUALIFICATIONS DE LA CAN 2027',
      'subtitle': 'EN DIRECT ET EN EXCLUSIVITÉ SUR CHILLERS',
      'color': Color(0xFFFFCC00),
      'textColor': Colors.black,
      'badgeColor': Colors.black,
      'badgeTextColor': Colors.white,
      'icon': FontAwesomeIcons.trophy,
    },
    {
      'id': 'ucl-2026',
      'badge': 'UEFA CHAMPIONS LEAGUE',
      'title': 'LA PLUS GRANDE DES COMPÉTITIONS EUROPÉENNES',
      'subtitle': 'TOUS LES MATCHS DES PHASES DE GROUPES EN DIRECT',
      'color': Color(0xFF0A192F),
      'textColor': Colors.white,
      'badgeColor': Color(0xFF0284C7),
      'badgeTextColor': Colors.white,
      'icon': FontAwesomeIcons.star,
    },
    {
      'id': 'pl-2026',
      'badge': 'PREMIER LEAGUE',
      'title': 'LE MEILLEUR DU FOOTBALL ANGLAIS CHAQUE WEEK-END',
      'subtitle': 'MAN CITY • LIVERPOOL • ARSENAL • CHELSEA • REAL',
      'color': Color(0xFF38003C),
      'textColor': Colors.white,
      'badgeColor': Color(0xFF00FF87),
      'badgeTextColor': Color(0xFF38003C),
      'icon': FontAwesomeIcons.futbol,
    },
    {
      'id': 'laliga-2026',
      'badge': 'LA LIGA EA SPORTS',
      'title': 'LE CHOC DES GÉANTS • REAL MADRID vs FC BARCELONE',
      'subtitle': 'VIVEZ TOUS LES MATCHS DU CHAMPIONNAT ESPAGNOL',
      'color': Color(0xFF7B0818),
      'textColor': Colors.white,
      'badgeColor': Color(0xFFFFD700),
      'badgeTextColor': Colors.black,
      'icon': FontAwesomeIcons.trophy,
    },
    {
      'id': 'live-tv-hd',
      'badge': 'DIRECT TV & SPORT HD',
      'title': 'VOS CHAÎNES EN DIRECT ET EN EXCLUSIVITÉ',
      'subtitle': 'SPORT EN DIRECT • CINÉMA • SÉRIES • INFOS 24/7',
      'color': Color(0xFF003B6E),
      'textColor': Colors.white,
      'badgeColor': Color(0xFF22D3EE),
      'badgeTextColor': Colors.black,
      'icon': FontAwesomeIcons.tv,
    },
  ];

  static const List<Map<String, dynamic>> _categories = [
    {'id': 'all', 'label': 'Toutes', 'icon': FontAwesomeIcons.tv},
    {'id': 'sports', 'label': 'Sport', 'icon': FontAwesomeIcons.trophy},
    {'id': 'cinema', 'label': 'Cinéma', 'icon': FontAwesomeIcons.film},
    {'id': 'series', 'label': 'Séries', 'icon': FontAwesomeIcons.video},
    {'id': 'kids', 'label': 'Jeunesse', 'icon': FontAwesomeIcons.child},
    {'id': 'news', 'label': 'Infos', 'icon': FontAwesomeIcons.newspaper},
    {'id': 'documentary', 'label': 'Découverte', 'icon': FontAwesomeIcons.compass},
    {'id': 'music', 'label': 'Musique', 'icon': FontAwesomeIcons.music},
    {'id': 'favorites', 'label': 'Favoris', 'icon': FontAwesomeIcons.solidStar},
  ];

  static const List<Map<String, dynamic>> _leagueFilters = [
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
    _loadData();
    _startHeroTimer();
  }

  @override
  void dispose() {
    _heroTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _startHeroTimer() {
    _heroTimer?.cancel();
    _heroTimer = Timer.periodic(const Duration(seconds: 6), (_) {
      if (mounted) {
        setState(() {
          _heroSlideIndex = (_heroSlideIndex + 1) % _heroPromos.length;
        });
      }
    });
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);

    try {
      final channelsFuture = _apiService.getLiveChannels();
      final matchesFuture = _apiService.getLiveMatches();
      final uefaFuture = _apiService.getChampionsLeagueMatches();

      final results = await Future.wait([channelsFuture, matchesFuture, uefaFuture]);

      final channels = results[0] as List<LiveChannel>;
      final matches = results[1] as List<LiveMatch>;
      final uefa = results[2] as List<LiveMatch>;

      // Deduplicate matches
      final allMatchesMap = <String, LiveMatch>{};
      for (final m in [...matches, ...uefa]) {
        allMatchesMap[m.id] = m;
      }

      if (!mounted) return;

      setState(() {
        _channels = channels;
        _matches = allMatchesMap.values.toList();
        _isLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void switchCategoryByIndex(int index) {
    if (index >= 0 && index < _categories.length) {
      setState(() {
        _selectedCategory = _categories[index]['id'] as String;
      });
    }
  }

  void _toggleFavorite(String slug) {
    setState(() {
      if (_favoriteSlugs.contains(slug)) {
        _favoriteSlugs.remove(slug);
      } else {
        _favoriteSlugs.add(slug);
      }
    });
  }

  // ── Open Player for a Channel (no auto-play on load, user selects first!) ──
  void openChannelPlayer(LiveChannel channel) {
    final media = MediaItem(
      id: channel.id,
      title: channel.name,
      poster: channel.logo,
      type: 'channel',
      streamUrl: channel.streamUrl,
      genres: channel.categories,
    );

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => WatchScreen(
          item: media,
          initialVideoUrl: channel.streamUrl,
        ),
      ),
    );
  }

  // ── Open Player for a Live Match ──
  Future<void> openMatchPlayer(LiveMatch match) async {
    // Show quick loading snackbar if needed
    final scaffold = ScaffoldMessenger.of(context);
    scaffold.showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
            ),
            const SizedBox(width: 12),
            Expanded(child: Text('Chargement du match ${match.home} vs ${match.away}...')),
          ],
        ),
        duration: const Duration(seconds: 2),
        backgroundColor: const Color(0xFF18181B),
      ),
    );

    final streamUrl = await _apiService.getMatchStreamUrl(match.id);
    scaffold.hideCurrentSnackBar();

    if (!mounted) return;

    final media = MediaItem(
      id: 'match_${match.id}',
      title: '${match.home} vs ${match.away}',
      poster: match.homeLogo ?? match.awayLogo,
      type: 'match',
      streamUrl: streamUrl ?? '',
      genres: [match.league ?? 'Football', match.status == 'live' ? 'En Direct' : 'Match'],
    );

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => WatchScreen(
          item: media,
          initialVideoUrl: streamUrl,
        ),
      ),
    );
  }

  List<LiveChannel> get _filteredChannels {
    List<LiveChannel> list = _channels;

    if (_selectedCategory == 'favorites') {
      list = list.where((c) => _favoriteSlugs.contains(c.slug)).toList();
    } else if (_selectedCategory != 'all') {
      list = list.where((c) {
        final cats = c.categories.map((cat) => cat.toLowerCase()).toList();
        if (_selectedCategory == 'sports') return cats.any((cat) => cat.contains('sport') || cat.contains('football'));
        if (_selectedCategory == 'news') return cats.any((cat) => cat.contains('info') || cat.contains('news') || cat.contains('polit'));
        if (_selectedCategory == 'cinema') return cats.any((cat) => cat.contains('cine') || cat.contains('film') || cat.contains('movie'));
        if (_selectedCategory == 'series') return cats.any((cat) => cat.contains('serie'));
        if (_selectedCategory == 'kids') return cats.any((cat) => cat.contains('kid') || cat.contains('enfant') || cat.contains('jeunesse') || cat.contains('anim'));
        if (_selectedCategory == 'music') return cats.any((cat) => cat.contains('music') || cat.contains('musique'));
        if (_selectedCategory == 'documentary') return cats.any((cat) => cat.contains('doc') || cat.contains('decouverte'));
        return cats.any((cat) => cat.contains(_selectedCategory));
      }).toList();
    }

    if (_searchQuery.trim().isNotEmpty) {
      final q = _searchQuery.trim().toLowerCase();
      list = list.where((c) =>
          c.name.toLowerCase().contains(q) ||
          c.categories.any((cat) => cat.toLowerCase().contains(q))).toList();
    }

    return list;
  }

  List<LiveMatch> get _filteredMatches {
    if (_selectedLeague == 'all') return _matches;
    if (_selectedLeague == 'live') {
      return _matches.where((m) => m.status == 'live').toList();
    }
    if (_selectedLeague == 'uefa') {
      return _matches.where((m) =>
          m.league != null &&
          (m.league!.toLowerCase().contains('champion') || m.league!.toLowerCase().contains('uefa'))).toList();
    }
    if (_selectedLeague == 'premier-league') {
      return _matches.where((m) =>
          m.league != null &&
          (m.league!.toLowerCase().contains('premier') || m.league!.toLowerCase().contains('epl') || m.league!.toLowerCase().contains('england'))).toList();
    }
    if (_selectedLeague == 'la-liga') {
      return _matches.where((m) =>
          m.league != null &&
          (m.league!.toLowerCase().contains('liga') || m.league!.toLowerCase().contains('spain') || m.league!.toLowerCase().contains('primera'))).toList();
    }
    if (_selectedLeague == 'serie-a') {
      return _matches.where((m) =>
          m.league != null &&
          (m.league!.toLowerCase().contains('serie a') || m.league!.toLowerCase().contains('italy') || m.league!.toLowerCase().contains('italia'))).toList();
    }
    if (_selectedLeague == 'bundesliga') {
      return _matches.where((m) =>
          m.league != null &&
          (m.league!.toLowerCase().contains('bundesliga') || m.league!.toLowerCase().contains('germany'))).toList();
    }
    if (_selectedLeague == 'ligue-1') {
      return _matches.where((m) =>
          m.league != null &&
          (m.league!.toLowerCase().contains('ligue 1') || m.league!.toLowerCase().contains('france'))).toList();
    }
    return _matches;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : RefreshIndicator(
              color: AppTheme.primary,
              onRefresh: _loadData,
              child: CustomScrollView(
                slivers: [
                  // ── TOP FLOATING HEADER (AVEC RECHERCHE) ──
                  SliverAppBar(
                    floating: true,
                    pinned: false,
                    backgroundColor: Colors.black.withValues(alpha: 0.9),
                    elevation: 0,
                    title: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppTheme.primary,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'LIVE TV',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.0,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'Direct & Sport',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    actions: [
                      IconButton(
                        icon: const FaIcon(FontAwesomeIcons.magnifyingGlass, color: Colors.white70, size: 18),
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const OptimizedSearchScreen()),
                          );
                        },
                      ),
                      IconButton(
                        icon: const FaIcon(FontAwesomeIcons.arrowsRotate, color: Colors.white70, size: 16),
                        onPressed: _loadData,
                      ),
                      const SizedBox(width: 4),
                    ],
                  ),

                  // ── 1. HERO PROMO BANNERS CAROUSEL (STYLE WEB CAN & SPORTS) ──
                  if (_searchQuery.isEmpty && _selectedCategory == 'all')
                    SliverToBoxAdapter(
                      child: _buildHeroPromoCarousel(),
                    ),

                  // ── 2. MATCHS DE FOOTBALL EN DIRECT & EVENEMENTS SPORTIFS ──
                  if (_matches.isNotEmpty && _selectedCategory != 'favorites' && _searchQuery.isEmpty)
                    SliverToBoxAdapter(
                      child: _buildSportsMatchesSection(),
                    ),

                  // ── 3. CONTROLS & FILTER BAR (CATEGORIES + VIEW MODE + SEARCH) ──
                  SliverToBoxAdapter(
                    child: _buildControlsAndFilterBar(),
                  ),

                  // ── 4. CHANNELS GRID (MOSAÏQUE CANAL+ / AFFICHES 16:9) ──
                  _buildChannelsSliverGrid(),

                  const SliverToBoxAdapter(
                    child: SizedBox(height: 80),
                  ),
                ],
              ),
            ),
    );
  }

  // ── 1. Hero Promo Banner ──
  Widget _buildHeroPromoCarousel() {
    final promo = _heroPromos[_heroSlideIndex];

    return Container(
      margin: const EdgeInsets.fromLTRB(12, 6, 12, 12),
      decoration: BoxDecoration(
        color: promo['color'] as Color,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                // Left Emblem
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: FaIcon(
                      promo['icon'],
                      color: promo['textColor'] as Color,
                      size: 26,
                    ),
                  ),
                ),
                const SizedBox(width: 14),

                // Text
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: promo['badgeColor'] as Color,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          promo['badge'] as String,
                          style: TextStyle(
                            color: promo['badgeTextColor'] as Color,
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        promo['title'] as String,
                        style: TextStyle(
                          color: promo['textColor'] as Color,
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          height: 1.15,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        promo['subtitle'] as String,
                        style: TextStyle(
                          color: (promo['textColor'] as Color).withValues(alpha: 0.85),
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Slide indicator dots in bottom right
          Positioned(
            right: 12,
            bottom: 8,
            child: Row(
              children: List.generate(
                _heroPromos.length,
                (i) => Container(
                  margin: const EdgeInsets.only(left: 3),
                  width: _heroSlideIndex == i ? 14 : 4,
                  height: 4,
                  decoration: BoxDecoration(
                    color: _heroSlideIndex == i
                        ? (promo['textColor'] as Color)
                        : (promo['textColor'] as Color).withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── 2. Sports Matches Section ──
  Widget _buildSportsMatchesSection() {
    final matches = _filteredMatches;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 6.0),
          child: Row(
            children: [
              const FaIcon(FontAwesomeIcons.futbol, color: AppTheme.primary, size: 16),
              const SizedBox(width: 8),
              const Text(
                'Matchs de Football en Direct',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Colors.white),
              ),
              const Spacer(),
              Text(
                '${_matches.length} matchs',
                style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),

        // League Filters
        SizedBox(
          height: 34,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: _leagueFilters.length,
            itemBuilder: (context, index) {
              final item = _leagueFilters[index];
              final isSelected = _selectedLeague == item['id'];

              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: InkWell(
                  onTap: () => setState(() => _selectedLeague = item['id'] as String),
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: isSelected ? AppTheme.primary : AppTheme.card,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: isSelected ? AppTheme.primary : Colors.white10),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        FaIcon(
                          item['icon'],
                          size: 11,
                          color: isSelected ? Colors.white : (item['id'] == 'live' ? Colors.redAccent : Colors.white60),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          item['label'] as String,
                          style: TextStyle(
                            color: isSelected ? Colors.white : Colors.white70,
                            fontSize: 10.5,
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

        const SizedBox(height: 8),

        // Matches Horizontal List
        matches.isEmpty
            ? Container(
                height: 80,
                margin: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Center(
                  child: Text(
                    'Aucun match disponible pour ce filtre.',
                    style: TextStyle(color: Colors.white54, fontSize: 11),
                  ),
                ),
              )
            : SizedBox(
                height: 125,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: matches.length,
                  itemBuilder: (context, index) {
                    final match = matches[index];
                    final isLive = match.status == 'live';

                    return GestureDetector(
                      onTap: () => openMatchPlayer(match),
                      child: Container(
                        width: 235,
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppTheme.card,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isLive ? Colors.redAccent.withValues(alpha: 0.6) : Colors.white10,
                            width: isLive ? 1.5 : 1,
                          ),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            // League + Live tag
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    match.league ?? 'Football',
                                    style: const TextStyle(
                                      color: AppTheme.primary,
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.bold,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: isLive ? Colors.redAccent : Colors.white10,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    isLive ? 'DIRECT' : (match.minute ?? 'Bientôt'),
                                    style: TextStyle(
                                      color: isLive ? Colors.white : Colors.white70,
                                      fontSize: 8.5,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ),

                            // Teams
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                              children: [
                                Expanded(
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      _buildTeamLogo(match.homeLogo, match.home),
                                      const SizedBox(height: 3),
                                      Text(
                                        match.home,
                                        style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.bold),
                                        textAlign: TextAlign.center,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 6),
                                  child: Text(
                                    (match.score != null && match.score!.isNotEmpty) ? match.score! : 'VS',
                                    style: TextStyle(
                                      color: isLive ? Colors.amber : Colors.white54,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ),
                                Expanded(
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      _buildTeamLogo(match.awayLogo, match.away),
                                      const SizedBox(height: 3),
                                      Text(
                                        match.away,
                                        style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.bold),
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
        const SizedBox(height: 12),
      ],
    );
  }

  Widget _buildTeamLogo(String? logoUrl, String teamName) {
    if (logoUrl != null && logoUrl.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: CachedNetworkImage(
          imageUrl: logoUrl,
          width: 26,
          height: 26,
          fit: BoxFit.contain,
          errorWidget: (context, url, error) => Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                teamName.isNotEmpty ? teamName[0].toUpperCase() : '?',
                style: const TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ),
      );
    }
    return Container(
      width: 26,
      height: 26,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          teamName.isNotEmpty ? teamName[0].toUpperCase() : '?',
          style: const TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  // ── 3. Controls & Filter Bar ──
  Widget _buildControlsAndFilterBar() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Category Pills (YouTube / Web Style)
        SizedBox(
          height: 40,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: _categories.length,
            itemBuilder: (context, index) {
              final cat = _categories[index];
              final isSelected = _selectedCategory == cat['id'];

              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: InkWell(
                  onTap: () => setState(() => _selectedCategory = cat['id'] as String),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xFFDC2626) : const Color(0xFF18181B),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isSelected ? const Color(0xFFDC2626) : Colors.white12,
                      ),
                      boxShadow: isSelected
                          ? [
                              BoxShadow(
                                color: const Color(0xFFDC2626).withValues(alpha: 0.4),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ]
                          : null,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        FaIcon(
                          cat['icon'],
                          size: 11,
                          color: isSelected ? Colors.white : Colors.white60,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          cat['label'] as String,
                          style: TextStyle(
                            color: isSelected ? Colors.white : Colors.white70,
                            fontSize: 11.5,
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

        // Search Bar & View Mode Toggle Row
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12.0),
          child: Row(
            children: [
              // Search Input
              Expanded(
                child: Container(
                  height: 38,
                  decoration: BoxDecoration(
                    color: const Color(0xFF18181B),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: Row(
                    children: [
                      const SizedBox(width: 10),
                      const FaIcon(FontAwesomeIcons.magnifyingGlass, color: Colors.white38, size: 13),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _searchController,
                          style: const TextStyle(color: Colors.white, fontSize: 12),
                          decoration: const InputDecoration(
                            hintText: 'Filtrer les chaînes...',
                            hintStyle: TextStyle(color: Colors.white38, fontSize: 12),
                            border: InputBorder.none,
                            isDense: true,
                          ),
                          onChanged: (val) {
                            setState(() => _searchQuery = val);
                          },
                        ),
                      ),
                      if (_searchQuery.isNotEmpty)
                        GestureDetector(
                          onTap: () {
                            _searchController.clear();
                            setState(() => _searchQuery = '');
                          },
                          child: const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 8),
                            child: FaIcon(FontAwesomeIcons.xmark, color: Colors.white60, size: 14),
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              const SizedBox(width: 8),

              // View Mode Toggle (Mosaïque vs Cartes 16:9)
              Container(
                height: 38,
                decoration: BoxDecoration(
                  color: const Color(0xFF18181B),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white12),
                ),
                padding: const EdgeInsets.all(3),
                child: Row(
                  children: [
                    InkWell(
                      onTap: () => setState(() => _viewMode = 'mosaic'),
                      borderRadius: BorderRadius.circular(9),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        decoration: BoxDecoration(
                          color: _viewMode == 'mosaic' ? const Color(0xFFDC2626) : Colors.transparent,
                          borderRadius: BorderRadius.circular(9),
                        ),
                        child: const Row(
                          children: [
                            FaIcon(FontAwesomeIcons.tableCellsLarge, color: Colors.white, size: 12),
                            SizedBox(width: 4),
                            Text('Logos', style: TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                    InkWell(
                      onTap: () => setState(() => _viewMode = 'cards'),
                      borderRadius: BorderRadius.circular(9),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        decoration: BoxDecoration(
                          color: _viewMode == 'cards' ? const Color(0xFFDC2626) : Colors.transparent,
                          borderRadius: BorderRadius.circular(9),
                        ),
                        child: const Row(
                          children: [
                            FaIcon(FontAwesomeIcons.film, color: Colors.white, size: 12),
                            SizedBox(width: 4),
                            Text('Affiches', style: TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 12),
      ],
    );
  }

  // ── 4. Channels Grid ──
  Widget _buildChannelsSliverGrid() {
    final channels = _filteredChannels;

    if (channels.isEmpty) {
      return const SliverToBoxAdapter(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(40.0),
            child: Text(
              'Aucune chaîne trouvée.',
              style: TextStyle(color: Colors.white54, fontSize: 13),
            ),
          ),
        ),
      );
    }

    if (_viewMode == 'mosaic') {
      // ── Mosaïque de Logos Canal+ (Aspect 4:3, Dark Grey #242424) ──
      return SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        sliver: SliverGrid(
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            childAspectRatio: 1.3,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
          ),
          delegate: SliverChildBuilderDelegate(
            (context, index) {
              final channel = channels[index];
              final isFav = _favoriteSlugs.contains(channel.slug);

              return _buildCanalPlusLogoTile(channel, isFav);
            },
            childCount: channels.length,
          ),
        ),
      );
    } else {
      // ── Cartes 16:9 Affiches ──
      return SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        sliver: SliverGrid(
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            childAspectRatio: 1.15,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
          ),
          delegate: SliverChildBuilderDelegate(
            (context, index) {
              final channel = channels[index];
              final isFav = _favoriteSlugs.contains(channel.slug);

              return _buildLandscapeChannelCard(channel, isFav);
            },
            childCount: channels.length,
          ),
        ),
      );
    }
  }

  // ── Canal+ Logo Tile (Mosaïque 4:3) ──
  Widget _buildCanalPlusLogoTile(LiveChannel channel, bool isFav) {
    return GestureDetector(
      onTap: () => openChannelPlayer(channel),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF242424),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            // Center Logo
            Center(
              child: Padding(
                padding: const EdgeInsets.all(10.0),
                child: channel.logo.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: channel.logo,
                        fit: BoxFit.contain,
                        placeholder: (context, url) => Container(color: const Color(0xFF242424)),
                        errorWidget: (context, url, error) => Text(
                          channel.name,
                          style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
                          textAlign: TextAlign.center,
                        ),
                      )
                    : Text(
                        channel.name,
                        style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
                        textAlign: TextAlign.center,
                      ),
              ),
            ),

            // Favorite Star
            Positioned(
              top: 4,
              right: 4,
              child: GestureDetector(
                onTap: () => _toggleFavorite(channel.slug),
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.6),
                    shape: BoxShape.circle,
                  ),
                  child: FaIcon(
                    isFav ? FontAwesomeIcons.solidStar : FontAwesomeIcons.star,
                    color: isFav ? Colors.amber : Colors.white38,
                    size: 10,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── 16:9 Landscape Channel Card ──
  Widget _buildLandscapeChannelCard(LiveChannel channel, bool isFav) {
    final cat = channel.categories.isNotEmpty ? channel.categories.first : 'Direct';

    return GestureDetector(
      onTap: () => openChannelPlayer(channel),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF18181B),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white10),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 16:9 Top preview banner
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Container(
                    color: const Color(0xFF27272A),
                    child: Center(
                      child: channel.logo.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: channel.logo,
                              width: 50,
                              height: 50,
                              fit: BoxFit.contain,
                              errorWidget: (context, url, error) => const FaIcon(FontAwesomeIcons.tv, color: Colors.white24, size: 28),
                            )
                          : const FaIcon(FontAwesomeIcons.tv, color: Colors.white24, size: 28),
                    ),
                  ),

                  // Red DIRECT Tag
                  Positioned(
                    top: 6,
                    left: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDC2626),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          FaIcon(FontAwesomeIcons.circle, color: Colors.white, size: 5),
                          SizedBox(width: 3),
                          Text(
                            'DIRECT',
                            style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w900),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Favorite Star
                  Positioned(
                    top: 6,
                    right: 6,
                    child: GestureDetector(
                      onTap: () => _toggleFavorite(channel.slug),
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.6),
                          shape: BoxShape.circle,
                        ),
                        child: FaIcon(
                          isFav ? FontAwesomeIcons.solidStar : FontAwesomeIcons.star,
                          color: isFav ? Colors.amber : Colors.white38,
                          size: 10,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Card text info
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    channel.name,
                    style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.bold),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    cat.toUpperCase(),
                    style: const TextStyle(color: AppTheme.primary, fontSize: 9, fontWeight: FontWeight.bold),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
