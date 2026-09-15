import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Pont vers les capacités natives Android :
/// - Service de premier plan & notifications
/// - Picture-in-Picture (PiP)
/// - Contrôle direct de la luminosité et du volume matériel
/// - Publication dans Téléchargements & Espace disque
/// - Retours haptiques
class NativeBridge {
  NativeBridge._() {
    _channel.setMethodCallHandler(_handleNativeCall);
  }
  static final NativeBridge instance = NativeBridge._();

  static const MethodChannel _channel = MethodChannel('chillers/downloads');

  final StreamController<bool> _pipModeController = StreamController<bool>.broadcast();
  Stream<bool> get onPipModeChanged => _pipModeController.stream;
  bool _isInPip = false;
  bool get isInPip => _isInPip;

  Future<dynamic> _handleNativeCall(MethodCall call) async {
    if (call.method == 'onPipModeChanged') {
      final bool inPip = call.arguments as bool? ?? false;
      _isInPip = inPip;
      _pipModeController.add(inPip);
    }
  }

  bool get _isAndroid {
    if (kIsWeb) return false;
    try {
      return Platform.isAndroid;
    } catch (_) {
      return false;
    }
  }

  // ── Picture-in-Picture ──

  Future<bool> isPipSupported() async {
    if (!_isAndroid) return false;
    try {
      return await _channel.invokeMethod<bool>('isPipSupported') ?? false;
    } catch (e) {
      debugPrint('[NativeBridge] isPipSupported: $e');
      return false;
    }
  }

  Future<bool> enterPip({int aspectRatioNumerator = 16, int aspectRatioDenominator = 9}) async {
    if (!_isAndroid) return false;
    try {
      lightHaptic();
      return await _channel.invokeMethod<bool>('enterPip', {
            'aspectRatioNumerator': aspectRatioNumerator,
            'aspectRatioDenominator': aspectRatioDenominator,
          }) ??
          false;
    } catch (e) {
      debugPrint('[NativeBridge] enterPip: $e');
      return false;
    }
  }

  // ── Wi-Fi Multicast & Smart TV Cast ──

  Future<void> acquireMulticastLock() async {
    await _invoke('acquireMulticastLock');
  }

  Future<void> releaseMulticastLock() async {
    await _invoke('releaseMulticastLock');
  }

  Future<bool> openExternalCaster({required String videoUrl, required String title}) async {
    if (!_isAndroid) return false;
    try {
      return await _channel.invokeMethod<bool>('openExternalCaster', {
            'videoUrl': videoUrl,
            'title': title,
          }) ??
          false;
    } catch (e) {
      debugPrint('[NativeBridge] openExternalCaster: $e');
      return false;
    }
  }

  // ── Contrôles Gestuels : Luminosité & Volume ──

  /// Règle la luminosité d'écran (0.0 à 1.0, ou -1.0 pour rétablir la luminosité système).
  Future<void> setBrightness(double brightness) async {
    if (!_isAndroid) return;
    try {
      await _channel.invokeMethod('setBrightness', {'brightness': brightness});
    } catch (e) {
      debugPrint('[NativeBridge] setBrightness: $e');
    }
  }

  Future<double> getBrightness() async {
    if (!_isAndroid) return -1.0;
    try {
      return await _channel.invokeMethod<double>('getBrightness') ?? -1.0;
    } catch (e) {
      debugPrint('[NativeBridge] getBrightness: $e');
      return -1.0;
    }
  }

  /// Règle le volume audio multimédia (0.0 à 1.0).
  Future<void> setVolume(double volume) async {
    if (!_isAndroid) return;
    try {
      await _channel.invokeMethod('setVolume', {'volume': volume});
    } catch (e) {
      debugPrint('[NativeBridge] setVolume: $e');
    }
  }

