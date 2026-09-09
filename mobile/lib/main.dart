import 'package:flutter/material.dart';
import 'package:media_kit/media_kit.dart';
import 'config/theme.dart';
import 'screens/main_navigation.dart';

bool hasMediaKitSupport = false;

void main() {
  WidgetsFlutterBinding.ensureInitialized();
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
      theme: AppTheme.darkTheme(),
      home: MainNavigation(key: MainNavigation.navKey),
    );
  }
}
