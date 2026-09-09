import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/live_channel.dart';
import '../../models/live_match.dart';
import '../../services/api_service.dart';
import '../../widgets/app_video_player.dart';

class LiveScreen extends StatefulWidget {
  const LiveScreen({super.key});

  @override
  State<LiveScreen> createState() => _LiveScreenState();
}

class _LiveScreenState extends State<LiveScreen> {
  final ApiService _apiService = ApiService();

  List<LiveChannel> _channels = [];
  List<LiveMatch> _matches = [];
  bool _isLoading = true;

  String _selectedCategory = 'all';
  LiveChannel? _activeChannel;
  String _currentStreamUrl = '';
  String _currentTitle = 'Live TV';
  String? _currentSubtitle;

  final List<Map<String, String>> _categories = const [
    {'id': 'all', 'label': 'Toutes'},
    {'id': 'sport', 'label': '⚽ Sports'},
    {'id': 'news', 'label': '📰 Infos'},
    {'id': 'general', 'label': '🌍 Général'},
    {'id': 'cinema', 'label': '🎬 Cinéma'},
    {'id': 'music', 'label': '🎶 Musique'},
  ];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);

    try {
      final channels = await _apiService.getLiveChannels();
      final matches = await _apiService.getLiveMatches();

      if (!mounted) return;

      setState(() {
        _channels = channels;
        _matches = matches;
        _isLoading = false;

        // Activer la première chaîne disponible par défaut
        if (channels.isNotEmpty && _activeChannel == null) {
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
      _activeChannel = channel;
      _currentStreamUrl = channel.streamUrl;
      _currentTitle = channel.name;
      _currentSubtitle = cat;
    });
  }

  Future<void> _selectMatch(LiveMatch match) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(
        child: CircularProgressIndicator(color: AppTheme.primary),
      ),
    );

    final streamUrl = await _apiService.getMatchStreamUrl(match.id);

    if (!mounted) return;
    Navigator.pop(context);

    if (streamUrl != null && streamUrl.isNotEmpty) {
      setState(() {
        _activeChannel = null;
        _currentStreamUrl = streamUrl;
        _currentTitle = '${match.home} vs ${match.away}';
        _currentSubtitle = '${match.league ?? 'Football'} • ${match.minute ?? 'Direct'}';
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Flux direct du match indisponible pour le moment')),
      );
    }
  }

  List<LiveChannel> get _filteredChannels {
    if (_selectedCategory == 'all') return _channels;
    return _channels.where((c) {
      final cats = c.categories.map((cat) => cat.toLowerCase()).toList();
      if (_selectedCategory == 'sport') return cats.any((cat) => cat.contains('sport') || cat.contains('football'));
      if (_selectedCategory == 'news') return cats.any((cat) => cat.contains('info') || cat.contains('news'));
      if (_selectedCategory == 'cinema') return cats.any((cat) => cat.contains('cine') || cat.contains('film') || cat.contains('movie'));
      if (_selectedCategory == 'music') return cats.any((cat) => cat.contains('music'));
      return cats.any((cat) => cat.contains(_selectedCategory));
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: Column(
          children: [
            // ── TOP PLAYER 16:9 (DIRECT CHANNELS & SPORTS) ──
            LayoutBuilder(
              builder: (context, constraints) {
                final screenH = MediaQuery.of(context).size.height;
                final maxH = screenH > 500 ? screenH * 0.38 : 220.0;

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
                                // Badge EN DIRECT rouge en haut à gauche
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
                                          'EN DIRECT',
                                          style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            )
                          : const Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.live_tv_rounded, color: Colors.white24, size: 48),
                                  SizedBox(height: 8),
                                  Text('Sélectionnez une chaîne', style: TextStyle(color: Colors.white70, fontSize: 13)),
                                ],
                              ),
                            ),
                    ),
                  ),
                );
              },
            ),

            // ── INFOS CHAÎNE EN COURS ──
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
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
                  else
                    const Icon(Icons.tv, color: AppTheme.primary, size: 24),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _currentTitle,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
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
                  IconButton(
                    icon: const Icon(Icons.refresh_rounded, color: Colors.white70),
                    onPressed: _loadData,
                    tooltip: 'Recharger les flux',
                  ),
                ],
              ),
            ),

            // ── CATÉGORIES HORIZONTALES ──
            Container(
              height: 44,
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: _categories.length,
                itemBuilder: (context, index) {
                  final cat = _categories[index];
                  final isSelected = cat['id'] == _selectedCategory;

                  return GestureDetector(
                    onTap: () => setState(() => _selectedCategory = cat['id']!),
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
                      child: Text(
                        cat['label']!,
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

            // ── CONTENU : MATCHS DU JOUR & GRILLE DES CHAÎNES ──
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // ⚽ SECTION MATCHS EN DIRECT
                          if (_matches.isNotEmpty) ...[
                            const Row(
                              children: [
                                Icon(Icons.sports_soccer_rounded, color: AppTheme.primary, size: 20),
                                SizedBox(width: 8),
                                Text(
                                  'Matchs & Événements Sportifs',
                                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            SizedBox(
                              height: 110,
                              child: ListView.builder(
                                scrollDirection: Axis.horizontal,
                                itemCount: _matches.length,
                                itemBuilder: (context, index) {
                                  final m = _matches[index];
                                  final isLive = m.status == 'live';

                                  return GestureDetector(
                                    onTap: () => _selectMatch(m),
                                    child: Container(
                                      width: 220,
                                      margin: const EdgeInsets.only(right: 10),
                                      padding: const EdgeInsets.all(10),
                                      decoration: BoxDecoration(
                                        color: AppTheme.card,
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(color: Colors.white12),
                                      ),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  m.league ?? 'Match',
                                                  style: const TextStyle(color: AppTheme.primary, fontSize: 11, fontWeight: FontWeight.bold),
                                                  maxLines: 1,
                                                ),
                                              ),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: isLive ? Colors.redAccent.withValues(alpha: 0.2) : Colors.white10,
                                                  borderRadius: BorderRadius.circular(4),
                                                ),
                                                child: Text(
                                                  isLive ? 'LIVE' : (m.minute ?? 'Direct'),
                                                  style: TextStyle(
                                                    color: isLive ? Colors.redAccent : Colors.white70,
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceAround,
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  m.home,
                                                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                                                  textAlign: TextAlign.center,
                                                  maxLines: 1,
                                                ),
                                              ),
                                              Text(
                                                (m.score != null && m.score!.isNotEmpty) ? m.score! : 'VS',
                                                style: const TextStyle(color: Colors.amber, fontSize: 13, fontWeight: FontWeight.bold),
                                              ),
                                              Expanded(
                                                child: Text(
                                                  m.away,
                                                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                                                  textAlign: TextAlign.center,
                                                  maxLines: 1,
                                                ),
                                              ),
                                            ],
                                          ),
                                          const Row(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: [
                                              Icon(Icons.play_circle_fill_rounded, color: AppTheme.primary, size: 14),
                                              SizedBox(width: 4),
                                              Text(
                                                'Regarder le match',
                                                style: TextStyle(color: AppTheme.primary, fontSize: 11, fontWeight: FontWeight.w600),
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
                            const SizedBox(height: 20),
                          ],

                          // 📺 GRILLE DES CHAÎNES TV
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Chaînes TV Disponibles',
                                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                              ),
                              Text(
                                '${_filteredChannels.length} chaînes',
                                style: const TextStyle(color: Colors.white54, fontSize: 12),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),

                          if (_filteredChannels.isEmpty)
                            const Center(
                              child: Padding(
                                padding: EdgeInsets.all(30.0),
                                child: Text(
                                  'Aucune chaîne trouvée dans cette catégorie.',
                                  style: TextStyle(color: Colors.white54, fontSize: 13),
                                ),
                              ),
                            )
                          else
                            GridView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
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
                        ],
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
