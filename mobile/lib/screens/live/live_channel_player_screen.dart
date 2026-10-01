import 'dart:async';
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/theme.dart';
import '../../models/live_channel.dart';
import '../../services/api_service.dart';
import '../../widgets/app_video_player.dart';

class LiveChannelPlayerScreen extends StatefulWidget {
  final LiveChannel initialChannel;
  final List<LiveChannel>? allChannels;

  const LiveChannelPlayerScreen({
    super.key,
    required this.initialChannel,
    this.allChannels,
  });

  @override
  State<LiveChannelPlayerScreen> createState() => _LiveChannelPlayerScreenState();
}

class _LiveChannelPlayerScreenState extends State<LiveChannelPlayerScreen> {
  final ApiService _apiService = ApiService();
  late LiveChannel _currentChannel;
  List<LiveChannel> _channels = [];
  bool _isLoadingChannels = false;
  String _selectedCategory = 'all';
  final Set<String> _favoriteSlugs = {};

  static const List<Map<String, dynamic>> _categories = [
    {'id': 'all', 'label': 'Toutes', 'icon': Icons.tv_rounded},
    {'id': 'sports', 'label': 'Sport', 'icon': Icons.sports_soccer_rounded},
    {'id': 'cinema', 'label': 'Cinéma', 'icon': Icons.movie_rounded},
    {'id': 'series', 'label': 'Séries', 'icon': Icons.video_collection_rounded},
    {'id': 'kids', 'label': 'Jeunesse', 'icon': Icons.child_care_rounded},
    {'id': 'news', 'label': 'Infos', 'icon': Icons.newspaper_rounded},
    {'id': 'documentary', 'label': 'Découverte', 'icon': Icons.explore_rounded},
    {'id': 'music', 'label': 'Musique', 'icon': Icons.music_note_rounded},
  ];

  @override
  void initState() {
    super.initState();
    _currentChannel = widget.initialChannel;
    if (widget.allChannels != null && widget.allChannels!.isNotEmpty) {
      _channels = widget.allChannels!;
    } else {
      _loadChannels();
    }
  }

