import '../../../core/network/api_client.dart';
import '../../../core/network/api_result.dart';
import '../../../core/storage/local_storage.dart';
import '../domain/user_model.dart';

/// Client API pour les endpoints d'authentification.
/// Seul responsable des appels réseau auth — aucun état local.
class AuthApiClient {
  static final AuthApiClient _instance = AuthApiClient._internal();
  factory AuthApiClient() => _instance;
  AuthApiClient._internal();

  final ApiClient _client = ApiClient();
  final LocalStorage _storage = LocalStorage();

  Future<ApiResult<AuthResponse>> login(
    String email,
    String password, {
    String? deviceId,
    String? deviceName,
  }) async {
    final result = await _client.post<Map<String, dynamic>>(
      '/auth/login',
      data: {
        'email': email,
        'password': password,
        if (deviceId != null) 'deviceId': deviceId,
        if (deviceName != null) 'deviceName': deviceName,
      },
    );
    return _handleAuthResponse(result);
  }

  Future<ApiResult<AuthResponse>> register(
    String email,
    String password, {
    String? username,
    String? deviceId,
    String? deviceName,
  }) async {
    final result = await _client.post<Map<String, dynamic>>(
      '/auth/register',
      data: {
        'email': email,
        'password': password,
        if (username != null) 'username': username,
        if (deviceId != null) 'deviceId': deviceId,
        if (deviceName != null) 'deviceName': deviceName,
      },
    );
    return _handleAuthResponse(result);
  }

  Future<ApiResult<AuthResponse>> googleLogin({
    required String email,
    String? username,
    String? avatarUrl,
    String? deviceId,
    String? deviceName,
  }) async {
    final result = await _client.post<Map<String, dynamic>>(
      '/auth/google',
      data: {
        'email': email,
        if (username != null) 'username': username,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
        if (deviceId != null) 'deviceId': deviceId,
        if (deviceName != null) 'deviceName': deviceName,
      },
    );
    return _handleAuthResponse(result);
  }

  Future<ApiResult<UserModel>> getProfile() async {
    final result = await _client.get<Map<String, dynamic>>('/auth/me');
    if (result is ApiFailure<Map<String, dynamic>>) {
      return ApiFailure(result.error);
    }
    try {
      final data = (result as ApiSuccess<Map<String, dynamic>>).data;
      final userJson = data['user'] as Map<String, dynamic>?;
      if (userJson == null) return ApiFailure(AppError.parse('Pas de données utilisateur'));
      return ApiSuccess(UserModel.fromJson(userJson));
    } catch (e) {
      return ApiFailure(AppError.parse(e.toString()));
    }
  }

  // ── Helper privé ──────────────────────────────────────────────────────────

  Future<ApiResult<AuthResponse>> _handleAuthResponse(
    ApiResult<Map<String, dynamic>> result,
  ) async {
    if (result is ApiFailure<Map<String, dynamic>>) {
      return ApiFailure(result.error);
    }
    try {
      final data = (result as ApiSuccess<Map<String, dynamic>>).data;

      final token = data['token']?.toString();
      final userJson = data['user'] as Map<String, dynamic>?;

      if (token != null) await _storage.saveToken(token);

      UserModel? user;
      if (userJson != null) {
        user = UserModel.fromJson(userJson);
        await _storage.saveJson('chillers_user_data', userJson);
      }

      return ApiSuccess(AuthResponse(token: token, user: user));
    } catch (e) {
      return ApiFailure(AppError.parse(e.toString()));
    }
  }
}

/// Réponse d'authentification.
class AuthResponse {
  final String? token;
  final UserModel? user;
  const AuthResponse({this.token, this.user});
}
