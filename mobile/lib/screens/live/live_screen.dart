import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/live_channel.dart';
import '../../models/live_match.dart';
import '../../models/user_model.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../widgets/app_video_player.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/upgrade_modal.dart';
import '../search/search_screen.dart';
import '../profile/profile_screen.dart';

class LiveScreen extends StatefulWidget {
  static final GlobalKey<LiveScreenState> liveKey = GlobalKey<LiveScreenState>();

  static void selectTab(int index) {
    liveKey.currentState?.switchTab(index);
  }

  static void playMatch(LiveMatch match) {
    liveKey.currentState?.selectMatch(match);
  }

  const LiveScreen({super.key});

  @override
  State<LiveScreen> createState() => LiveScreenState();
}

class LiveScreenState extends State<LiveScreen> with SingleTickerProviderStateMixin {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final ApiService _apiService = ApiService();
  final StorageService _storage = StorageService();

  UserModel? _user;
  List<LiveChannel> _channels = [];
  List<LiveMatch> _matches = [];
  List<LiveMatch> _uefaMatches = [];
  bool _isLoading = true;

  late TabController _tabController;
  String _selectedChannelCategory = 'all';
  String _selectedMatchFilter = 'all'; // 'all', 'uefa', 'live', 'upcoming'

  LiveChannel? _activeChannel;
  LiveMatch? _activeMatch;
  String _currentStreamUrl = '';
  String _currentTitle = 'Live TV & Foot';
  String? _currentSubtitle;

  final List<Map<String, dynamic>> _channelCategories = const [
    {'id': 'all', 'label': 'Toutes', 'icon': Icons.tune_rounded},
    {'id': 'sport', 'label': 'Sports TV', 'icon': Icons.sports_soccer_rounded},
    {'id': 'cinema', 'label': 'Cinéma', 'icon': Icons.movie_creation_rounded},
    {'id': 'news', 'label': 'Infos', 'icon': Icons.newspaper_rounded},
    {'id': 'general', 'label': 'Général', 'icon': Icons.public_rounded},
    {'id': 'music', 'label': 'Musique', 'icon': Icons.music_note_rounded},
  ];

