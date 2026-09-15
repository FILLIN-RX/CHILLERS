import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../config/theme.dart';
import '../../services/native_bridge.dart';
import '../main_navigation.dart';
import '../onboarding/onboarding_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  late AnimationController _introController;
  late AnimationController _flareController;
  late AnimationController _ribbonController;

  late Animation<double> _logoScale;
  late Animation<double> _logoOpacity;
  late Animation<double> _ribbonExpansion;
  late Animation<double> _flareOpacity;
  late Animation<double> _textLetterSpacing;

  @override
  void initState() {
    super.initState();

    // 1. Controller Intro : Échelle et apparition
    _introController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );

    // 2. Controller Ribbon & Flare (Style Netflix "Ta-Dum" & faisceau)
    _flareController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );

    _ribbonController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );

    _logoScale = Tween<double>(begin: 0.65, end: 1.15).animate(
      CurvedAnimation(parent: _introController, curve: Curves.easeOutCubic),
    );

    _logoOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _introController, curve: const Interval(0.0, 0.4, curve: Curves.easeIn)),
    );

    _textLetterSpacing = Tween<double>(begin: 1.0, end: 6.0).animate(
      CurvedAnimation(parent: _introController, curve: Curves.easeOutCubic),
    );

    _flareOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _flareController, curve: Curves.easeInOut),
    );

    _ribbonExpansion = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _ribbonController, curve: Curves.easeInOutQuart),
    );

    _playCinematicSequence();
  }

  Future<void> _playCinematicSequence() async {
    // Phase 1 : Impact d'ouverture Netflix-style
    await Future.delayed(const Duration(milliseconds: 150));
    if (!mounted) return;
    NativeBridge.instance.mediumHaptic();
    _introController.forward();

    // Phase 2 : Faisceau lumineux & flash
    await Future.delayed(const Duration(milliseconds: 400));
    if (!mounted) return;
    NativeBridge.instance.lightHaptic();
    _flareController.forward();
    _ribbonController.forward();

    // Phase 3 : Transition vers la suite
    await Future.delayed(const Duration(milliseconds: 2000));
    if (!mounted) return;

    final prefs = await SharedPreferences.getInstance();
    final bool hasSeenOnboarding = prefs.getBool('has_seen_onboarding_v1') ?? false;

    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 650),
        pageBuilder: (context, animation, secondaryAnimation) => hasSeenOnboarding
            ? MainNavigation(key: MainNavigation.navKey)
            : const OnboardingScreen(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    );
  }

  @override
  void dispose() {
    _introController.dispose();
    _flareController.dispose();
    _ribbonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF040406),
      body: Stack(
        fit: StackFit.expand,
        alignment: Alignment.center,
        children: [
          // 1. Dégradé de fond radial sombre façon cinéma
          Container(
            decoration: const BoxDecoration(
              gradient: RadialGradient(
                center: Alignment.center,
                radius: 1.2,
                colors: [
                  Color(0xFF1B0715),
                  Color(0xFF0A030A),
                  Color(0xFF040406),
                ],
                stops: [0.0, 0.45, 1.0],
              ),
            ),
          ),

          // 2. Faisceaux de lumière verticaux Netflix / Prisme
          AnimatedBuilder(
            animation: _ribbonController,
            builder: (context, child) {
              return Opacity(
                opacity: (1.0 - _ribbonExpansion.value).clamp(0.0, 1.0) * _flareOpacity.value,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(7, (index) {
                    final heightFactor = [0.4, 0.7, 1.0, 0.85, 0.95, 0.6, 0.35][index];
                    final colors = [
                      AppTheme.primary,
                      const Color(0xFFE11D48),
                      const Color(0xFF9333EA),
                      AppTheme.primary,
                      const Color(0xFFF43F5E),
                      const Color(0xFFC026D3),
                      AppTheme.primary,
                    ][index];

                    return Container(
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      width: 6,
                      height: 380 * heightFactor * _ribbonExpansion.value,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            colors.withValues(alpha: 0.9),
                            colors,
                            Colors.transparent,
                          ],
                          stops: const [0.0, 0.3, 0.7, 1.0],
                        ),
                        borderRadius: BorderRadius.circular(3),
                        boxShadow: [
                          BoxShadow(
                            color: colors.withValues(alpha: 0.6),
                            blurRadius: 20,
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                    );
                  }),
                ),
              );
            },
          ),

          // 3. Logo central & Mot-Symbole CHILLERS animé
          AnimatedBuilder(
            animation: _introController,
            builder: (context, child) {
              return Opacity(
                opacity: _logoOpacity.value,
                child: Transform.scale(
                  scale: _logoScale.value,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Emblème cinématographique rouge vibrant
                      Container(
                        width: 90,
                        height: 90,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [AppTheme.primary, Color(0xFF9333EA)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.primary.withValues(alpha: 0.6),
                              blurRadius: 40,
                              spreadRadius: 6,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.play_arrow_rounded,
                          size: 58,
                          color: Colors.white,
                        ),
                      ),

                      const SizedBox(height: 28),

                      // Mot-symbole "CHILLERS"
                      ShaderMask(
                        shaderCallback: (bounds) => const LinearGradient(
                          colors: [
                            Colors.white,
                            Colors.white,
                            Color(0xFFFDA4AF),
                            AppTheme.primary,
                          ],
                          stops: [0.0, 0.5, 0.85, 1.0],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        ).createShader(bounds),
                        child: Text(
                          'CHILLERS',
                          style: TextStyle(
                            fontSize: 36,
                            fontWeight: FontWeight.w900,
                            letterSpacing: _textLetterSpacing.value,
                            color: Colors.white,
                            shadows: [
                              Shadow(
                                color: AppTheme.primary.withValues(alpha: 0.8),
                                blurRadius: 30,
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 10),

                      // Signature
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.06),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.white12),
                        ),
                        child: const Text(
                          'ORIGINALS & LIVE',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 3.0,
                            color: Colors.white70,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
