import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

class AppConstants {
  static const String appName = 'CHILLERS';

  /// URL du serveur backend en local (Port 4000)
  /// S'adapte automatiquement à Android (10.0.2.2:4000) ou Linux/Web (localhost:4000)
  static String get baseUrl {
    if (!kIsWeb && Platform.isAndroid) {
      return 'http://10.0.2.2:4000';
    }
    return 'http://localhost:4000';
  }

  static const String tokenKey = 'chillers_jwt_token';
  static const String userKey = 'chillers_user_data';

  static const String brandColorHex = '#D70466';
  static const String bgDarkHex = '#121214';
  static const String bgCardHex = '#18181B';
  static const String bgElevatedHex = '#202024';
}
