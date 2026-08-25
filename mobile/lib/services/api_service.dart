import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/constants.dart';
import '../models/media_item.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  final String _base = AppConstants.baseUrl;

  Future<List<MediaItem>> getTrendingMovies() async {
    try {
      final response = await http.get(
        Uri.parse('$_base/api/movies/trending'),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = data is List ? data : (data['data'] ?? data['results'] ?? []);
        return (list as List).map((e) => MediaItem.fromJson(e)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<List<MediaItem>> getLatestSeries() async {
    try {
      final response = await http.get(
        Uri.parse('$_base/api/series/latest'),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = data is List ? data : (data['data'] ?? data['results'] ?? []);
        return (list as List).map((e) => MediaItem.fromJson({...e, 'type': 'serie'})).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<List<MediaItem>> searchMedia(String query) async {
    if (query.trim().isEmpty) return [];
    try {
      final response = await http.get(
        Uri.parse('$_base/api/search?q=${Uri.encodeComponent(query)}'),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final list = data is List ? data : (data['data'] ?? data['results'] ?? []);
        return (list as List).map((e) => MediaItem.fromJson(e)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }
}
