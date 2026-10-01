import '../../../core/network/api_client.dart';
import '../../../core/network/api_result.dart';
import '../domain/live_channel.dart';
import '../domain/live_match.dart';

/// Client API pour les canaux TV en direct, matchs de football et streams live.
class LiveApiClient {
  static final LiveApiClient _instance = LiveApiClient._internal();
  factory LiveApiClient() => _instance;
  LiveApiClient._internal();

  final ApiClient _client = ApiClient();

  // ── Chaînes TV en direct ──────────────────────────────────────────────────

  Future<ApiResult<List<LiveChannel>>> getChannels() async {
    final result = await _client.get<dynamic>('/live/channels');
    return _parseList(result, LiveChannel.fromJson);
  }

  Future<ApiResult<List<String>>> getCategories() async {
    final result = await _client.get<dynamic>('/live/channels/categories');
    if (result is ApiFailure) return ApiFailure((result as ApiFailure).error);
    final list = _client.extractList((result as ApiSuccess).data);
    return ApiSuccess(list.map((e) => e.toString()).toList());
  }

  // ── Matchs de foot (LiveBall) ─────────────────────────────────────────────

  Future<ApiResult<List<LiveMatch>>> getMatches() async {
    final result = await _client.get<dynamic>('/liveball/matches');
    return _parseList(result, LiveMatch.fromJson);
  }

  Future<ApiResult<List<LiveMatch>>> getAvailableMatches() async {
    final result = await _client.get<dynamic>('/liveball/matches/available');
    return _parseList(result, LiveMatch.fromJson);
  }

  Future<ApiResult<List<LiveMatch>>> getLeagueMatches(String league) async {
    final result = await _client.get<dynamic>(
      '/liveball/league/${Uri.encodeComponent(league)}/matches',
    );
    return _parseList(result, LiveMatch.fromJson);
  }

  Future<ApiResult<List<LiveMatch>>> getChampionsLeagueMatches() async {
    final result = await getLeagueMatches('champions-league');
    if (result is ApiSuccess<List<LiveMatch>> && result.data.isNotEmpty) return result;
    return getLeagueMatches('uefa-champions-league');
  }

  Future<ApiResult<String>> getMatchStreamUrl(
    String matchId, {
    bool forceRefresh = false,
  }) async {
    final query = forceRefresh ? {'refresh': 'true'} : null;
    final result = await _client.get<dynamic>(
      '/liveball/match/${Uri.encodeComponent(matchId)}/stream',
      queryParameters: query,
    );

    if (result is ApiFailure) return ApiFailure((result as ApiFailure).error);
    try {
      final data = (result as ApiSuccess).data;
      final streamData = data['data'] ?? data;
      final relayUrl = streamData['relayUrl']?.toString();
      final url = streamData['url']?.toString();
      final type = streamData['type']?.toString();

      if (type == 'iframe' && url != null && url.isNotEmpty) return ApiSuccess(url);
      if (relayUrl != null && relayUrl.isNotEmpty) return ApiSuccess(relayUrl);
      if (url != null && url.isNotEmpty) return ApiSuccess(url);

      return ApiFailure(AppError.notFound());
    } catch (e) {
      return ApiFailure(AppError.parse(e.toString()));
    }
  }

  // ── Helper ────────────────────────────────────────────────────────────────

  ApiResult<List<T>> _parseList<T>(
    ApiResult<dynamic> result,
    T Function(Map<String, dynamic>) fromJson,
  ) {
    if (result is ApiFailure) return ApiFailure((result as ApiFailure).error);
    try {
      final list = _client.extractList((result as ApiSuccess).data);
      return ApiSuccess(
        list.whereType<Map<String, dynamic>>().map(fromJson).toList(),
      );
    } catch (e) {
      return ApiFailure(AppError.parse(e.toString()));
    }
  }
}
