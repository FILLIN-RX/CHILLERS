import '../../../core/network/api_result.dart';
import '../../../core/storage/local_storage.dart';
import '../domain/user_model.dart';
import 'auth_api_client.dart';

/// Repository d'authentification — Single Source of Truth pour l'état auth.
///
/// Responsabilités :
/// - Persister le token et l'utilisateur localement
/// - Exposer les méthodes métier (login, register, logout, getProfile)
/// - Combiner AuthApiClient + LocalStorage
class AuthRepository {
  static final AuthRepository _instance = AuthRepository._internal();
  factory AuthRepository() => _instance;
  AuthRepository._internal();

  final AuthApiClient _api = AuthApiClient();
  final LocalStorage _storage = LocalStorage();

  UserModel? _currentUser;

  /// Utilisateur actuellement connecté (null si non connecté).
  UserModel? get currentUser => _currentUser;
  bool get isLoggedIn => _currentUser != null;

  // ── Auth actions ──────────────────────────────────────────────────────────

  Future<ApiResult<UserModel>> login(
    String email,
    String password, {
    String? deviceId,
    String? deviceName,
  }) async {
    final result = await _api.login(
      email, password,
      deviceId: deviceId,
      deviceName: deviceName,
    );
    return _handleAuthResult(result);
  }

  Future<ApiResult<UserModel>> register(
    String email,
    String password, {
    String? username,
    String? deviceId,
    String? deviceName,
  }) async {
    final result = await _api.register(
      email, password,
      username: username,
      deviceId: deviceId,
      deviceName: deviceName,
    );
    return _handleAuthResult(result);
  }

  Future<ApiResult<UserModel>> googleLogin({
    required String email,
    String? username,
    String? avatarUrl,
    String? deviceId,
    String? deviceName,
  }) async {
    final result = await _api.googleLogin(
      email: email,
      username: username,
      avatarUrl: avatarUrl,
      deviceId: deviceId,
      deviceName: deviceName,
    );
    return _handleAuthResult(result);
  }

  /// Récupère le profil depuis le cache local ou le serveur.
  Future<ApiResult<UserModel>> getProfile({bool forceRefresh = false}) async {
    // Retourner l'utilisateur en cache si disponible et pas de force refresh
    if (_currentUser != null && !forceRefresh) {
      return ApiSuccess(_currentUser!);
    }

    // Essayer le cache local
    final cached = await _storage.getJson('chillers_user_data');
    if (cached != null && !forceRefresh) {
      try {
        _currentUser = UserModel.fromJson(cached);
        return ApiSuccess(_currentUser!);
      } catch (_) {}
    }

    // Appel réseau
    final result = await _api.getProfile();
    if (result is ApiSuccess<UserModel>) {
      _currentUser = result.data;
      await _storage.saveJson('chillers_user_data', result.data.toJson());
    }
    return result;
  }

  /// Déconnexion — supprime le token et le cache.
  Future<void> logout() async {
    _currentUser = null;
    await _storage.removeToken();
    await _storage.remove('chillers_user_data');
  }

  /// Vérifie si un token existe localement (démarrage de l'app).
  Future<bool> hasValidToken() async {
    final token = await _storage.getToken();
    return token != null && token.isNotEmpty;
  }

  // ── Helper ────────────────────────────────────────────────────────────────

  ApiResult<UserModel> _handleAuthResult(ApiResult<AuthResponse> result) {
    if (result is ApiFailure<AuthResponse>) return ApiFailure(result.error);
    final response = (result as ApiSuccess<AuthResponse>).data;
    if (response.user == null) {
      return ApiFailure(AppError.unknown('Aucune donnée utilisateur reçue'));
    }
    _currentUser = response.user;
    return ApiSuccess(_currentUser!);
  }
}