  final List<Map<String, dynamic>> _matchFilters = const [
    {'id': 'all', 'label': 'Tous les Matchs', 'icon': Icons.sports_soccer_rounded},
    {'id': 'uefa', 'label': 'Ligue des Champions', 'icon': Icons.emoji_events_rounded},
    {'id': 'live', 'label': 'En Direct', 'icon': Icons.circle_rounded},
    {'id': 'upcoming', 'label': 'À Venir', 'icon': Icons.schedule_rounded},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void switchTab(int index) {
    if (mounted && index >= 0 && index < 2) {
      _tabController.animateTo(index);
    }
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);

    final cachedUser = await _storage.getUser();

    try {
      final channelsFuture = _apiService.getLiveChannels();
      final matchesFuture = _apiService.getLiveMatches();
      final uefaFuture = _apiService.getChampionsLeagueMatches();

      final results = await Future.wait([channelsFuture, matchesFuture, uefaFuture]);

      final channels = results[0] as List<LiveChannel>;
      final matches = results[1] as List<LiveMatch>;
      final uefa = results[2] as List<LiveMatch>;

      // Dédoublonnage des matches
      final allMatchesMap = <String, LiveMatch>{};
      for (final m in [...matches, ...uefa]) {
        allMatchesMap[m.id] = m;
      }
      final allMatches = allMatchesMap.values.toList();

      if (!mounted) return;

      setState(() {
        _user = cachedUser;
        _channels = channels;
        _matches = allMatches;
        _uefaMatches = uefa.isNotEmpty
            ? uefa
            : allMatches.where((m) =>
                m.league != null &&
                (m.league!.toLowerCase().contains('champion') || m.league!.toLowerCase().contains('uefa'))).toList();
        _isLoading = false;

        if (channels.isNotEmpty && _activeChannel == null && _activeMatch == null) {
          _selectChannel(channels.first);
        }
      });
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _selectChannel(LiveChannel channel) {
    final cat = channel.categories.isNotEmpty ? channel.categories.first.toUpperCase() : 'DIRECT';
    setState(() {
      _activeMatch = null;
      _activeChannel = channel;
      _currentStreamUrl = channel.streamUrl;
      _currentTitle = channel.name;
      _currentSubtitle = cat;
    });
  }

  Future<void> selectMatch(LiveMatch match) async {
    setState(() {
      _activeChannel = null;
      _activeMatch = match;
      _currentTitle = '${match.home} vs ${match.away}';
      _currentSubtitle = '${match.league ?? 'Football'} • ${match.minute ?? (match.status == 'live' ? 'En Direct' : 'Bientôt')}';
      _tabController.animateTo(1);
    });

    final streamUrl = await _apiService.getMatchStreamUrl(match.id);

    if (!mounted) return;

    if (streamUrl != null && streamUrl.isNotEmpty) {
      setState(() {
        _currentStreamUrl = streamUrl;
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Flux direct du match en cours d\'initialisation.')),
      );
    }
  }

  List<LiveChannel> get _filteredChannels {
    if (_selectedChannelCategory == 'all') return _channels;
    return _channels.where((c) {
      final cats = c.categories.map((cat) => cat.toLowerCase()).toList();
      if (_selectedChannelCategory == 'sport') return cats.any((cat) => cat.contains('sport') || cat.contains('football'));
      if (_selectedChannelCategory == 'news') return cats.any((cat) => cat.contains('info') || cat.contains('news'));
      if (_selectedChannelCategory == 'cinema') return cats.any((cat) => cat.contains('cine') || cat.contains('film') || cat.contains('movie'));
      if (_selectedChannelCategory == 'music') return cats.any((cat) => cat.contains('music'));
      return cats.any((cat) => cat.contains(_selectedChannelCategory));
    }).toList();
  }

  List<LiveMatch> get _filteredMatches {
    if (_selectedMatchFilter == 'uefa') {
      return _uefaMatches.isNotEmpty ? _uefaMatches : _matches;
    }
    if (_selectedMatchFilter == 'live') {
      return _matches.where((m) => m.status == 'live').toList();
    }
    if (_selectedMatchFilter == 'upcoming') {
      return _matches.where((m) => m.status == 'upcoming').toList();
    }
    return _matches;
  }

  @override
  Widget build(BuildContext context) {
    final isVip = _user?.subscription?.status == 'active';
    final liveMatchesCount = _matches.where((m) => m.status == 'live').length;
    final isMatchActive = _activeMatch != null;

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: AppTheme.background,
      drawer: AppDrawer(
        activeCategory: 'En Direct',
        onSelectCategory: (_) {},
      ),
      body: SafeArea(
        child: Column(
          children: [
            // ── TOP APP HEADER ──
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: const BoxDecoration(
                color: Color(0xFF0C0C0E),
                border: Border(bottom: BorderSide(color: Colors.white10)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.menu_rounded, color: Colors.white, size: 24),
                        onPressed: () => _scaffoldKey.currentState?.openDrawer(),
                        tooltip: 'Menu',
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                      ),
                      const SizedBox(width: 12),
                      Row(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(6),
                            child: Image.asset(
                              'assets/logo.png',
                              width: 28,
                              height: 28,
                              errorBuilder: (context, error, stackTrace) => Container(
                                width: 28,
                                height: 28,
                                decoration: BoxDecoration(
                                  color: AppTheme.primary,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 18),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          RichText(
                            text: const TextSpan(
                              children: [
                                TextSpan(
                                  text: 'CHILL',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 18,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.8,
                                  ),
                                ),
                                TextSpan(
                                  text: 'ERS',
                                  style: TextStyle(
                                    color: AppTheme.primary,
                                    fontSize: 18,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.8,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),

                  Row(
                    children: [
                      GestureDetector(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const SearchScreen()),
                          );
                        },
                        child: Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.08),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.search_rounded, color: Colors.white, size: 20),
                        ),
                      ),
                      const SizedBox(width: 8),

                      GestureDetector(
                        onTap: () => UpgradeModal.show(context),
                        child: Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: Colors.amber,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.amber.withValues(alpha: 0.4),
                                blurRadius: 8,
                                spreadRadius: 1,
                              ),
                            ],
                          ),
                          child: const Icon(Icons.workspace_premium_rounded, color: Colors.black, size: 20),
                        ),
                      ),
                      const SizedBox(width: 8),

                      GestureDetector(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const ProfileScreen()),
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isVip ? Colors.amber : Colors.white24,
                              width: isVip ? 2 : 1,
                            ),
                          ),
                          child: CircleAvatar(
                            radius: 14,
                            backgroundColor: AppTheme.card,
                            child: Text(
                              (_user?.username?.isNotEmpty == true
                                      ? _user!.username![0]
                                      : (_user?.email.isNotEmpty == true ? _user!.email[0] : 'U'))
                                  .toUpperCase(),
                              style: TextStyle(
                                color: isVip ? Colors.amber : Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // ── TOP PLAYER 16:9 (DIRECT CHANNELS & MATCHS) ──
            LayoutBuilder(
              builder: (context, constraints) {
                final screenH = MediaQuery.of(context).size.height;
                final maxH = screenH > 500 ? screenH * 0.35 : 220.0;

                return ConstrainedBox(
                  constraints: BoxConstraints(maxHeight: maxH),
                  child: AspectRatio(
                    aspectRatio: 16 / 9,
                    child: Container(
                      color: Colors.black,
                      child: _currentStreamUrl.isNotEmpty
                          ? Stack(
                              children: [
                                AppVideoPlayer(
                                  key: ValueKey(_currentStreamUrl),
                                  videoUrl: _currentStreamUrl,
                                  title: _currentTitle,
                                  subtitle: _currentSubtitle,
                                  autoPlay: true,
                                ),
                                Positioned(
                                  top: 10,
                                  left: 10,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: Colors.redAccent,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const Icon(Icons.circle, color: Colors.white, size: 7),
                                        const SizedBox(width: 4),
                                        Text(
                                          isMatchActive ? 'DIRECT FOOT' : 'EN DIRECT',
                                          style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            )
                          : Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(isMatchActive ? Icons.sports_soccer_rounded : Icons.live_tv_rounded,
                                      color: Colors.white24, size: 48),
                                  const SizedBox(height: 8),
                                  Text(
                                    isMatchActive
                                        ? '${_activeMatch!.home} vs ${_activeMatch!.away}'
                                        : 'Sélectionnez un flux pour regarder',
                                    style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ),
                    ),
                  ),
                );
              },
            ),

            // ── INFOS FLUX EN COURS ──
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: AppTheme.surface,
              child: Row(
                children: [
                  if (_activeChannel != null && _activeChannel!.logo.isNotEmpty)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: CachedNetworkImage(
                        imageUrl: _activeChannel!.logo,
                        width: 32,
                        height: 32,
                        fit: BoxFit.contain,
                        errorWidget: (context, url, error) => const Icon(Icons.tv, color: Colors.white70, size: 24),
                      ),
                    )
                  else if (_activeMatch != null)
                    _buildTeamLogo(_activeMatch!.homeLogo, _activeMatch!.home, size: 30)
                  else
                    const Icon(Icons.live_tv_rounded, color: AppTheme.primary, size: 24),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _currentTitle,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (_currentSubtitle != null)
                          Text(
                            _currentSubtitle!,
                            style: const TextStyle(color: AppTheme.primary, fontSize: 11, fontWeight: FontWeight.w600),
                          ),
                      ],
                    ),
                  ),
                  if (_activeMatch != null) ...[
                    const SizedBox(width: 6),
                    _buildTeamLogo(_activeMatch!.awayLogo, _activeMatch!.away, size: 30),
                  ],
                  const SizedBox(width: 6),
                  IconButton(
                    icon: const Icon(Icons.refresh_rounded, color: Colors.white70),
                    onPressed: _loadData,
                    tooltip: 'Recharger',
                  ),
                ],
              ),
            ),

            // ── ONGLETS : CHAÎNES TV & MATCHS DE FOOT ──
            Container(
              height: 48,
              decoration: const BoxDecoration(
                color: Color(0xFF101014),
                border: Border(bottom: BorderSide(color: Colors.white10)),
              ),
              child: TabBar(
                controller: _tabController,
                indicatorColor: AppTheme.primary,
                indicatorWeight: 3,
                labelColor: Colors.white,
                unselectedLabelColor: Colors.white54,
                labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                tabs: [
                  const Tab(
                    icon: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.tv_rounded, size: 16),
                        SizedBox(width: 6),
                        Text('Chaînes TV'),
                      ],
                    ),
                  ),
                  Tab(
                    icon: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.sports_soccer_rounded, size: 16),
                        const SizedBox(width: 6),
                        const Text('Matchs de Foot'),
                        if (liveMatchesCount > 0) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                            decoration: BoxDecoration(
                              color: Colors.redAccent,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '$liveMatchesCount',
                              style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // ── VUES DES ONGLETS ──
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  // ONGLET 1 : GRILLE DES CHAÎNES TV
                  _buildChannelsTab(),

                  // ONGLET 2 : MATCHS DE FOOT COMPLET & LIGUE DES CHAMPIONS
                  _buildMatchesTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChannelsTab() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: AppTheme.primary));
    }

