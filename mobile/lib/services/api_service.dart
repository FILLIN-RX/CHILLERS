import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import '../config/constants.dart';
import '../models/media_item.dart';
import '../models/user_model.dart';
import '../models/live_channel.dart';
import '../models/live_match.dart';
import '../models/genre.dart';
import '../models/subscription_plan.dart';
import 'storage_service.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  String get _base => AppConstants.baseUrl;
  final StorageService _storage = StorageService();

  static const String _antiBotSecret = 'chillers_antibot_secret_key_2025';

  String _generateClientToken() {
    final timestamp = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final reversed = timestamp.toString().split('').reversed.join('');
    final hash = md5.convert(utf8.encode('${reversed}_$_antiBotSecret')).toString();
    return '$timestamp,$hash';
  }

  Future<Map<String, String>> _getHeaders() async {
    final token = await _storage.getToken();
    final headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Client-Token': _generateClientToken(),
    };
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  List<dynamic> _extractList(dynamic data) {
    if (data == null) return [];
    if (data is List) return data;
    if (data is Map) {
      if (data['data'] != null) {
        if (data['data'] is List) return data['data'];
        if (data['data'] is Map) {
          final inner = data['data'] as Map;
          if (inner['results'] is List) return inner['results'];
          if (inner['channels'] is List) return inner['channels'];
          if (inner['items'] is List) return inner['items'];
          if (inner['episodes'] is List) return inner['episodes'];
          if (inner['genres'] is List) return inner['genres'];
          if (inner['plans'] is List) return inner['plans'];
          if (inner['data'] is List) return inner['data'];
        }
      }
      if (data['results'] is List) return data['results'];
      if (data['channels'] is List) return data['channels'];
      if (data['genres'] is List) return data['genres'];
      if (data['plans'] is List) return data['plans'];
      if (data['episodes'] is List) return data['episodes'];
    }
    return [];
  }

  // ==================== AUTHENTICATION ====================

  Future<Map<String, dynamic>> login(
    String email,
    String password, {
    String? deviceId,
    String? deviceName,
  }) async {
    try {
      final response = await http
          .post(
            Uri.parse('$_base/api/auth/login'),
            headers: await _getHeaders(),
            body: json.encode({
              'email': email,
              'password': password,
              'deviceId': deviceId,
              'deviceName': deviceName,
            }),
          )
          .timeout(const Duration(seconds: 15));

      final data = json.decode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        if (data['token'] != null) {
          await _storage.saveToken(data['token']);
        }
        if (data['user'] != null) {
          final user = UserModel.fromJson(data['user']);
          await _storage.saveUser(user);
        }
        return {'success': true, 'data': data};
      }
      return {
        'success': false,
        'message': data['message'] ?? 'Erreur lors de la connexion',
        'code': data['code'],
      };
    } catch (e) {
      return {'success': false, 'message': 'Impossible de contacter le serveur: $e'};
    }
  }

  Future<Map<String, dynamic>> register(
    String email,
    String password, {
    String? username,
    String? deviceId,
    String? deviceName,
  }) async {
    try {
      final response = await http
          .post(
            Uri.parse('$_base/api/auth/register'),
            headers: await _getHeaders(),
            body: json.encode({
              'email': email,
              'password': password,
              'username': username,
              'deviceId': deviceId,
              'deviceName': deviceName,
            }),
          )
          .timeout(const Duration(seconds: 15));

      final data = json.decode(response.body);
      if ((response.statusCode == 200 || response.statusCode == 201) && data['success'] == true) {
        if (data['token'] != null) {
          await _storage.saveToken(data['token']);
        }
        if (data['user'] != null) {
          final user = UserModel.fromJson(data['user']);
          await _storage.saveUser(user);
        }
        return {'success': true, 'data': data};
      }
      return {
        'success': false,
        'message': data['message'] ?? 'Erreur lors de l\'inscription',
      };
    } catch (e) {
      return {'success': false, 'message': 'Impossible de contacter le serveur: $e'};
    }
  }

  Future<UserModel?> getProfile() async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/auth/me'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['user'] != null) {
          final user = UserModel.fromJson(data['user']);
          await _storage.saveUser(user);
          return user;
        }
      }
    } catch (_) {}
    return null;
  }

  Future<List<SubscriptionPlanModel>> getSubscriptionPlans() async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/auth/plans'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = _extractList(data);
        return list.map((e) => SubscriptionPlanModel.fromJson(e)).toList();
      }
    } catch (_) {}
    return [];
  }

  // ==================== USER ACTIONS ====================

  Future<bool> toggleFavorite(String mediaId, {String type = 'movie'}) async {
    try {
      final response = await http
          .post(
            Uri.parse('$_base/api/user/favorites'),
            headers: await _getHeaders(),
            body: json.encode({'mediaId': mediaId, 'type': type}),
          )
          .timeout(const Duration(seconds: 10));

      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<bool> toggleWatchLater(String mediaId) async {
    try {
      final response = await http
          .post(
            Uri.parse('$_base/api/user/watch-later'),
            headers: await _getHeaders(),
            body: json.encode({'mediaId': mediaId}),
          )
          .timeout(const Duration(seconds: 10));

      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<bool> updateProgress(String mediaId, int progressSeconds, int totalSeconds) async {
    try {
      final response = await http
          .put(
            Uri.parse('$_base/api/user/progress'),
            headers: await _getHeaders(),
            body: json.encode({
              'mediaId': mediaId,
              'progress': progressSeconds,
              'duration': totalSeconds,
            }),
          )
          .timeout(const Duration(seconds: 10));

      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  // ==================== MOVIES ====================

  Future<List<MediaItem>> getTrendingMovies({int page = 1}) async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/movies/trending?page=$page'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = _extractList(data);
        return list.map((e) => MediaItem.fromJson({...e as Map<String, dynamic>, 'type': 'movie'})).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<List<MediaItem>> getPopularMovies({int page = 1}) async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/movies/popular?page=$page'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = _extractList(data);
        return list.map((e) => MediaItem.fromJson({...e as Map<String, dynamic>, 'type': 'movie'})).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<List<MediaItem>> getUpcomingMovies({int page = 1}) async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/movies/upcoming?page=$page'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = _extractList(data);
        return list.map((e) => MediaItem.fromJson({...e as Map<String, dynamic>, 'type': 'movie'})).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<List<MediaItem>> getTopRatedMovies({int page = 1}) async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/movies/top-rated?page=$page'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = _extractList(data);
        return list.map((e) => MediaItem.fromJson({...e as Map<String, dynamic>, 'type': 'movie'})).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<List<MediaItem>> getAfricanMovies({int page = 1}) async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/movies/african?page=$page'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = _extractList(data);
        return list.map((e) => MediaItem.fromJson({...e as Map<String, dynamic>, 'type': 'movie'})).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<List<MediaItem>> getMoviesByGenre(String genreId, {int page = 1}) async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/movies/genre/$genreId?page=$page'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = _extractList(data);
        return list.map((e) => MediaItem.fromJson({...e as Map<String, dynamic>, 'type': 'movie'})).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<MediaItem?> getMovieDetails(String id) async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/movies/$id'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final itemJson = data['data'] ?? data;
        if (itemJson is Map<String, dynamic>) {
          return MediaItem.fromJson({...itemJson, 'type': 'movie'});
        }
      }
    } catch (_) {}
    return null;
  }

  // ==================== TV SERIES & ANIMES ====================

  Future<List<MediaItem>> getTrendingSeries({int page = 1}) async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/tv/trending?page=$page'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = _extractList(data);
        return list.map((e) => MediaItem.fromJson({...e as Map<String, dynamic>, 'type': 'serie'})).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<List<MediaItem>> getLatestSeries() async {
    return getTrendingSeries();
  }

  Future<List<MediaItem>> getPopularSeries({int page = 1}) async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/tv/popular?page=$page'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = _extractList(data);
        return list.map((e) => MediaItem.fromJson({...e as Map<String, dynamic>, 'type': 'serie'})).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<List<MediaItem>> getAnimeSeries({int page = 1}) async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/tv/anime?page=$page'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = _extractList(data);
        return list.map((e) => MediaItem.fromJson({...e as Map<String, dynamic>, 'type': 'anime'})).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<List<MediaItem>> getAfricanSeries({int page = 1}) async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/tv/african?page=$page'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = _extractList(data);
        return list.map((e) => MediaItem.fromJson({...e as Map<String, dynamic>, 'type': 'serie'})).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<List<MediaItem>> getSeriesByGenre(String genreId, {int page = 1}) async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/tv/genre/$genreId?page=$page'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = _extractList(data);
        return list.map((e) => MediaItem.fromJson({...e as Map<String, dynamic>, 'type': 'serie'})).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<MediaItem?> getSeriesDetails(String id) async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/tv/$id'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final itemJson = data['data'] ?? data;
        if (itemJson is Map<String, dynamic>) {
          return MediaItem.fromJson({...itemJson, 'type': 'serie'});
        }
      }
    } catch (_) {}
    return null;
  }

  Future<List<EpisodeItem>> getSeasonDetails(String id, int seasonNumber) async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/tv/$id/season/$seasonNumber'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = _extractList(data);
        return list.map((e) => EpisodeItem.fromJson(e as Map<String, dynamic>)).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<MediaItem?> getMediaDetail(String id, {bool isSeries = false}) async {
    if (isSeries) {
      return getSeriesDetails(id);
    }
    return getMovieDetails(id);
  }

  Future<List<EpisodeItem>> getSeasonEpisodes(String id, int seasonNumber) async {
    return getSeasonDetails(id, seasonNumber);
  }

  Future<List<MediaItem>> getTopRatedSeries({int page = 1}) async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/tv/top_rated?page=$page'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = _extractList(data);
        return list.map((e) => MediaItem.fromJson({...e as Map<String, dynamic>, 'type': 'serie'})).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<List<MediaItem>> getMediaByGenre(String genreId, {String type = 'movie', int page = 1}) async {
    if (type == 'tv' || type == 'serie') {
      return getSeriesByGenre(genreId, page: page);
    }
    return getMoviesByGenre(genreId, page: page);
  }

  // ==================== LIVE TV & SPORTS ====================

  Future<List<LiveChannel>> getLiveChannels() async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/live/channels'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = _extractList(data);
        return list.map((e) => LiveChannel.fromJson(e as Map<String, dynamic>)).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<List<String>> getLiveCategories() async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/live/channels/categories'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = _extractList(data);
        return list.map((e) => e.toString()).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<List<LiveMatch>> getLiveMatches() async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/liveball/matches'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = _extractList(data);
        return list.map((e) => LiveMatch.fromJson(e as Map<String, dynamic>)).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<String?> getMatchStreamUrl(String matchId) async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/liveball/match/$matchId/stream'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final url = data['data']?['url'] ?? data['url'];
        if (url != null && url.toString().isNotEmpty) {
          return url.toString();
        }
      }
    } catch (_) {}
    return null;
  }

  // ==================== SEARCH & GENRES ====================

  Future<List<MediaItem>> searchMedia(String query) async {
    if (query.trim().isEmpty) return [];
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/search?q=${Uri.encodeComponent(query)}'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = _extractList(data);
        return list.map((e) => MediaItem.fromJson(e as Map<String, dynamic>)).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<List<GenreModel>> getGenres() async {
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/genres'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = _extractList(data);
        return list.map((e) => GenreModel.fromJson(e as Map<String, dynamic>)).toList();
      }
    } catch (_) {}
    return [];
  }

  // ==================== STREAM PLAYBACK ====================

  Future<String?> getMovieStreamUrl(String id, String title) async {
    // 1. Source Principale Backend
    try {
      final response = await http
          .get(
            Uri.parse('$_base/api/stream/movie/$id?type=movie&title=${Uri.encodeComponent(title)}'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        String? url = data['data']?['embedUrl'] ?? data['embedUrl'] ?? data['url'];
        if (url != null && url.isNotEmpty) {
          if (url.startsWith('/')) url = '$_base$url';
          return url;
        }
      }
    } catch (_) {}

    // 2. Source Secondaire NexStream
    try {
      final res2 = await http
          .get(
            Uri.parse('$_base/api/nexstream/movie/$id?type=movie&title=${Uri.encodeComponent(title)}'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 6));

      if (res2.statusCode == 200) {
        final data2 = json.decode(res2.body);
        String? url2 = data2['data']?['embedUrl'] ?? data2['embedUrl'] ?? data2['url'];
        if (url2 != null && url2.isNotEmpty) {
          if (url2.startsWith('/')) url2 = '$_base$url2';
          return url2;
        }
      }
    } catch (_) {}

    // 3. Fallback VidLink Embed
    if (int.tryParse(id) != null) {
      return 'https://vidlink.pro/movie/$id';
    }

    return null;
  }

  Future<String?> getEpisodeStreamUrl(String id, int season, int episode, String title) async {
    // 1. Source Principale Backend
    try {
      final response = await http
          .get(
            Uri.parse(
                '$_base/api/stream/tv/$id/$season/$episode?type=series&title=${Uri.encodeComponent(title)}'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        String? url = data['data']?['embedUrl'] ?? data['embedUrl'] ?? data['url'];
        if (url != null && url.isNotEmpty) {
          if (url.startsWith('/')) url = '$_base$url';
          return url;
        }
      }
    } catch (_) {}

    // 2. Source Secondaire NexStream
    try {
      final res2 = await http
          .get(
            Uri.parse(
                '$_base/api/nexstream/tv/$id/$season/$episode?type=series&title=${Uri.encodeComponent(title)}'),
            headers: await _getHeaders(),
          )
          .timeout(const Duration(seconds: 6));

      if (res2.statusCode == 200) {
        final data2 = json.decode(res2.body);
        String? url2 = data2['data']?['embedUrl'] ?? data2['embedUrl'] ?? data2['url'];
        if (url2 != null && url2.isNotEmpty) {
          if (url2.startsWith('/')) url2 = '$_base$url2';
          return url2;
        }
      }
    } catch (_) {}

    // 3. Fallback VidLink Embed
    if (int.tryParse(id) != null) {
      return 'https://vidlink.pro/tv/$id/$season/$episode';
    }

    return null;
  }
}
