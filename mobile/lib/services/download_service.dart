import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:path_provider/path_provider.dart';
import 'package:dio/dio.dart';
import '../models/media_item.dart';
import 'api_service.dart';

class DownloadTask {
  final String id;
  final String mediaId;
  final String title;
  final String? poster;
  final String? type; // movie, serie, anime
  final String? seasonNumber;
  final String? episodeNumber;
  final String? episodeTitle;
  final String? quality;
  String? streamUrl;
  String? localFilePath;
  int totalBytes;
  int downloadedBytes;
  double progress; // 0.0 to 1.0
  String status; // 'downloading', 'completed', 'paused', 'error', 'canceled'
  final bool isExternal;
  String? errorMessage;
  final DateTime createdAt;

  DownloadTask({
    required this.id,
    required this.mediaId,
    required this.title,
    this.poster,
    this.type,
    this.seasonNumber,
    this.episodeNumber,
    this.episodeTitle,
    this.quality = 'HD 1080p',
    this.streamUrl,
    this.localFilePath,
    this.totalBytes = 0,
    this.downloadedBytes = 0,
    this.progress = 0.0,
    this.status = 'downloading',
    this.isExternal = false,
    this.errorMessage,
    required this.createdAt,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'mediaId': mediaId,
        'title': title,
        'poster': poster,
        'type': type,
        'seasonNumber': seasonNumber,
        'episodeNumber': episodeNumber,
        'episodeTitle': episodeTitle,
        'quality': quality,
        'streamUrl': streamUrl,
        'localFilePath': localFilePath,
        'totalBytes': totalBytes,
        'downloadedBytes': downloadedBytes,
        'progress': progress,
        'status': status,
        'isExternal': isExternal,
        'errorMessage': errorMessage,
        'createdAt': createdAt.toIso8601String(),
      };

  factory DownloadTask.fromJson(Map<String, dynamic> json) => DownloadTask(
        id: json['id'] ?? '',
        mediaId: json['mediaId'] ?? '',
        title: json['title'] ?? '',
        poster: json['poster'],
        type: json['type'],
        seasonNumber: json['seasonNumber']?.toString(),
        episodeNumber: json['episodeNumber']?.toString(),
        episodeTitle: json['episodeTitle'],
        quality: json['quality'] ?? 'HD 1080p',
        streamUrl: json['streamUrl'],
        localFilePath: json['localFilePath'],
        totalBytes: json['totalBytes'] ?? 0,
        downloadedBytes: json['downloadedBytes'] ?? 0,
        progress: (json['progress'] as num?)?.toDouble() ?? 0.0,
        status: json['status'] ?? 'completed',
        isExternal: json['isExternal'] ?? false,
        errorMessage: json['errorMessage'],
        createdAt: json['createdAt'] != null
            ? DateTime.tryParse(json['createdAt']) ?? DateTime.now()
            : DateTime.now(),
      );
}

class DownloadService extends ChangeNotifier {
  static final DownloadService _instance = DownloadService._internal();
  factory DownloadService() => _instance;
  DownloadService._internal() {
    _loadTasks();
  }