    return Column(
      children: [
        Container(
          height: 44,
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: _channelCategories.length,
            itemBuilder: (context, index) {
              final cat = _channelCategories[index];
              final isSelected = cat['id'] == _selectedChannelCategory;

              return GestureDetector(
                onTap: () => setState(() => _selectedChannelCategory = cat['id']!),
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  decoration: BoxDecoration(
                    color: isSelected ? AppTheme.primary : AppTheme.card,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isSelected ? AppTheme.primary : Colors.white12,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        cat['icon'] as IconData,
                        size: 14,
                        color: isSelected ? Colors.white : Colors.white70,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        cat['label'] as String,
                        style: TextStyle(
                          color: isSelected ? Colors.white : Colors.white70,
                          fontSize: 12,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),

        Expanded(
          child: _filteredChannels.isEmpty
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32.0),
                    child: Text(
                      'Aucune chaîne trouvée dans cette catégorie.',
                      style: TextStyle(color: Colors.white54, fontSize: 13),
                    ),
                  ),
                )
              : GridView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: _filteredChannels.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 2.2,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                  ),
                  itemBuilder: (context, index) {
                    final channel = _filteredChannels[index];
                    final isActive = _activeChannel?.id == channel.id;
                    final catLabel = channel.categories.isNotEmpty ? channel.categories.first : 'Direct';

                    return GestureDetector(
                      onTap: () => _selectChannel(channel),
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: isActive ? AppTheme.primary.withValues(alpha: 0.18) : AppTheme.card,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isActive ? AppTheme.primary : Colors.white.withValues(alpha: 0.08),
                            width: isActive ? 1.5 : 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: channel.logo.isNotEmpty
                                  ? CachedNetworkImage(
                                      imageUrl: channel.logo,
                                      width: 38,
                                      height: 38,
                                      fit: BoxFit.contain,
                                      errorWidget: (context, url, error) => Container(
                                        width: 38,
                                        height: 38,
                                        color: Colors.white10,
                                        child: const Icon(Icons.tv, color: Colors.white30, size: 20),
                                      ),
                                    )
                                  : Container(
                                      width: 38,
                                      height: 38,
                                      color: Colors.white10,
                                      child: const Icon(Icons.tv, color: Colors.white30, size: 20),
                                    ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    channel.name,
                                    style: TextStyle(
                                      color: isActive ? AppTheme.primary : Colors.white,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    catLabel,
                                    style: const TextStyle(color: AppTheme.textSecondary, fontSize: 10),
                                    maxLines: 1,
                                  ),
                                ],
                              ),
                            ),
                            if (isActive)
                              const Icon(Icons.equalizer_rounded, color: AppTheme.primary, size: 18),
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

  Widget _buildMatchesTab() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: AppTheme.primary));
    }

