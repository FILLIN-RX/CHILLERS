import '../../../core/network/api_result.dart';
import '../domain/live_channel.dart';
import '../domain/live_match.dart';
import 'live_api_client.dart';

/// Repository Live TV & Sports — SSOT pour les channels et matchs.
class LiveRepository {
  static final LiveRepository _instance = LiveRepository._internal();
  factory LiveRepository() => _instance;
  LiveRepository._internal();

  final LiveApiClient _api = LiveApiClient();

  // Caches in-memory (durée de vie = session, données temps-réel)
  List<LiveChannel>? _channelsCache;
  List<LiveMatch>? _matchesCache;
  DateTime? _matchesCachedAt;

  static const Duration _matchCacheDuration = Duration(minutes: 2);

  // ── Channels ──────────────────────────────────────────────────────────────

  Future<List<LiveChannel>> getChannels({bool forceRefresh = false}) async {
    if (_channelsCache != null && !forceRefresh) return _channelsCache!;

    final result = await _api.getChannels();
    if (result is ApiSuccess<List<LiveChannel>>) {
      _channelsCache = result.data;
      return _channelsCache!;
    }
    return _channelsCache ?? [];
  }

  Future<List<String>> getCategories() async {
    final result = await _api.getCategories();
    return result is ApiSuccess<List<String>> ? result.data : [];
  }

  // ── Matchs ────────────────────────────────────────────────────────────────

  Future<List<LiveMatch>> getMatches({bool forceRefresh = false}) async {
    final now = DateTime.now();
    final isStale = _matchesCachedAt == null ||
        now.difference(_matchesCachedAt!) > _matchCacheDuration;

    if (_matchesCache != null && !isStale && !forceRefresh) return _matchesCache!;

    final result = await _api.getMatches();
    if (result is ApiSuccess<List<LiveMatch>>) {
      _matchesCache = result.data;
      _matchesCachedAt = now;
      return _matchesCache!;
    }
    return _matchesCache ?? [];
  }

  Future<List<LiveMatch>> getLeagueMatches(String league) async {
    final result = await _api.getLeagueMatches(league);
    return result is ApiSuccess<List<LiveMatch>> ? result.data : [];
  }

  Future<List<LiveMatch>> getChampionsLeagueMatches() async {
    final result = await _api.getChampionsLeagueMatches();
    return result is ApiSuccess<List<LiveMatch>> ? result.data : [];
  }

  Future<ApiResult<String>> getMatchStreamUrl(
    String matchId, {
    bool forceRefresh = false,
  }) =>
      _api.getMatchStreamUrl(matchId, forceRefresh: forceRefresh);

  /// Fusionne et déduplique les matchs de plusieurs sources.
  Future<List<LiveMatch>> getMergedMatches() async {
    final results = await Future.wait([
      getMatches(),
      getChampionsLeagueMatches(),
    ]);
    final map = <String, LiveMatch>{};
    for (final m in [...results[0], ...results[1]]) {
      map[m.id] = m;
    }
    return map.values.toList();
  }

  void clearCache() {
    _channelsCache = null;
    _matchesCache = null;
    _matchesCachedAt = null;
  }
}
