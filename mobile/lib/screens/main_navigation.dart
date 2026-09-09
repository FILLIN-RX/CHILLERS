import 'package:flutter/material.dart';
import '../config/theme.dart';
import 'home/home_screen.dart';
import 'media/media_screen.dart';
import 'live/live_screen.dart';
import 'download/download_screen.dart';
import 'profile/profile_screen.dart';

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

  @override
  Widget build(BuildContext context) {
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
}