    final filtered = _filteredMatches;

    return Column(
      children: [
        // Filtres Matchs (Ligue des Champions, En Direct, etc.)
        Container(
          height: 44,
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: _matchFilters.length,
            itemBuilder: (context, index) {
              final filter = _matchFilters[index];
              final isSelected = filter['id'] == _selectedMatchFilter;
              final isUefa = filter['id'] == 'uefa';

              return GestureDetector(
                onTap: () => setState(() => _selectedMatchFilter = filter['id']!),
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? (isUefa ? Colors.amber : AppTheme.primary)
                        : AppTheme.card,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isSelected
                          ? (isUefa ? Colors.amber : AppTheme.primary)
                          : (isUefa ? Colors.amber.withValues(alpha: 0.4) : Colors.white12),
                    ),
                    boxShadow: isSelected
                        ? [
                            BoxShadow(
                              color: (isUefa ? Colors.amber : AppTheme.primary).withValues(alpha: 0.4),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ]
                        : null,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        filter['icon'] as IconData,
                        size: 14,
                        color: isSelected
                            ? (isUefa ? Colors.black : Colors.white)
                            : (isUefa ? Colors.amber : (filter['id'] == 'live' ? Colors.redAccent : Colors.white70)),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        filter['label'] as String,
                        style: TextStyle(
                          color: isSelected
                              ? (isUefa ? Colors.black : Colors.white)
                              : (isUefa ? Colors.amber : Colors.white70),
                          fontSize: 12,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),

        // Liste des matchs
        Expanded(
          child: filtered.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.sports_soccer_rounded, size: 56, color: AppTheme.textSecondary),
                        const SizedBox(height: 12),
                        const Text(
                          'Aucun match trouvé',
                          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Les flux vidéo des matchs apparaîtront dès le début des diffusions.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primary,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                          ),
                          onPressed: _loadData,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Actualiser'),
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  color: AppTheme.primary,
                  onRefresh: _loadData,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final m = filtered[index];
                      final isLive = m.status == 'live';
                      final isActive = _activeMatch?.id == m.id;
                      final isUefa = m.league != null &&
                          (m.league!.toLowerCase().contains('champion') || m.league!.toLowerCase().contains('uefa'));

                      return GestureDetector(
                        onTap: () => selectMatch(m),
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: isActive ? AppTheme.primary.withValues(alpha: 0.16) : AppTheme.card,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: isActive
                                  ? AppTheme.primary
                                  : (isLive ? AppTheme.primary.withValues(alpha: 0.4) : Colors.white10),
                              width: isActive ? 1.5 : 1,
                            ),
                          ),
                          child: Column(
                            children: [
                              // Header Ligue + Statut
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      if (isUefa) ...[
                                        const Icon(Icons.emoji_events_rounded, color: Colors.amber, size: 15),
                                        const SizedBox(width: 4),
                                      ],
                                      Text(
                                        m.league ?? 'Football',
                                        style: TextStyle(
                                          color: isUefa ? Colors.amber : AppTheme.primary,
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: isLive ? Colors.redAccent : Colors.white10,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      isLive ? 'DIRECT' : (m.minute ?? 'Bientôt'),
                                      style: TextStyle(
                                        color: isLive ? Colors.white : Colors.white70,
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),

                              const SizedBox(height: 12),

                              // Rangée des équipes avec LOGOS
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  // Home team
                                  Expanded(
                                    flex: 4,
                                    child: Row(
                                      children: [
                                        _buildTeamLogo(m.homeLogo, m.home, size: 38),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Text(
                                            m.home,
                                            style: TextStyle(
                                              color: isActive ? AppTheme.primary : Colors.white,
                                              fontWeight: FontWeight.bold,
                                              fontSize: 13,
                                            ),
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),

                                  // Score ou VS
                                  Expanded(
                                    flex: 2,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: Colors.black.withValues(alpha: 0.4),
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(color: Colors.white12),
                                      ),
                                      alignment: Alignment.center,
                                      child: Text(
                                        (m.score != null && m.score!.isNotEmpty) ? m.score! : 'VS',
                                        style: TextStyle(
                                          color: isLive ? Colors.amber : Colors.white70,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w900,
                                        ),
                                      ),
                                    ),
                                  ),

                                  // Away team
                                  Expanded(
                                    flex: 4,
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.end,
                                      children: [
                                        Expanded(
                                          child: Text(
                                            m.away,
                                            textAlign: TextAlign.right,
                                            style: TextStyle(
                                              color: isActive ? AppTheme.primary : Colors.white,
                                              fontWeight: FontWeight.bold,
                                              fontSize: 13,
                                            ),
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        _buildTeamLogo(m.awayLogo, m.away, size: 38),
                                      ],
                                    ),
                                  ),
                                ],
                              ),

                              const SizedBox(height: 10),

                              // Action Lancer le match
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    isActive ? Icons.volume_up_rounded : Icons.play_circle_fill_rounded,
                                    color: isActive ? AppTheme.primary : Colors.white70,
                                    size: 16,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    isActive ? 'Diffusion en cours sur le lecteur' : 'Regarder le match',
                                    style: TextStyle(
                                      color: isActive ? AppTheme.primary : Colors.white70,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
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
        ),
      ],
    );
  }

  Widget _buildTeamLogo(String? logoUrl, String teamName, {double size = 32}) {
    if (logoUrl != null && logoUrl.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(size / 2),
        child: CachedNetworkImage(
          imageUrl: logoUrl,
          width: size,
          height: size,
          fit: BoxFit.contain,
          placeholder: (context, url) => Container(
            width: size,
            height: size,
            decoration: const BoxDecoration(
              color: Colors.white10,
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.shield_outlined, color: Colors.white24, size: size * 0.5),
          ),
          errorWidget: (context, url, error) => Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                teamName.isNotEmpty ? teamName[0].toUpperCase() : '?',
                style: TextStyle(color: Colors.white70, fontSize: size * 0.4, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ),
      );
    }
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          teamName.isNotEmpty ? teamName[0].toUpperCase() : '?',
          style: TextStyle(color: Colors.white70, fontSize: size * 0.4, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }
}
