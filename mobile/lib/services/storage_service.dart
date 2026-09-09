import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/constants.dart';
import '../models/user_model.dart';

class StorageService {
  static final StorageService _instance = StorageService._internal();
  factory StorageService() => _instance;
  StorageService._internal();

  SharedPreferences? _prefs;

  static const String _continueWatchingKey = 'chillers_continue_watching';
  static const String _favoritesKey = 'chillers_favorites';
  static const String _watchlistKey = 'chillers_watchlist';
  static const String _playlistsKey = 'chillers_playlists';

  Future<SharedPreferences> get _instancePrefs async {
    _prefs ??= await SharedPreferences.getInstance();
    return _prefs!;
  }

  // ── AUTHENTIFICATION ──
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

  // ── REPRISE DE LECTURE & HISTORIQUE RÉCENT ──
  Future<void> saveWatchProgress({
    required String id,
    required String title,
    required String poster,
    required int positionMs,
    required int durationMs,
    String? type,
    int? season,
    int? episode,
    String? streamUrl,
  }) async {
    if (durationMs <= 0 || positionMs <= 0) return;
    final percentage = (positionMs / durationMs).clamp(0.0, 1.0);

    final prefs = await _instancePrefs;
    final list = await getContinueWatching();

    // Retirer l'ancien enregistrement s'il existe
    list.removeWhere((item) => item['id'] == id);

    // Si la vidéo est terminée à plus de 95%, on ne la remet pas dans "Reprendre", mais on peut garder l'historique
    if (percentage < 0.95) {
      // Ajouter en première position (le plus récent)
      list.insert(0, {
        'id': id,
        'title': title,
        'poster': poster,
        'positionMs': positionMs,
        'durationMs': durationMs,
        'percentage': percentage,
        'updatedAt': DateTime.now().toIso8601String(),
        'type': type ?? 'movie',
        'season': season,
        'episode': episode,
        'streamUrl': streamUrl,
      });
    }

    // Garder max 30 entrées
    final trimmed = list.take(30).toList();
    await prefs.setString(_continueWatchingKey, json.encode(trimmed));
  }

