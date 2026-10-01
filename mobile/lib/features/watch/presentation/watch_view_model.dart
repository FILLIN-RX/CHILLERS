import 'package:flutter/foundation.dart';
import '../data/stream_api_client.dart';
import '../../../core/network/api_result.dart';

enum StreamState { idle, loading, ready, error }

/// ViewModel pour le lecteur vidéo.
/// Extrait les 18x setState de watch_screen.dart.
class WatchViewModel extends ChangeNotifier {
  WatchViewModel() : _api = StreamApiClient();

  final StreamApiClient _api;

  StreamState state = StreamState.idle;
  String? streamUrl;
  String? errorMessage;
  bool isFullscreen = false;
  double aspectRatio = 16 / 9;
  Duration position = Duration.zero;
  Duration duration = Duration.zero;
  bool isBuffering = false;
  bool showControls = true;

  bool get isLoading => state == StreamState.loading;
  bool get isReady => state == StreamState.ready && streamUrl != null;
  bool get hasError => state == StreamState.error;
  double get progress => duration.inSeconds > 0 ? position.inSeconds / duration.inSeconds : 0;

  // ── Chargement stream ─────────────────────────────────────────────────────

  Future<void> loadMovieStream(String id, String title, {String language = 'fr'}) async {
    _setLoading();
    final result = await _api.getMovieStreamUrl(id, title, language: language);
    _handleStreamResult(result);
  }

  Future<void> loadEpisodeStream(
    String id,
    int season,
    int episode,
    String title, {
    String language = 'fr',
  }) async {
    _setLoading();
    final result = await _api.getEpisodeStreamUrl(id, season, episode, title, language: language);
    _handleStreamResult(result);
  }

  // ── Contrôles player ─────────────────────────────────────────────────────

  void updatePosition(Duration pos) {
    position = pos;
    notifyListeners();
  }

  void updateDuration(Duration dur) {
    duration = dur;
    notifyListeners();
  }

  void setBuffering(bool buffering) {
    isBuffering = buffering;
    notifyListeners();
  }

  void toggleFullscreen() {
    isFullscreen = !isFullscreen;
    notifyListeners();
  }

  void toggleControls() {
    showControls = !showControls;
    notifyListeners();
  }

  void setAspectRatio(double ratio) {
    aspectRatio = ratio;
    notifyListeners();
  }

  void retry() {
    state = StreamState.idle;
    streamUrl = null;
    errorMessage = null;
    notifyListeners();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  void _setLoading() {
    state = StreamState.loading;
    streamUrl = null;
    errorMessage = null;
    notifyListeners();
  }

  void _handleStreamResult(ApiResult<String> result) {
    if (result is ApiSuccess<String>) {
      streamUrl = result.data;
      state = StreamState.ready;
    } else if (result is ApiFailure<String>) {
      errorMessage = result.error.message;
      state = StreamState.error;
    }
    notifyListeners();
  }
}