  Future<double> getVolume() async {
    if (!_isAndroid) return 0.5;
    try {
      return await _channel.invokeMethod<double>('getVolume') ?? 0.5;
    } catch (e) {
      debugPrint('[NativeBridge] getVolume: $e');
      return 0.5;
    }
  }

  // ── Retours Haptiques (Vibrations Subtiles) ──

  void lightHaptic() {
    try {
      HapticFeedback.lightImpact();
    } catch (_) {}
  }

  void mediumHaptic() {
    try {
      HapticFeedback.mediumImpact();
    } catch (_) {}
  }

  void selectionHaptic() {
    try {
      HapticFeedback.selectionClick();
    } catch (_) {}
  }

  // ── Notifications & Service de Premier Plan ──

  /// Demande POST_NOTIFICATIONS (Android 13+). Renvoie true si accordée.
  Future<bool> ensureNotificationPermission() async {
    if (!_isAndroid) return false;
    try {
      return await _channel.invokeMethod<bool>('ensureNotificationPermission') ?? false;
    } catch (e) {
      debugPrint('[NativeBridge] ensureNotificationPermission: $e');
      return false;
    }
  }

  /// Démarre le service de premier plan : le process survit alors en arrière-plan
  /// et l'isolate Dart continue d'exécuter le téléchargement.
  Future<void> startForeground({required String title}) async {
    await _invoke('startForeground', {'title': title});
  }

  Future<void> updateProgress({required String title, required int progress}) async {
    await _invoke('updateProgress', {'title': title, 'progress': progress});
  }

  Future<void> stopForeground() async {
    await _invoke('stopForeground');
  }

  Future<void> notifyCompleted({required String title, String? uri}) async {
    await _invoke('notifyCompleted', {'title': title, 'uri': uri});
  }

  /// Alerte avant le coup d'envoi d'un match de football ou événement sportif
  Future<void> showMatchAlert({required String title, required String body}) async {
    await _invoke('showMatchAlert', {'title': title, 'body': body});
  }

  /// Alerte lors de la sortie d'un nouvel épisode ou film
  Future<void> showReleaseAlert({required String title, required String body}) async {
    await _invoke('showReleaseAlert', {'title': title, 'body': body});
  }

  /// Copie un fichier du stockage privé vers le dossier Téléchargements public.
  Future<String?> publishToDownloads({
    required String path,
    required String displayName,
  }) async {
    if (!_isAndroid) return null;
    try {
      return await _channel.invokeMethod<String>('publishToDownloads', {
        'path': path,
        'displayName': displayName,
      });
    } catch (e) {
      debugPrint('[NativeBridge] publishToDownloads: $e');
      return null;
    }
  }

  Future<bool> deletePublished(String uri) async {
    if (!_isAndroid) return false;
    try {
      return await _channel.invokeMethod<bool>('deletePublished', {'uri': uri}) ?? false;
    } catch (e) {
      debugPrint('[NativeBridge] deletePublished: $e');
      return false;
    }
  }

  /// Ouvre un fichier publié avec le lecteur vidéo du système.
  Future<bool> openUri(String uri) async {
    if (!_isAndroid) return false;
    try {
      return await _channel.invokeMethod<bool>('openUri', {'uri': uri}) ?? false;
    } catch (e) {
      debugPrint('[NativeBridge] openUri: $e');
      return false;
    }
  }

  /// Espace disque disponible en octets, ou -1 si indisponible.
  Future<int> getFreeSpace() async {
    if (!_isAndroid) return -1;
    try {
      return await _channel.invokeMethod<int>('getFreeSpace') ?? -1;
    } catch (e) {
      debugPrint('[NativeBridge] getFreeSpace: $e');
      return -1;
    }
  }

  Future<void> _invoke(String method, [Map<String, dynamic>? args]) async {
    if (!_isAndroid) return;
    try {
      await _channel.invokeMethod(method, args);
    } catch (e) {
      debugPrint('[NativeBridge] $method: $e');
    }
  }
}