  static const String _storageKey = 'chillers_downloads_v2';
  final List<DownloadTask> _tasks = [];
  final Map<String, CancelToken> _cancelTokens = {};
  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 30),
    receiveTimeout: const Duration(minutes: 60),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 CHILLERS/1.0',
    },
  ));

  List<DownloadTask> get tasks => List.unmodifiable(_tasks);
  List<DownloadTask> get activeTasks => _tasks.where((t) => t.status == 'downloading').toList();
  List<DownloadTask> get completedTasks => _tasks.where((t) => t.status == 'completed').toList();

  Future<void> _loadTasks() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_storageKey);
      if (raw != null && raw.isNotEmpty) {
        final List<dynamic> decoded = jsonDecode(raw);
        _tasks.clear();
        for (final item in decoded) {
          final task = DownloadTask.fromJson(item);
          // If task was downloading when app closed, set to paused
          if (task.status == 'downloading') {
            task.status = 'paused';
          }
          _tasks.add(task);
        }
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[DownloadService] Erreur chargement tâches: $e');
    }
  }

  Future<void> _saveTasks() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = jsonEncode(_tasks.map((t) => t.toJson()).toList());
      await prefs.setString(_storageKey, raw);
    } catch (e) {
      debugPrint('[DownloadService] Erreur sauvegarde tâches: $e');
    }
  }

  bool isDownloaded(String mediaId, {int? season, int? episode}) {
    return _tasks.any((t) =>
        t.mediaId == mediaId &&
        t.status == 'completed' &&
        (season == null || t.seasonNumber == season.toString()) &&
        (episode == null || t.episodeNumber == episode.toString()));
  }

  bool isDownloading(String mediaId, {int? season, int? episode}) {
    return _tasks.any((t) =>
        t.mediaId == mediaId &&
        t.status == 'downloading' &&
        (season == null || t.seasonNumber == season.toString()) &&
        (episode == null || t.episodeNumber == episode.toString()));
  }

  DownloadTask? getTask(String mediaId, {int? season, int? episode}) {
    try {
      return _tasks.firstWhere((t) =>
          t.mediaId == mediaId &&
          (season == null || t.seasonNumber == season.toString()) &&
          (episode == null || t.episodeNumber == episode.toString()));
    } catch (_) {
      return null;
    }
  }

  Future<DownloadTask> startDownload({
    required MediaItem item,
    EpisodeItem? episode,
    int? seasonNumber,
    String? quality = 'HD 1080p',
    String? streamUrl,
    bool isExternal = false,
  }) async {
    final String taskId = episode != null
        ? '${item.id}_s${seasonNumber ?? 1}_e${episode.episodeNumber}'
        : '${item.id}_movie';

    // If task already exists and is active, return it
    final existingIdx = _tasks.indexWhere((t) => t.id == taskId);
    if (existingIdx != -1) {
      final existing = _tasks[existingIdx];
      if (existing.status == 'completed') return existing;
      if (existing.status == 'downloading') return existing;
      existing.status = 'downloading';
      _executeDownload(existing);
      notifyListeners();
      _saveTasks();
      return existing;
    }

    final task = DownloadTask(
      id: taskId,
      mediaId: item.id,
      title: item.title,
      poster: item.poster,
      type: item.type,
      seasonNumber: seasonNumber?.toString(),
      episodeNumber: episode?.episodeNumber.toString(),
      episodeTitle: episode?.episode,
      quality: quality ?? 'HD 1080p',
      streamUrl: streamUrl ?? item.streamUrl,
      isExternal: isExternal,
      createdAt: DateTime.now(),
      status: 'downloading',
      progress: 0.02,
    );

    _tasks.insert(0, task);
    notifyListeners();
    _saveTasks();

    _executeDownload(task);
    return task;
  }

  Future<void> _executeDownload(DownloadTask task) async {
    final cancelToken = CancelToken();
    _cancelTokens[task.id] = cancelToken;

    try {
      // 1. Résolution de l'URL réelle de flux si non fournie ou si embed
      String? targetUrl = task.streamUrl;
      if (targetUrl == null || targetUrl.isEmpty || _isWebEmbed(targetUrl)) {
        final api = ApiService();
        targetUrl = await api.resolveDownloadUrl(
          tmdbId: task.mediaId,
          title: task.title,
          type: task.type ?? 'movie',
          season: task.seasonNumber != null ? int.tryParse(task.seasonNumber!) : null,
          episode: task.episodeNumber != null ? int.tryParse(task.episodeNumber!) : null,
        );
      }

      if (targetUrl == null || targetUrl.isEmpty) {
        throw Exception('Aucun flux vidéo direct disponible pour le téléchargement.');
      }

      task.streamUrl = targetUrl;

      // 2. Détermination du dossier de destination
      Directory targetDir;
      if (task.isExternal) {
        // Mode Export Stockage Utilisateur
        final extDir = await getExternalStorageDirectory() ?? (await getDownloadsDirectory()) ?? (await getApplicationDocumentsDirectory());
        targetDir = Directory('${extDir.path}/CHILLERS');
      } else {
        // Mode In-App Hors-Ligne (Sandboxé)
        final appDir = await getApplicationDocumentsDirectory();
        targetDir = Directory('${appDir.path}/chillers_offline');
      }

      if (!await targetDir.exists()) {
        await targetDir.create(recursive: true);
      }

      final safeName = task.title.replaceAll(RegExp(r'[^a-zA-Z0-9_\-]'), '_');
      final filename = task.episodeNumber != null
          ? '${safeName}_S${task.seasonNumber ?? 1}E${task.episodeNumber}.mp4'
          : '$safeName.mp4';

      final savePath = '${targetDir.path}/$filename';
      task.localFilePath = savePath;

      // 3. Téléchargement réel via Dio
      debugPrint('[DownloadService] Début du téléchargement vers $savePath depuis $targetUrl');

      await _dio.download(
        targetUrl,
        savePath,
        cancelToken: cancelToken,
        deleteOnError: true,
        onReceiveProgress: (received, total) {
          if (cancelToken.isCancelled) return;
          task.downloadedBytes = received;
          if (total > 0) {
            task.totalBytes = total;
            task.progress = (received / total).clamp(0.0, 1.0);
          } else {
            // Si le serveur ne renvoie pas Content-Length, estimation continue
            task.progress = (received / (500 * 1024 * 1024)).clamp(0.05, 0.98);
          }
          notifyListeners();
        },
      );

      // 4. Vérification et finalisation
      final savedFile = File(savePath);
      final fileSize = await savedFile.exists() ? await savedFile.length() : 0;

      if (fileSize > 100 * 1024) {
        task.status = 'completed';
        task.progress = 1.0;
        task.totalBytes = fileSize;
        task.downloadedBytes = fileSize;
        task.errorMessage = null;
        debugPrint('[DownloadService] Téléchargement vidéo validé avec succès ($fileSize octets)');
      } else {
        if (await savedFile.exists()) {
          try {
            await savedFile.delete();
          } catch (_) {}
        }
        throw Exception('La source vidéo distante est un embed web protégé et ne permet pas le téléchargement direct en MP4.');
      }
    } on DioException catch (e) {
      if (CancelToken.isCancel(e)) {
        debugPrint('[DownloadService] Téléchargement mis en pause/annulé');
        return;
      }
      debugPrint('[DownloadService] Erreur Dio: ${e.message}');
      task.status = 'error';
      task.errorMessage = 'Erreur réseau lors du téléchargement : ${e.message}';
    } catch (e) {
      debugPrint('[DownloadService] Erreur générale: $e');
      task.status = 'error';
      task.errorMessage = e.toString().replaceAll('Exception:', '').trim();
    } finally {
      _cancelTokens.remove(task.id);
      notifyListeners();
      _saveTasks();
    }
  }

  bool _isWebEmbed(String url) {
    final lower = url.toLowerCase();
    return lower.contains('vidlink.pro') ||
        lower.contains('vidsrc') ||
        lower.contains('/embed') ||
        lower.contains('dood') ||
        lower.contains('uqload') ||
        lower.contains('animekai');
  }

  void pauseDownload(String id) {
    _cancelTokens[id]?.cancel('pause');
    _cancelTokens.remove(id);

    try {
      final task = _tasks.firstWhere((t) => t.id == id);
      task.status = 'paused';
      notifyListeners();
      _saveTasks();
    } catch (_) {}
  }

  void resumeDownload(String id) {
    try {
      final task = _tasks.firstWhere((t) => t.id == id);
      task.status = 'downloading';
      task.errorMessage = null;
      notifyListeners();
      _saveTasks();
      _executeDownload(task);
    } catch (_) {}
  }

  void removeDownload(String id) {
    _cancelTokens[id]?.cancel('deleted');
    _cancelTokens.remove(id);

    try {
      final task = _tasks.firstWhere((t) => t.id == id);
      if (task.localFilePath != null) {
        final f = File(task.localFilePath!);
        if (f.existsSync()) {
          f.deleteSync();
        }
      }
      _tasks.removeWhere((t) => t.id == id);
      notifyListeners();
      _saveTasks();
    } catch (_) {}
  }

  void clearAll() {
    for (final token in _cancelTokens.values) {
      token.cancel('cleared');
    }
    _cancelTokens.clear();

    for (final task in _tasks) {
      if (task.localFilePath != null) {
        try {
          final f = File(task.localFilePath!);
          if (f.existsSync()) f.deleteSync();
        } catch (_) {}
      }
    }

    _tasks.clear();
    notifyListeners();
    _saveTasks();
  }
}
