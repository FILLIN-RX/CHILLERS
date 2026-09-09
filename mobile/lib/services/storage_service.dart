import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/constants.dart';
import '../models/user_model.dart';

class StorageService {
  static final StorageService _instance = StorageService._internal();
  factory StorageService() => _instance;
  StorageService._internal();

  SharedPreferences? _prefs;

  Future<SharedPreferences> get _instancePrefs async {
    _prefs ??= await SharedPreferences.getInstance();
    return _prefs!;
  }

  Future<void> saveToken(String token) async {
    final prefs = await _instancePrefs;
    await prefs.setString(AppConstants.tokenKey, token);
  }

  Future<String?> getToken() async {
    final prefs = await _instancePrefs;
    return prefs.getString(AppConstants.tokenKey);
  }

  Future<void> saveUser(UserModel user) async {
    final prefs = await _instancePrefs;
    await prefs.setString(AppConstants.userKey, json.encode(user.toJson()));
  }

  Future<UserModel?> getUser() async {
    final prefs = await _instancePrefs;
    final userStr = prefs.getString(AppConstants.userKey);
    if (userStr != null) {
      try {
        return UserModel.fromJson(json.decode(userStr));
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  Future<void> clearAuth() async {
    final prefs = await _instancePrefs;
    await prefs.remove(AppConstants.tokenKey);
    await prefs.remove(AppConstants.userKey);
  }
}
