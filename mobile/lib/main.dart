import 'package:flutter/material.dart';
import 'config/theme.dart';
import 'screens/main_navigation.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
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
      home: const MainNavigation(),
    );
  }
}
