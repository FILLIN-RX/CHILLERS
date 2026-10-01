import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:media_kit/media_kit.dart';
import 'config/theme.dart';
import 'screens/splash/splash_screen.dart';

bool hasMediaKitSupport = false;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ── Orientation : portrait uniquement sur mobile ──────────────────
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // ── Style de la barre système (transparente, icônes claires) ──────
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF09090B),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  // ── MediaKit (player vidéo natif) ──────────────────────────────────
  try {
    MediaKit.ensureInitialized();
    hasMediaKitSupport = true;
  } catch (e) {
    debugPrint('[MediaKit] Mode fallback activé: $e');
    hasMediaKitSupport = false;
  }

  runApp(const ChillersApp());
}

class ChillersApp extends StatelessWidget {
  const ChillersApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CHILLERS',
      debugShowCheckedModeBanner: false,
      // ── Performance : désactive le banner debug + checkerboard ────
      checkerboardRasterCacheImages: false,
      checkerboardOffscreenLayers: false,
      theme: AppTheme.darkTheme(),
      home: const SplashScreen(),
    );
  }
}
