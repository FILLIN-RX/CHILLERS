import 'dart:async';
import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/download_service.dart';
import '../widgets/download_success_overlay.dart';
import 'home/home_screen.dart';
import 'media/media_screen.dart';
import 'live/live_screen.dart';
import 'download/download_screen.dart';
import 'profile/profile_screen.dart';
import 'search/optimized_search_screen.dart';

class MainNavigation extends StatefulWidget {
  static final GlobalKey<MainNavigationState> navKey = GlobalKey<MainNavigationState>();

  static void switchTab(BuildContext context, int index, {int? subTab}) {
    navKey.currentState?.switchTo(index, subTab: subTab);
  }

  const MainNavigation({super.key});

  @override
  State<MainNavigation> createState() => MainNavigationState();
}

class MainNavigationState extends State<MainNavigation> {
  int _currentIndex = 0;
  bool _isSidebarExpanded = true;
  final TextEditingController _searchController = TextEditingController();
  StreamSubscription<DownloadTask>? _downloadSub;

  @override
  void initState() {
    super.initState();
    _downloadSub = DownloadService().onDownloadCompleted.listen(_onDownloadCompleted);
  }

  /// Called whenever a [DownloadTask] reaches 'completed' status.
  /// Shows an animated overlay that slides in from the top.
  void _onDownloadCompleted(DownloadTask task) {
    final overlay = Overlay.of(context, rootOverlay: true);
    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (ctx) => SafeArea(
        child: Align(
          alignment: Alignment.topCenter,
          child: DownloadSuccessOverlay(
            task: task,
            onTap: () {
              // Navigate to the Downloads tab (index 3)
              switchTo(3);
            },
            onDismiss: () {
              entry.remove();
            },
          ),
        ),
      ),
    );
    overlay.insert(entry);
  }

  void switchTo(int index, {int? subTab}) {
    if (mounted) {
      setState(() {
        _currentIndex = index;
      });
      if (index == 2 && subTab != null) {
        LiveScreen.selectTab(subTab);
      }
    }
  }

  late final List<Widget> _screens = [
    const HomeScreen(),
    const MediaScreen(),
    LiveScreen(key: LiveScreen.liveKey),
    const DownloadScreen(),
    const ProfileScreen(),
  ];

  final List<Map<String, dynamic>> _navItems = [
    {'icon': Icons.home_filled, 'label': 'Accueil'},
    {'icon': Icons.explore_rounded, 'label': 'Explorer'},
    {'icon': Icons.live_tv_rounded, 'label': 'Live TV & Foot'},
    {'icon': Icons.download_rounded, 'label': 'Téléchargements'},
    {'icon': Icons.person_rounded, 'label': 'Profil'},
  ];

  @override
  void dispose() {
    _downloadSub?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _openSearch(BuildContext context, {String initialQuery = ''}) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const OptimizedSearchScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isDesktop = screenWidth >= 850;

    if (isDesktop) {
      return Scaffold(
        backgroundColor: const Color(0xFF09090B),
        body: Column(
          children: [
            // ── Desktop YouTube-Style Top Header Bar ─────────────────────
            Container(
              height: 64,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              decoration: const BoxDecoration(
                color: Color(0xFF0C0C0E),
                border: Border(bottom: BorderSide(color: Colors.white10, width: 0.8)),
              ),
              child: Row(
                children: [
                  // Left : Hamburger + Logo
                  IconButton(
                    icon: const Icon(Icons.menu_rounded, color: Colors.white),
                    onPressed: () {
                      setState(() => _isSidebarExpanded = !_isSidebarExpanded);
                    },
                    tooltip: 'Menu navigation',
                  ),
                  const SizedBox(width: 12),
                  InkWell(
                    onTap: () => switchTo(0),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [AppTheme.primary, Color(0xFF7C3AED)],
                            ),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            'CHILLERS',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.2,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const Spacer(),

                  // Center : YouTube-Style Search Bar
                  Container(
                    width: screenWidth > 1100 ? 520 : 360,
                    height: 42,
                    decoration: BoxDecoration(
                      color: const Color(0xFF18181B),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: Colors.white12),
                    ),
                    child: Row(
                      children: [
                        const SizedBox(width: 16),
                        Expanded(
                          child: TextField(
                            controller: _searchController,
                            style: const TextStyle(color: Colors.white, fontSize: 13),
                            decoration: const InputDecoration(
                              hintText: 'Rechercher un film, série, anime, chaîne en direct...',
                              hintStyle: TextStyle(color: Colors.white38, fontSize: 13),
                              border: InputBorder.none,
                              isDense: true,
                            ),
                            onSubmitted: (val) {
                              if (val.trim().isNotEmpty) {
                                _openSearch(context, initialQuery: val.trim());
                              }
                            },
                          ),
                        ),
                        InkWell(
                          onTap: () {
                            _openSearch(context, initialQuery: _searchController.text.trim());
                          },
                          borderRadius: const BorderRadius.horizontal(right: Radius.circular(24)),
                          child: Container(
                            width: 54,
                            height: 42,
                            decoration: const BoxDecoration(
                              color: Color(0xFF27272A),
                              borderRadius: BorderRadius.horizontal(right: Radius.circular(24)),
                              border: Border(left: BorderSide(color: Colors.white12)),
                            ),
                            child: const Icon(Icons.search_rounded, color: Colors.white70, size: 20),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const Spacer(),

                  // Right Action : Faire un Don & User Profile
                  ElevatedButton.icon(
                    onPressed: () {
                      _showDonationDialog(context);
                    },
                    icon: const Icon(Icons.favorite_rounded, color: Colors.white, size: 16),
                    label: const Text(
                      'Faire un don',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    ),
                  ),
                  const SizedBox(width: 14),
                  IconButton(
                    icon: const Icon(Icons.notifications_none_rounded, color: Colors.white70),
                    onPressed: () {},
                  ),
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: () => switchTo(4),
                    child: const CircleAvatar(
                      radius: 16,
                      backgroundColor: Color(0xFF27272A),
                      child: Icon(Icons.person_rounded, color: Colors.white, size: 18),
                    ),
                  ),
                ],
              ),
            ),

            // ── Desktop Body : Sidebar on the left + Screen Content ──────
            Expanded(
              child: Row(
                children: [
                  // Side Navigation Rail / Sidebar (Sur le côté)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    width: _isSidebarExpanded ? 220 : 72,
                    decoration: const BoxDecoration(
                      color: Color(0xFF0C0C0E),
                      border: Border(right: BorderSide(color: Colors.white10, width: 0.8)),
                    ),
                    child: ListView.builder(
                      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                      itemCount: _navItems.length,
                      itemBuilder: (context, index) {
                        final item = _navItems[index];
                        final isSelected = _currentIndex == index;

                        if (!_isSidebarExpanded) {
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            child: InkWell(
                              onTap: () => switchTo(index),
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                decoration: BoxDecoration(
                                  color: isSelected ? AppTheme.primary.withValues(alpha: 0.15) : Colors.transparent,
                                  borderRadius: BorderRadius.circular(12),
                                  border: isSelected
                                      ? Border.all(color: AppTheme.primary.withValues(alpha: 0.4))
                                      : null,
                                ),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      item['icon'] as IconData,
                                      color: isSelected ? AppTheme.primary : Colors.white60,
                                      size: 22,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      item['label'] as String,
                                      style: TextStyle(
                                        color: isSelected ? AppTheme.primary : Colors.white60,
                                        fontSize: 9,
                                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                      ),
                                      textAlign: TextAlign.center,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        }

                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 3),
                          child: InkWell(
                            onTap: () => switchTo(index),
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: isSelected ? AppTheme.primary.withValues(alpha: 0.18) : Colors.transparent,
                                borderRadius: BorderRadius.circular(12),
                                border: isSelected
                                    ? Border.all(color: AppTheme.primary.withValues(alpha: 0.4))
                                    : null,
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    item['icon'] as IconData,
                                    color: isSelected ? AppTheme.primary : Colors.white70,
                                    size: 20,
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Text(
                                      item['label'] as String,
                                      style: TextStyle(
                                        color: isSelected ? Colors.white : Colors.white70,
                                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                  if (isSelected)
                                    Container(
                                      width: 4,
                                      height: 16,
                                      decoration: BoxDecoration(
                                        color: AppTheme.primary,
                                        borderRadius: BorderRadius.circular(2),
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

                  // Main Content Area
                  Expanded(
                    child: IndexedStack(
                      index: _currentIndex,
                      children: _screens,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    // ── Mobile Responsive Layout (< 850px) ─────────────────────────
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Color(0xFF0C0C0E),
          border: Border(top: BorderSide(color: Colors.white10, width: 0.8)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) => setState(() => _currentIndex = index),
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

  void _showDonationDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF18181B),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: const BorderSide(color: Color(0xFFD70466), width: 1.5),
        ),
        title: const Row(
          children: [
            Icon(Icons.favorite_rounded, color: Color(0xFFD70466)),
            SizedBox(width: 10),
            Text(
              'Soutenir CHILLERS',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Chillers est gratuit et sans pub intrusive. Votre don nous aide à financer les serveurs haute vitesse.',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF27272A),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.orange.withValues(alpha: 0.3)),
              ),
              child: const Row(
                children: [
                  Text('🍊 Orange Money :', style: TextStyle(color: Colors.orange, fontWeight: FontWeight.bold)),
                  SizedBox(width: 8),
                  Text('697 40 73 80', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF27272A),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.yellow.withValues(alpha: 0.3)),
              ),
              child: const Row(
                children: [
                  Text('🟡 MTN MoMo :', style: TextStyle(color: Colors.yellow, fontWeight: FontWeight.bold)),
                  SizedBox(width: 8),
                  Text('674 37 64 24', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Fermer', style: TextStyle(color: Colors.white70)),
          ),
        ],
      ),
    );
  }
}
