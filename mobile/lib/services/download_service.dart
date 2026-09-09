import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/media_item.dart';

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
  final String? streamUrl;
  final String? localFilePath;
  final int totalBytes;
  int downloadedBytes;
  double progress; // 0.0 to 1.0
  String status; // 'downloading', 'completed', 'paused', 'error'
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
    this.totalBytes = 850 * 1024 * 1024, // default approx 850 MB
    this.downloadedBytes = 0,
    this.progress = 0.0,
    this.status = 'downloading',
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
        totalBytes: json['totalBytes'] ?? 850 * 1024 * 1024,
        downloadedBytes: json['downloadedBytes'] ?? 0,
        progress: (json['progress'] as num?)?.toDouble() ?? 0.0,
        status: json['status'] ?? 'completed',
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

  static const String _storageKey = 'chillers_downloads_v1';
  final List<DownloadTask> _tasks = [];
  final Map<String, Timer> _activeTimers = {};

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
          _tasks.add(DownloadTask.fromJson(item));
        }
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> _saveTasks() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = jsonEncode(_tasks.map((t) => t.toJson()).toList());
      await prefs.setString(_storageKey, raw);
    } catch (_) {}
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

  Future<DownloadTask> startDownload({
    required MediaItem item,
    EpisodeItem? episode,
    int? seasonNumber,
    String? quality = 'HD 1080p',
    String? streamUrl,
  }) async {
    final String taskId = episode != null
        ? '${item.id}_s${seasonNumber ?? 1}_e${episode.episodeNumber}'
        : '${item.id}_movie';

    // If already exists, return existing
    final existingIdx = _tasks.indexWhere((t) => t.id == taskId);
    if (existingIdx != -1) {
      final existing = _tasks[existingIdx];
      if (existing.status == 'completed') return existing;
      if (existing.status == 'downloading') return existing;
      existing.status = 'downloading';
      _simulateProgress(existing);
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
      createdAt: DateTime.now(),
      status: 'downloading',
      progress: 0.05,
    );

    _tasks.insert(0, task);
    notifyListeners();
    _saveTasks();

    _simulateProgress(task);
    return task;
  }

  void _simulateProgress(DownloadTask task) {
    _activeTimers[task.id]?.cancel();

    _activeTimers[task.id] = Timer.periodic(const Duration(milliseconds: 500), (timer) {
      if (task.status != 'downloading') {
        timer.cancel();
        return;
      }

      task.progress += 0.08;
      task.downloadedBytes = (task.totalBytes * task.progress).round();

      if (task.progress >= 1.0) {
        task.progress = 1.0;
        task.downloadedBytes = task.totalBytes;
        task.status = 'completed';
        timer.cancel();
        _activeTimers.remove(task.id);
      }

      notifyListeners();
      _saveTasks();
    });
  }

  void pauseDownload(String id) {
    final task = _tasks.firstWhere((t) => t.id == id, orElse: () => throw Exception('Not found'));
    task.status = 'paused';
    _activeTimers[id]?.cancel();
    _activeTimers.remove(id);
    notifyListeners();
    _saveTasks();
  }

  void resumeDownload(String id) {
    final task = _tasks.firstWhere((t) => t.id == id, orElse: () => throw Exception('Not found'));
    task.status = 'downloading';
    _simulateProgress(task);
    notifyListeners();
    _saveTasks();
  }

  void removeDownload(String id) {
    _activeTimers[id]?.cancel();
    _activeTimers.remove(id);
    _tasks.removeWhere((t) => t.id == id);
    notifyListeners();
    _saveTasks();
  }

  void clearAll() {
    for (final timer in _activeTimers.values) {
      timer.cancel();
    }
    _activeTimers.clear();
    _tasks.clear();
    notifyListeners();
    _saveTasks();
  }
}
