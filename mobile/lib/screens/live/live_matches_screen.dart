import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/live_match.dart';
import '../../services/api_service.dart';
import '../../widgets/app_video_player.dart';
import '../../widgets/app_drawer.dart';
import '../main_navigation.dart';

class LiveMatchesScreen extends StatefulWidget {
  final LiveMatch? initialMatch;

  const LiveMatchesScreen({super.key, this.initialMatch});

  @override
  State<LiveMatchesScreen> createState() => _LiveMatchesScreenState();
}

class _LiveMatchesScreenState extends State<LiveMatchesScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final ApiService _apiService = ApiService();

  List<LiveMatch> _matches = [];
  List<LiveMatch> _uefaMatches = [];
  bool _isLoading = true;

  String _selectedFilter = 'all'; // 'all', 'uefa', 'live', 'upcoming'
  LiveMatch? _activeMatch;
  String _currentStreamUrl = '';
  String _currentTitle = 'Matchs en Direct';
  String? _currentSubtitle;

  final List<Map<String, dynamic>> _filters = const [
    {'id': 'all', 'label': 'Tous les Matchs', 'icon': Icons.sports_soccer_rounded},
    {'id': 'uefa', 'label': 'Ligue des Champions', 'icon': Icons.emoji_events_rounded},
    {'id': 'live', 'label': 'En Direct', 'icon': Icons.circle_rounded},
    {'id': 'upcoming', 'label': 'À Venir', 'icon': Icons.schedule_rounded},
  ];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);

    try {
      final matchesFuture = _apiService.getLiveMatches();
      final uefaFuture = _apiService.getChampionsLeagueMatches();

      final results = await Future.wait([matchesFuture, uefaFuture]);
      final matches = results[0];
      final uefa = results[1];

      // Dédoublonnage
      final allMatchesMap = <String, LiveMatch>{};
      for (final m in [...matches, ...uefa]) {
        allMatchesMap[m.id] = m;
      }
      final allMatches = allMatchesMap.values.toList();

      if (!mounted) return;

      setState(() {
        _matches = allMatches;
        _uefaMatches = uefa.isNotEmpty
            ? uefa
            : allMatches.where((m) =>
                m.league != null &&
                (m.league!.toLowerCase().contains('champion') || m.league!.toLowerCase().contains('uefa'))).toList();
        _isLoading = false;

        // Si un match initial est passé ou s'il y a un match en direct
        if (widget.initialMatch != null && _activeMatch == null) {
          _selectMatch(widget.initialMatch!);
        } else if (_activeMatch == null) {
          final liveMatch = allMatches.where((m) => m.status == 'live').firstOrNull;
          if (liveMatch != null) {
            _selectMatch(liveMatch);
          } else if (allMatches.isNotEmpty) {
            _selectMatch(allMatches.first);
          }
        }
      });
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _selectMatch(LiveMatch match) async {
    setState(() {
      _activeMatch = match;
      _currentTitle = '${match.home} vs ${match.away}';
      _currentSubtitle = '${match.league ?? 'Football'} • ${match.minute ?? (match.status == 'live' ? 'En Direct' : 'Bientôt')}';
    });

    final streamUrl = await _apiService.getMatchStreamUrl(match.id);

    if (!mounted) return;

    if (streamUrl != null && streamUrl.isNotEmpty) {
      setState(() {
        _currentStreamUrl = streamUrl;
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Flux direct du match en attente d\'activation.')),
      );
    }
  }

  List<LiveMatch> get _filteredMatches {
    if (_selectedFilter == 'uefa') {
      return _uefaMatches.isNotEmpty ? _uefaMatches : _matches;
    }
    if (_selectedFilter == 'live') {
      return _matches.where((m) => m.status == 'live').toList();
    }
    if (_selectedFilter == 'upcoming') {
      return _matches.where((m) => m.status == 'upcoming').toList();
    }
    return _matches;
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredMatches;
    final liveCount = _matches.where((m) => m.status == 'live').length;
    final canPop = Navigator.canPop(context);

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
            // ── TOP APP HEADER (TOUJOURS VISIBLE) ──
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: const BoxDecoration(
                color: Color(0xFF0C0C0E),
                border: Border(bottom: BorderSide(color: Colors.white10)),
              ),
              child: Row(
                children: [
                  if (canPop)
                    IconButton(
                      icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
                      onPressed: () => Navigator.pop(context),
                    )
                  else
                    IconButton(
                      icon: const Icon(Icons.menu_rounded, color: Colors.white, size: 24),
                      onPressed: () => _scaffoldKey.currentState?.openDrawer(),
                    ),
                  const SizedBox(width: 6),
                  const Icon(Icons.sports_soccer_rounded, color: AppTheme.primary, size: 22),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'MATCHS EN DIRECT',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ),
                  if (liveCount > 0)
                    Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.redAccent,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.circle, color: Colors.white, size: 6),
                          const SizedBox(width: 4),
                          Text(
                            '$liveCount LIVE',
                            style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  IconButton(
                    icon: const Icon(Icons.refresh_rounded, color: Colors.white70),
                    onPressed: _loadData,
                    tooltip: 'Actualiser les scores',
                  ),
                ],
              ),
            ),

            // ── TOP PLAYER 16:9 DU MATCH SÉLECTIONNÉ ──
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
                                  isLive: true,
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
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.circle, color: Colors.white, size: 8),
                                        SizedBox(width: 4),
                                        Text(
                                          'DIRECT FOOT',
                                          style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900),
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
                                  const Icon(Icons.sports_soccer_rounded, color: Colors.white24, size: 48),
                                  const SizedBox(height: 8),
                                  Text(
                                    _activeMatch != null
                                        ? '${_activeMatch!.home} vs ${_activeMatch!.away}'
                                        : 'Sélectionnez un match pour regarder',
                                    style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(height: 4),
                                  const Text(
                                    'Diffusion HD sans coupure',
                                    style: TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                    ),
                  ),
                );
              },
            ),

            // ── INFOS DU MATCH ACTIF ──
            if (_activeMatch != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                color: AppTheme.surface,
                child: Row(
                  children: [
                    _buildTeamLogo(_activeMatch!.homeLogo, _activeMatch!.home, size: 30),
                    const SizedBox(width: 8),
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
                    const SizedBox(width: 8),
                    _buildTeamLogo(_activeMatch!.awayLogo, _activeMatch!.away, size: 30),
                  ],
                ),
              ),

            // ── FILTRES HORIZONTAUX (Ligue des Champions, Live, etc.) ──
            Container(
              height: 46,
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: _filters.length,
                itemBuilder: (context, index) {
                  final filter = _filters[index];
                  final isSelected = filter['id'] == _selectedFilter;
                  final isUefa = filter['id'] == 'uefa';

                  return GestureDetector(
                    onTap: () => setState(() => _selectedFilter = filter['id']!),
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

            // ── LISTE DES MATCHS ──
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
                  : filtered.isEmpty
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
                                  'Les prochains matchs et flux vidéo apparaîtront automatiquement dès leur mise en ligne.',
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
                                onTap: () => _selectMatch(m),
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
                                            isActive ? 'Match en cours de diffusion' : 'Regarder la diffusion',
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
        ),
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Color(0xFF0C0C0E),
          border: Border(top: BorderSide(color: Colors.white10, width: 0.8)),
        ),
        child: BottomNavigationBar(
          currentIndex: 2,
          onTap: (index) {
            if (Navigator.canPop(context)) {
              Navigator.pop(context);
            }
            MainNavigation.switchTab(context, index);
          },
          type: BottomNavigationBarType.fixed,
          backgroundColor: const Color(0xFF0C0C0E),
          selectedItemColor: AppTheme.primary,
          unselectedItemColor: Colors.white54,
          selectedFontSize: 11,
          unselectedFontSize: 11,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.home_filled),
              label: 'Accueil',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.explore_rounded),
              label: 'Explorer',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.live_tv_rounded),
              label: 'Live TV & Foot',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.download_rounded),
              label: 'Téléchargements',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_rounded),
              label: 'Profil',
            ),
          ],
        ),
      ),
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