  Future<void> _loadChannels() async {
    setState(() => _isLoadingChannels = true);
    try {
      final channels = await _apiService.getLiveChannels();
      if (mounted) {
        setState(() {
          _channels = channels;
          _isLoadingChannels = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingChannels = false);
    }
  }

  void _switchChannel(LiveChannel channel) {
    if (_currentChannel.id == channel.id) return;
    setState(() {
      _currentChannel = channel;
    });
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

  List<LiveChannel> get _filteredChannels {
    if (_selectedCategory == 'all') return _channels;
    return _channels.where((c) {
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

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredChannels;
    final isFav = _favoriteSlugs.contains(_currentChannel.slug);

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            // ── TOP BAR DU LECTEUR DIRECT ──
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              color: const Color(0xFF0C0C0E),
              child: Row(
                children: [
                  IconButton(
                    icon: const FaIcon(FontAwesomeIcons.chevronLeft, color: Colors.white, size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                  const SizedBox(width: 4),
                  // Logo de la chaîne
                  if (_currentChannel.logo.isNotEmpty)
                    Container(
                      width: 32,
                      height: 32,
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: CachedNetworkImage(
                        imageUrl: _currentChannel.logo,
                        fit: BoxFit.contain,
                        errorWidget: (context, url, error) => const Icon(Icons.live_tv, color: Colors.white70, size: 16),
                      ),
                    ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _currentChannel.name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Row(
                          children: [
                            Container(
                              width: 7,
                              height: 7,
                              decoration: const BoxDecoration(
                                color: Colors.redAccent,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 5),
                            const Text(
                              'DIRECT HD',
                              style: TextStyle(
                                color: Colors.redAccent,
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.8,
                              ),
                            ),
                            if (_currentChannel.categories.isNotEmpty) ...[
                              const Text(' • ', style: TextStyle(color: Colors.white30, fontSize: 10)),
                              Flexible(
                                child: Text(
                                  _currentChannel.categories.first,
                                  style: const TextStyle(color: Colors.white60, fontSize: 11),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: Icon(
                      isFav ? Icons.star_rounded : Icons.star_outline_rounded,
                      color: isFav ? Colors.amber : Colors.white60,
                      size: 24,
                    ),
                    onPressed: () => _toggleFavorite(_currentChannel.slug),
                  ),
                ],
              ),
            ),

            // ── VIDEO PLAYER EN DIRECT (16:9) ──
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Container(
                color: Colors.black,
                child: AppVideoPlayer(
                  key: ValueKey(_currentChannel.streamUrl),
                  videoUrl: _currentChannel.streamUrl,
                  title: _currentChannel.name,
                  subtitle: _currentChannel.categories.isNotEmpty ? _currentChannel.categories.first : 'Direct TV',
                  isLive: true,
                  autoPlay: true,
                  isFullScreen: false,
                ),
              ),
            ),

            // ── CONTROLS & INFO BAR ──
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: const BoxDecoration(
                color: Color(0xFF141416),
                border: Border(bottom: BorderSide(color: Colors.white10)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.redAccent.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: Colors.redAccent.withValues(alpha: 0.5)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        FaIcon(FontAwesomeIcons.circleDot, color: Colors.redAccent, size: 10),
                        SizedBox(width: 6),
                        Text(
                          'EN DIRECT',
                          style: TextStyle(color: Colors.redAccent, fontSize: 11, fontWeight: FontWeight.w900),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _currentChannel.categories.join(' • '),
                      style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),

            // ── SECTION ZAPPING RAPIDE (AUTRES CHAÎNES) ──
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
              child: Row(
                children: [
                  const FaIcon(FontAwesomeIcons.tv, color: AppTheme.primary, size: 14),
                  const SizedBox(width: 8),
                  const Text(
                    'Zapping Rapide • Autres Chaînes',
                    style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w900),
                  ),
                  const Spacer(),
                  Text(
                    '${filtered.length} chaînes',
                    style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),

            // Category Chips
            SizedBox(
              height: 36,
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
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: isSelected ? AppTheme.primary : const Color(0xFF1E1E22),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: isSelected ? AppTheme.primary : Colors.white10),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(cat['icon'] as IconData, size: 12, color: isSelected ? Colors.white : Colors.white60),
                            const SizedBox(width: 4),
                            Text(
                              cat['label'] as String,
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

            const SizedBox(height: 8),

            // Channels List (Mosaïque / Liste Zapping)
            Expanded(
              child: _isLoadingChannels
                  ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
                  : filtered.isEmpty
                      ? const Center(
                          child: Text('Aucune chaîne disponible dans cette catégorie.', style: TextStyle(color: Colors.white54, fontSize: 12)),
                        )
                      : GridView.builder(
                          padding: const EdgeInsets.all(12),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 3,
                            childAspectRatio: 1.15,
                            crossAxisSpacing: 10,
                            mainAxisSpacing: 10,
                          ),
                          itemCount: filtered.length,
                          itemBuilder: (context, index) {
                            final ch = filtered[index];
                            final isActive = ch.id == _currentChannel.id;

                            return InkWell(
                              onTap: () => _switchChannel(ch),
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                decoration: BoxDecoration(
                                  color: isActive ? AppTheme.primary.withValues(alpha: 0.18) : const Color(0xFF1C1C1F),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isActive ? AppTheme.primary : Colors.white10,
                                    width: isActive ? 2 : 1,
                                  ),
                                ),
                                child: Stack(
                                  children: [
                                    Center(
                                      child: Padding(
                                        padding: const EdgeInsets.all(8.0),
                                        child: Column(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            if (ch.logo.isNotEmpty)
                                              CachedNetworkImage(
                                                imageUrl: ch.logo,
                                                height: 32,
                                                fit: BoxFit.contain,
                                                placeholder: (context, url) => const SizedBox(height: 32),
                                                errorWidget: (context, url, error) => const Icon(Icons.live_tv, color: Colors.white30, size: 24),
                                              )
                                            else
                                              const Icon(Icons.live_tv, color: Colors.white30, size: 24),
                                            const SizedBox(height: 4),
                                            Text(
                                              ch.name,
                                              style: TextStyle(
                                                color: isActive ? AppTheme.primary : Colors.white,
                                                fontSize: 10.5,
                                                fontWeight: FontWeight.bold,
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              textAlign: TextAlign.center,
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                    if (isActive)
                                      Positioned(
                                        top: 4,
                                        right: 4,
                                        child: Container(
                                          width: 8,
                                          height: 8,
                                          decoration: const BoxDecoration(
                                            color: Colors.redAccent,
                                            shape: BoxShape.circle,
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
        ),
      ),
    );
  }
}
