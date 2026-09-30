import 'package:device_preview/device_preview.dart';
import 'package:device_preview/presets.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:media_kit/media_kit.dart';
import 'config/theme.dart';
import 'screens/splash/splash_screen.dart';

bool hasMediaKitSupport = false;

/// Preset to start under, e.g. `flutter run --dart-define=deviceId=google-pixel-10`.
/// Empty (the default) starts on [kDefaultDeviceId]; pass `none` to start on
/// the real window instead of a device frame.
const String kInitialDeviceId = String.fromEnvironment('deviceId');
const String kDefaultDeviceId = 'apple-iphone-16';

void main() {
  // Must run before any binding is touched: it installs the binding that
  // DevicePreview needs, replacing WidgetsFlutterBinding.ensureInitialized().
  if (kDebugMode) {
    final String deviceId = kInitialDeviceId.isEmpty
        ? kDefaultDeviceId
        : kInitialDeviceId;
    if (deviceId != 'none') {
      final DevicePreset? preset = DevicePresets.byId(deviceId);
      DevicePreviewBindingMixin.latchConfiguration(
        initialSimulation: preset?.resolve(),
      );
    }
    DevicePreview.enable(enabled: true, padding: const EdgeInsets.all(16));
  } else {
    WidgetsFlutterBinding.ensureInitialized();
  }

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
      home: const SplashScreen(),
    );
  }
}
