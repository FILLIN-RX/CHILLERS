class AppConstants {
  static const String appName = 'CHILLERS';

  /// Origine du backend, **sans** le suffixe `/api` : tous les appels de
  /// [ApiService] concaténent déjà `$_base/api/...`.
  ///
  /// Surchargeable au build :
  /// `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000`
  static const String _baseUrlOverride = String.fromEnvironment('API_BASE_URL');
  static const String baseUrl = _baseUrlOverride == ''
      ? 'http://localhost:4000'
      : _baseUrlOverride;

  static const String tokenKey = 'chillers_jwt_token';
  static const String userKey = 'chillers_user_data';

  static const String brandColorHex = '#D70466';
  static const String bgDarkHex = '#121214';
  static const String bgCardHex = '#18181B';
  static const String bgElevatedHex = '#202024';
}
