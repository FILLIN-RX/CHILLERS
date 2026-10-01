import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import '../config/constants.dart';
import '../storage/local_storage.dart';
import 'api_result.dart';

/// Client HTTP centralisé pour toute l'app.
/// Gère : auth headers, X-Client-Token anti-bot, erreurs typées.
///
/// Utilisation :
/// ```dart
/// final client = ApiClient();
/// final result = await client.get<List<dynamic>>('/movies/trending');
/// ```
class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio _dio;

  ApiClient._internal() {
    _dio = Dio(BaseOptions(
      baseUrl: '${AppConstants.baseUrl}/api',
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
      headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: _onRequest,
      onError: _onError,
    ));
  }

  // ── Secret anti-bot chargé depuis --dart-define (non versionné) ────────────
  static const String _antiBotSecret =
      String.fromEnvironment('ANTIBOT_SECRET', defaultValue: 'chillers_antibot_secret_key_2025');

  String _generateClientToken() {
    final ts = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final reversed = ts.toString().split('').reversed.join('');
    final hash = md5.convert(utf8.encode('${reversed}_$_antiBotSecret')).toString();
    return '$ts,$hash';
  }

  Future<void> _onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    options.headers['X-Client-Token'] = _generateClientToken();
    final token = await LocalStorage().getToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  void _onError(DioException err, ErrorInterceptorHandler handler) {
    // Log centralisé — remplace les 37x catch (_) {}
    // ignore: avoid_print
    print('[ApiClient] ${err.type} ${err.requestOptions.path} → ${err.response?.statusCode}');
    handler.next(err);
  }

  // ── Méthodes HTTP ──────────────────────────────────────────────────────────

  Future<ApiResult<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    T Function(dynamic)? fromJson,
  }) async {
    try {
      final response = await _dio.get(path, queryParameters: queryParameters);
      return _parse<T>(response.data, fromJson);
    } catch (e) {
      return ApiFailure(_mapError(e));
    }
  }

  Future<ApiResult<T>> post<T>(
    String path, {
    dynamic data,
    T Function(dynamic)? fromJson,
  }) async {
    try {
      final response = await _dio.post(path, data: data);
      return _parse<T>(response.data, fromJson);
    } catch (e) {
      return ApiFailure(_mapError(e));
    }
  }

  Future<ApiResult<T>> put<T>(
    String path, {
    dynamic data,
    T Function(dynamic)? fromJson,
  }) async {
    try {
      final response = await _dio.put(path, data: data);
      return _parse<T>(response.data, fromJson);
    } catch (e) {
      return ApiFailure(_mapError(e));
    }
  }

  // ── Parsing & erreurs ──────────────────────────────────────────────────────

  ApiResult<T> _parse<T>(dynamic data, T Function(dynamic)? fromJson) {
    try {
      if (fromJson != null) return ApiSuccess(fromJson(data));
      if (data is T) return ApiSuccess(data);
      return ApiFailure(AppError.parse('Type inattendu: ${data.runtimeType}'));
    } catch (e) {
      return ApiFailure(AppError.parse(e.toString()));
    }
  }

  AppError _mapError(dynamic e) {
    if (e is DioException) {
      switch (e.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          return AppError.timeout();
        case DioExceptionType.badResponse:
          final code = e.response?.statusCode;
          if (code == 401) return AppError.unauthorized();
          if (code == 404) return AppError.notFound();
          return AppError.network('Erreur serveur ($code)', statusCode: code);
        case DioExceptionType.cancel:
          return AppError.unknown('Requête annulée');
        default:
          return AppError.network(e.message ?? 'Erreur réseau');
      }
    }
    return AppError.unknown(e.toString());
  }

  /// Utilitaire : extrait la liste depuis les différents formats de réponse backend.
  List<dynamic> extractList(dynamic data) {
    if (data == null) return [];
    if (data is List) return data;
    if (data is Map) {
      if (data['data'] is List) return data['data'] as List;
      if (data['data'] is Map) {
        final inner = data['data'] as Map;
        for (final key in ['results', 'channels', 'items', 'episodes', 'genres', 'plans', 'data']) {
          if (inner[key] is List) return inner[key] as List;
        }
      }
      for (final key in ['results', 'channels', 'genres', 'plans', 'episodes']) {
        if (data[key] is List) return data[key] as List;
      }
    }
    return [];
  }
}
