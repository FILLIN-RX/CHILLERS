import 'package:flutter/foundation.dart';
import '../data/auth_repository.dart';
import '../domain/user_model.dart';

enum AuthState { idle, loading, success, error }

/// ViewModel pour l'écran d'authentification.
/// Extrait toute la logique login/register/google de auth_screen.dart.
class AuthViewModel extends ChangeNotifier {
  AuthViewModel() : _repo = AuthRepository();

  final AuthRepository _repo;

  AuthState state = AuthState.idle;
  UserModel? user;
  String? errorMessage;

  bool get isLoading => state == AuthState.loading;
  bool get hasError => state == AuthState.error;
  bool get isSuccess => state == AuthState.success;

  // ── Actions ───────────────────────────────────────────────────────────────

  Future<bool> login(
    String email,
    String password, {
    String? deviceId,
    String? deviceName,
  }) async {
    _setLoading();
    final result = await _repo.login(
      email, password,
      deviceId: deviceId,
      deviceName: deviceName,
    );
    return _handleResult(result);
  }

  Future<bool> register(
    String email,
    String password, {
    String? username,
    String? deviceId,
    String? deviceName,
  }) async {
    _setLoading();
    final result = await _repo.register(
      email, password,
      username: username,
      deviceId: deviceId,
      deviceName: deviceName,
    );
    return _handleResult(result);
  }

  Future<bool> googleLogin({
    required String email,
    String? username,
    String? avatarUrl,
    String? deviceId,
    String? deviceName,
  }) async {
    _setLoading();
    final result = await _repo.googleLogin(
      email: email,
      username: username,
      avatarUrl: avatarUrl,
      deviceId: deviceId,
      deviceName: deviceName,
    );
    return _handleResult(result);
  }

  Future<void> loadCurrentUser() async {
    final result = await _repo.getProfile();
    if (result is ApiSuccess<UserModel>) {
      user = result.data;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await _repo.logout();
    user = null;
    state = AuthState.idle;
    notifyListeners();
  }

  Future<bool> checkAuthStatus() async {
    final hasToken = await _repo.hasValidToken();
    if (hasToken) {
      await loadCurrentUser();
    }
    return hasToken;
  }

  void clearError() {
    errorMessage = null;
    state = AuthState.idle;
    notifyListeners();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  void _setLoading() {
    state = AuthState.loading;
    errorMessage = null;
    notifyListeners();
  }

  bool _handleResult(dynamic result) {
    if (result is ApiSuccess<UserModel>) {
      user = result.data;
      state = AuthState.success;
      notifyListeners();
      return true;
    }
    if (result is ApiFailure<UserModel>) {
      errorMessage = result.error.message;
      state = AuthState.error;
      notifyListeners();
      return false;
    }
    state = AuthState.idle;
    notifyListeners();
    return false;
  }
}
