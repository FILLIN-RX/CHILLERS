import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'native_bridge.dart';

class BiometricService extends ChangeNotifier {
  static final BiometricService _instance = BiometricService._internal();
  factory BiometricService() => _instance;
  BiometricService._internal() {
    _init();
  }

  final LocalAuthentication _auth = LocalAuthentication();
  static const String _biometricPrefKey = 'chillers_biometric_enabled_v1';

  bool _isAvailable = false;
  bool _isEnabled = false;
  List<BiometricType> _availableBiometrics = [];

  bool get isAvailable => _isAvailable;
  bool get isEnabled => _isEnabled;
  List<BiometricType> get availableBiometrics => _availableBiometrics;

  bool get hasFaceId => _availableBiometrics.contains(BiometricType.face);
  bool get hasFingerprint =>
      _availableBiometrics.contains(BiometricType.fingerprint) ||
      _availableBiometrics.contains(BiometricType.strong) ||
      _availableBiometrics.contains(BiometricType.weak);

  String get biometricName {
    if (hasFaceId) return 'Face ID';
    if (hasFingerprint) return 'Empreinte digitale';
    return 'Biométrie';
  }

  Future<void> _init() async {
    try {
      final isSupported = await _auth.isDeviceSupported();
      final canCheck = await _auth.canCheckBiometrics;
      _isAvailable = isSupported && canCheck;

      if (_isAvailable) {
        _availableBiometrics = await _auth.getAvailableBiometrics();
      }

      final prefs = await SharedPreferences.getInstance();
      _isEnabled = prefs.getBool(_biometricPrefKey) ?? false;
      notifyListeners();
    } catch (e) {
      debugPrint('[BiometricService] Erreur init: $e');
      _isAvailable = false;
    }
  }

  /// Déclenche l'authentification biométrique avec invite système
  Future<bool> authenticate({String? reason}) async {
    if (!_isAvailable) return true;

    try {
      NativeBridge.instance.selectionHaptic();
      final authenticated = await _auth.authenticate(
        localizedReason: reason ?? 'Authentifiez-vous pour déverrouiller CHILLERS',
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
          useErrorDialogs: true,
        ),
      );

      if (authenticated) {
        NativeBridge.instance.lightHaptic();
      }
      return authenticated;
    } on PlatformException catch (e) {
      debugPrint('[BiometricService] Erreur authentification: ${e.message}');
      return false;
    } catch (e) {
      debugPrint('[BiometricService] Erreur inconnue: $e');
      return false;
    }
  }

  /// Active ou désactive le verrouillage biométrique
  Future<bool> setBiometricEnabled(bool enable) async {
    if (enable) {
      // Vérification que la biométrie fonctionne avant d'enregistrer
      final success = await authenticate(
        reason: 'Confirmez votre identité pour activer le verrouillage par $biometricName',
      );
      if (!success) return false;
    }

    _isEnabled = enable;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_biometricPrefKey, enable);
    notifyListeners();
    NativeBridge.instance.mediumHaptic();
    return true;
  }
}
