import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../config/theme.dart';
import '../../services/native_bridge.dart';
import '../main_navigation.dart';

class OnboardingSlide {
  final String title;
  final String subtitle;
  final String badge;
  final IconData icon;
  final Color accentColor;

  const OnboardingSlide({
    required this.title,
    required this.subtitle,
    required this.badge,
    required this.icon,
    required this.accentColor,
  });
}

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> with SingleTickerProviderStateMixin {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  late AnimationController _scrollController;

  // 12 Posters locaux téléchargés dans les assets
  final List<List<String>> _posterColumns = [
    // Colonne 1
    [
      'assets/posters/poster_1.jpg',
      'assets/posters/poster_2.jpg',
      'assets/posters/poster_3.jpg',
      'assets/posters/poster_4.jpg',
    ],
    // Colonne 2
    [
      'assets/posters/poster_5.jpg',
      'assets/posters/poster_6.jpg',
      'assets/posters/poster_7.jpg',
      'assets/posters/poster_8.jpg',
    ],
    // Colonne 3
    [
      'assets/posters/poster_9.jpg',
      'assets/posters/poster_10.jpg',
      'assets/posters/poster_11.jpg',
      'assets/posters/poster_12.jpg',
    ],
    // Colonne 4
    [
      'assets/posters/poster_2.jpg',
      'assets/posters/poster_7.jpg',
      'assets/posters/poster_1.jpg',
      'assets/posters/poster_11.jpg',
    ],
  ];

  final List<OnboardingSlide> _slides = const [
    OnboardingSlide(
      title: 'Films, Séries &\nAnimés en Illimité',
      subtitle:
          'Plongez dans des milliers d\'heures de cinéma et de séries en qualité 4K Ultra HD, sans interruption publicitaire.',
      badge: 'STREAMING 4K ULTRA',
      icon: Icons.movie_filter_rounded,
      accentColor: AppTheme.primary,
    ),
    OnboardingSlide(
      title: 'Matchs en Direct &\nAlertes Coup d\'Envoi',
      subtitle:
          'Ne manquez aucune grande affiche : suivez le direct et recevez un rappel 15 minutes avant le coup d\'envoi.',
      badge: 'DIRECT SPORT HD',
      icon: Icons.sports_soccer_rounded,
      accentColor: Color(0xFF10B981),
    ),
    OnboardingSlide(
      title: 'Téléchargement &\nMode Hors-Ligne',
      subtitle:
          'Emportez vos films et épisodes dans le train, l\'avion ou à l\'étranger avec notre moteur de téléchargement physique.',
      badge: '100% HORS-LIGNE',
      icon: Icons.download_for_offline_rounded,
      accentColor: Color(0xFFF59E0B),
    ),
    OnboardingSlide(
      title: 'Expérience Mobile\nHaute Performance',
      subtitle:
          'Picture-in-Picture flottant, contrôles tactiles au doigt (luminosité, volume, saut ±10s) et mode cadenas anti-fausses touches.',
      badge: 'FONCTIONNALITÉS EXCLUSIVES',
      icon: Icons.phone_android_rounded,
      accentColor: Color(0xFF8B5CF6),
    ),
  ];

  @override
  void initState() {
    super.initState();
    // Animation continue de défilement pour la grille de posters
    _scrollController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 40),
    )..repeat();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _finishOnboarding() async {
    NativeBridge.instance.mediumHaptic();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('has_seen_onboarding_v1', true);

    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 500),
        pageBuilder: (context, animation, secondaryAnimation) => MainNavigation(key: MainNavigation.navKey),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    );
  }

  void _nextPage() {
    NativeBridge.instance.selectionHaptic();
    if (_currentPage < _slides.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 380),
        curve: Curves.easeInOut,
      );
    } else {
      _finishOnboarding();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _currentPage == _slides.length - 1;
    final currentSlide = _slides[_currentPage];

    return Scaffold(
      backgroundColor: const Color(0xFF060608),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // ── 1. GRILLE D'AFFICHES DE FILMS EN DIAGONALE (STYLE WEB 404) ──
          Positioned.fill(
            child: _buildDiagonalPosterWall(),
          ),

          // ── 2. DÉGRADÉ VIGNETTE SOMBRE & RADIAL CINÉMATOGRAPHIQUE ──
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.75),
                    Colors.black.withValues(alpha: 0.35),
                    const Color(0xFF060608).withValues(alpha: 0.85),
                    const Color(0xFF060608),
                  ],
                  stops: const [0.0, 0.3, 0.65, 0.9],
                ),
              ),
            ),
          ),

          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.center,
                  radius: 0.9,
                  colors: [
                    Colors.transparent,
                    const Color(0xFF060608).withValues(alpha: 0.7),
                    const Color(0xFF060608),
                  ],
                  stops: const [0.2, 0.7, 1.0],
                ),
              ),
            ),
          ),

          // ── 3. CONTENU INTERACTIF ONBOARDING ──
          SafeArea(
            child: Column(
              children: [
                // En-tête : Logo & Bouton Passer
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [AppTheme.primary, Color(0xFF9333EA)],
                              ),
                              borderRadius: BorderRadius.circular(10),
                              boxShadow: [
                                BoxShadow(
                                  color: AppTheme.primary.withValues(alpha: 0.4),
                                  blurRadius: 10,
                                ),
                              ],
                            ),
                            child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 20),
                          ),
                          const SizedBox(width: 10),
                          const Text(
                            'CHILLERS',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 2.5,
                              fontSize: 16,
                            ),
                          ),
                        ],
                      ),
                      if (!isLast)
                        TextButton(
                          onPressed: _finishOnboarding,
                          style: TextButton.styleFrom(
                            backgroundColor: Colors.black.withValues(alpha: 0.3),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                              side: BorderSide(color: Colors.white.withValues(alpha: 0.15)),
                            ),
                          ),
                          child: const Text(
                            'Passer',
                            style: TextStyle(
                              color: Colors.white70,
                              fontWeight: FontWeight.w600,
                              fontSize: 12,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),

                const Spacer(),

                // PageView des slides avec textes et badges
                SizedBox(
                  height: 250,
                  child: PageView.builder(
                    controller: _pageController,
                    itemCount: _slides.length,
                    onPageChanged: (idx) {
                      setState(() => _currentPage = idx);
                      NativeBridge.instance.selectionHaptic();
                    },
                    itemBuilder: (context, index) {
                      final slide = _slides[index];
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            // Badge
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              decoration: BoxDecoration(
                                color: slide.accentColor.withValues(alpha: 0.18),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: slide.accentColor.withValues(alpha: 0.4),
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(slide.icon, color: slide.accentColor, size: 14),
                                  const SizedBox(width: 6),
                                  Text(
                                    slide.badge,
                                    style: TextStyle(
                                      color: slide.accentColor,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 1.2,
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            const SizedBox(height: 14),

                            // Titre
                            Text(
                              slide.title,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 26,
                                fontWeight: FontWeight.w900,
                                height: 1.2,
                                shadows: [
                                  Shadow(
                                    color: Colors.black,
                                    blurRadius: 16,
                                  ),
                                ],
                              ),
                            ),

                            const SizedBox(height: 12),

                            // Description
                            Text(
                              slide.subtitle,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Color(0xFFD1D5DB),
                                fontSize: 13,
                                height: 1.45,
                                shadows: [
                                  Shadow(
                                    color: Colors.black,
                                    blurRadius: 10,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),

                const Spacer(),

                // Indicateurs de page + Bouton CTA
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                  child: Column(
                    children: [
                      // Indicateurs dots
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(_slides.length, (i) {
                          final active = i == _currentPage;
                          return AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            margin: const EdgeInsets.symmetric(horizontal: 4),
                            width: active ? 24 : 8,
                            height: 6,
                            decoration: BoxDecoration(
                              color: active ? currentSlide.accentColor : Colors.white24,
                              borderRadius: BorderRadius.circular(3),
                              boxShadow: active
                                  ? [
                                      BoxShadow(
                                        color: currentSlide.accentColor.withValues(alpha: 0.6),
                                        blurRadius: 8,
                                      ),
                                    ]
                                  : null,
                            ),
                          );
                        }),
                      ),

                      const SizedBox(height: 22),

                      // Bouton d'action principal
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: isLast ? AppTheme.primary : const Color(0xFF1E1E24),
                            foregroundColor: Colors.white,
                            elevation: isLast ? 8 : 0,
                            shadowColor: isLast ? AppTheme.primary.withValues(alpha: 0.5) : null,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                              side: BorderSide(
                                color: isLast
                                    ? Colors.transparent
                                    : Colors.white.withValues(alpha: 0.12),
                              ),
                            ),
                          ),
                          onPressed: _nextPage,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                isLast ? 'Commencer l\'expérience' : 'Suivant',
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 0.5,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Icon(
                                isLast ? Icons.rocket_launch_rounded : Icons.arrow_forward_rounded,
                                size: 18,
                              ),
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
        ],
      ),
    );
  }

  // ── Mur d'affiches incliné en diagonale ──
  Widget _buildDiagonalPosterWall() {
    return Transform.rotate(
      angle: -11 * (math.pi / 180), // Incliné à ~ -11 degrés comme le 404
      child: Transform.scale(
        scale: 1.35, // Agrandissement pour couvrir tout l'écran sans bords vides
        child: AnimatedBuilder(
          animation: _scrollController,
          builder: (context, child) {
            final progress = _scrollController.value;

            return Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(_posterColumns.length, (colIdx) {
                final column = _posterColumns[colIdx];
                final isDown = colIdx % 2 == 1;
                final offset = isDown ? (1.0 - progress) * 140 : progress * 140;

                return Expanded(
                  child: Transform.translate(
                    offset: Offset(0, -offset),
                    child: Column(
                      children: [
                        ...column.map((posterPath) => _buildPosterCard(posterPath)),
                        ...column.map((posterPath) => _buildPosterCard(posterPath)),
                      ],
                    ),
                  ),
                );
              }),
            );
          },
        ),
      ),
    );
  }

  Widget _buildPosterCard(String assetPath) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 5, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.6),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: AspectRatio(
          aspectRatio: 2 / 3,
          child: Image.asset(
            assetPath,
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) => Container(
              color: Colors.grey.shade900,
              child: const Icon(Icons.movie, color: Colors.white24),
            ),
          ),
        ),
      ),
    );
  }
}