  Future<List<Map<String, dynamic>>> getContinueWatching() async {
    final prefs = await _instancePrefs;
    final str = prefs.getString(_continueWatchingKey);
    if (str == null || str.isEmpty) return [];
    try {
      final List<dynamic> decoded = json.decode(str);
      return decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (e) {
      debugPrint('Erreur lecture continue watching: $e');
      return [];
    }
  }

  Future<Map<String, dynamic>?> getProgress(String id) async {
    final list = await getContinueWatching();
    final match = list.where((item) => item['id'] == id);
    if (match.isNotEmpty) return match.first;
    return null;
  }

  Future<void> removeWatchProgress(String id) async {
    final prefs = await _instancePrefs;
    final list = await getContinueWatching();
    list.removeWhere((item) => item['id'] == id);
    await prefs.setString(_continueWatchingKey, json.encode(list));
  }

  Future<void> clearWatchHistory() async {
    final prefs = await _instancePrefs;
    await prefs.remove(_continueWatchingKey);
  }

  // ── FAVORIS & MA LISTE ──
  Future<bool> isFavorite(String id) async {
    final favs = await getFavorites();
    return favs.any((item) => item['id'] == id);
  }

  Future<void> toggleFavorite(Map<String, dynamic> item) async {
    final prefs = await _instancePrefs;
    final list = await getFavorites();
    final id = item['id'].toString();
    final exists = list.any((e) => e['id'] == id);

    if (exists) {
      list.removeWhere((e) => e['id'] == id);
    } else {
      list.insert(0, {
        'id': id,
        'title': item['title'] ?? 'Titre',
        'poster': item['poster'] ?? '',
        'type': item['type'] ?? 'movie',
        'rating': item['rating'],
        'year': item['year'],
        'addedAt': DateTime.now().toIso8601String(),
      });
    }
    await prefs.setString(_favoritesKey, json.encode(list));
  }

  Future<List<Map<String, dynamic>>> getFavorites() async {
    final prefs = await _instancePrefs;
    final str = prefs.getString(_favoritesKey);
    if (str == null || str.isEmpty) return [];
    try {
      final List<dynamic> decoded = json.decode(str);
      return decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) {
      return [];
    }
  }

  Future<bool> isWatchlist(String id) async {
    final list = await getWatchlist();
    return list.any((item) => item['id'] == id);
  }

  Future<void> toggleWatchlist(Map<String, dynamic> item) async {
    final prefs = await _instancePrefs;
    final list = await getWatchlist();
    final id = item['id'].toString();
    final exists = list.any((e) => e['id'] == id);

    if (exists) {
      list.removeWhere((e) => e['id'] == id);
    } else {
      list.insert(0, {
        'id': id,
        'title': item['title'] ?? 'Titre',
        'poster': item['poster'] ?? '',
        'type': item['type'] ?? 'movie',
        'rating': item['rating'],
        'year': item['year'],
        'addedAt': DateTime.now().toIso8601String(),
      });
    }
    await prefs.setString(_watchlistKey, json.encode(list));
  }

  Future<List<Map<String, dynamic>>> getWatchlist() async {
    final prefs = await _instancePrefs;
    final str = prefs.getString(_watchlistKey);
    if (str == null || str.isEmpty) return [];
    try {
      final List<dynamic> decoded = json.decode(str);
      return decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) {
      return [];
    }
  }

  // ── PLAYLISTS PERSONNALISÉES ──
  Future<List<Map<String, dynamic>>> getPlaylists() async {
    final prefs = await _instancePrefs;
    final str = prefs.getString(_playlistsKey);
    if (str == null || str.isEmpty) {
      // Playlist par défaut
      return [
        {
          'id': 'default_weekend',
          'name': 'À voir ce week-end',
          'createdAt': DateTime.now().toIso8601String(),
          'items': <Map<String, dynamic>>[],
        }
      ];
    }
    try {
      final List<dynamic> decoded = json.decode(str);
      return decoded.map((e) {
        final map = Map<String, dynamic>.from(e as Map);
        if (map['items'] != null) {
          map['items'] = (map['items'] as List)
              .map((it) => Map<String, dynamic>.from(it as Map))
              .toList();
        } else {
          map['items'] = <Map<String, dynamic>>[];
        }
        return map;
      }).toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> createPlaylist(String name) async {
    final trimmedName = name.trim();
    if (trimmedName.isEmpty) return;

    final prefs = await _instancePrefs;
    final playlists = await getPlaylists();

    final newPlaylist = {
      'id': 'pl_${DateTime.now().millisecondsSinceEpoch}',
      'name': trimmedName,
      'createdAt': DateTime.now().toIso8601String(),
      'items': <Map<String, dynamic>>[],
    };

    playlists.insert(0, newPlaylist);
    await prefs.setString(_playlistsKey, json.encode(playlists));
  }

  Future<void> deletePlaylist(String playlistId) async {
    final prefs = await _instancePrefs;
    final playlists = await getPlaylists();
    playlists.removeWhere((p) => p['id'] == playlistId);
    await prefs.setString(_playlistsKey, json.encode(playlists));
  }

  Future<void> addItemToPlaylist(String playlistId, Map<String, dynamic> item) async {
    final prefs = await _instancePrefs;
    final playlists = await getPlaylists();
    final idx = playlists.indexWhere((p) => p['id'] == playlistId);
    if (idx != -1) {
      final items = List<Map<String, dynamic>>.from(playlists[idx]['items'] as List);
      final itemId = item['id'].toString();
      items.removeWhere((it) => it['id'] == itemId);
      items.insert(0, {
        'id': itemId,
        'title': item['title'] ?? 'Titre',
        'poster': item['poster'] ?? '',
        'type': item['type'] ?? 'movie',
        'rating': item['rating'],
        'year': item['year'],
        'addedAt': DateTime.now().toIso8601String(),
      });
      playlists[idx]['items'] = items;
      await prefs.setString(_playlistsKey, json.encode(playlists));
    }
  }

  Future<void> removeItemFromPlaylist(String playlistId, String itemId) async {
    final prefs = await _instancePrefs;
    final playlists = await getPlaylists();
    final idx = playlists.indexWhere((p) => p['id'] == playlistId);
    if (idx != -1) {
      final items = List<Map<String, dynamic>>.from(playlists[idx]['items'] as List);
      items.removeWhere((it) => it['id'] == itemId);
      playlists[idx]['items'] = items;
      await prefs.setString(_playlistsKey, json.encode(playlists));
    }
  }
}
