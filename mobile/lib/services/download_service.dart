import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:path_provider/path_provider.dart';
import 'package:dio/dio.dart';
import '../models/media_item.dart';
import 'api_service.dart';
import 'native_bridge.dart';

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

  /// Renseigné uniquement en mode export : URI MediaStore (Android 10+) ou chemin
  /// absolu (Android 9-) du fichier publié dans le dossier Téléchargements public.
  String? publicUri;
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
    this.publicUri,
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
        'publicUri': publicUri,
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
        publicUri: json['publicUri'],
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
  final Map<String, RandomAccessFile> _openFiles = {};

  /// Un `cancel()` de CancelToken est ambigu : il sert aussi bien à mettre en pause
  /// qu'à supprimer. On note donc l'intention pour distinguer 'paused' de 'error'.
  final Set<String> _pauseRequested = {};

  /// Throttles : sans eux, chaque chunk réseau déclenche un notifyListeners()
  /// (donc un setState de tout l'écran) et une écriture SharedPreferences.
  DateTime _lastNotify = DateTime.now();
  DateTime _lastProgressPersist = DateTime.now();
  static const Duration _notifyInterval = Duration(milliseconds: 250);
  static const Duration _progressPersistInterval = Duration(seconds: 2);

  /// État du service de premier plan qui maintient le process vivant en arrière-plan.
  bool _foregroundRunning = false;
  bool _notificationPermissionChecked = false;
  DateTime _lastForegroundUpdate = DateTime.now();
  static const Duration _foregroundInterval = Duration(seconds: 1);

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
  List<DownloadTask> get inAppDownloads => _tasks.where((t) => !t.isExternal && t.status == 'completed').toList();
  List<DownloadTask> get externalDownloads => _tasks.where((t) => t.isExternal && t.status == 'completed').toList();
  
  /// Obtenir le mode de téléchargement recommandé selon l'abonnement
  String getDownloadModeDescription(bool isPremium) {
    if (isPremium) {
      return 'Mode VIP : Téléchargements dans votre dossier Téléchargements, accessibles depuis n\'importe quelle app';
    } else {
      return 'Mode Gratuit : Téléchargements disponibles uniquement dans l\'app CHILLERS';
    }
  }

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

  /// Émet une mise à jour UI, en limitant la fréquence. `force` est utilisé pour les
  /// changements de statut (pause, fin, erreur) qui doivent être reflétés immédiatement.
  void _emitProgress({bool force = false}) {
    final now = DateTime.now();
    final shouldNotify = force || now.difference(_lastNotify) >= _notifyInterval;
    final shouldPersist = force || now.difference(_lastProgressPersist) >= _progressPersistInterval;

    if (shouldPersist) {
      _lastProgressPersist = now;
      _saveTasks();
    }
    if (shouldNotify) {
      _lastNotify = now;
      notifyListeners();
    }
    _syncForeground();
  }

  /// Aligne le service de premier plan (et sa notification) sur l'état courant :
  /// démarrage au premier transfert actif, mise à jour de la progression, arrêt
  /// dès qu'il n'y a plus rien à télécharger.
  ///
  /// C'est ce service qui empêche Android de tuer le process : l'isolate Dart
  /// continue alors de télécharger app en arrière-plan et écran éteint.
  void _syncForeground() {
    final active = _tasks.where((t) => t.status == 'downloading').toList();

    if (active.isEmpty) {
      if (_foregroundRunning) {
        _foregroundRunning = false;
        unawaited(NativeBridge.instance.stopForeground());
      }
      return;
    }

    final task = active.first;
    final title = active.length > 1
        ? '${active.length} téléchargements en cours'
        : (task.episodeNumber != null
            ? '${task.title} S${task.seasonNumber ?? 1}E${task.episodeNumber}'
            : task.title);
    final progress = (task.progress * 100).round().clamp(0, 100);

    if (!_foregroundRunning) {
      _foregroundRunning = true;
      _lastForegroundUpdate = DateTime.now();
      unawaited(_startForeground(title));
      return;
    }

    final now = DateTime.now();
    if (now.difference(_lastForegroundUpdate) >= _foregroundInterval) {
      _lastForegroundUpdate = now;
      unawaited(NativeBridge.instance.updateProgress(title: title, progress: progress));
    }
  }

  Future<void> _startForeground(String title) async {
    // Android 13+ exige POST_NOTIFICATIONS pour afficher la notification du service.
    // On la demande une seule fois par session, sans jamais bloquer le transfert.
    if (!_notificationPermissionChecked) {
      _notificationPermissionChecked = true;
      await NativeBridge.instance.ensureNotificationPermission();
    }
    await NativeBridge.instance.startForeground(title: title);
  }

  /// Publie la copie privée dans le dossier Téléchargements public, puis supprime
  /// la copie privée : conserver les deux doublerait l'espace occupé par un épisode.
  Future<void> _publishExport(DownloadTask task, String sourcePath, String displayName) async {
    final published = await NativeBridge.instance.publishToDownloads(
      path: sourcePath,
      displayName: displayName,
    );

    if (published == null) {
      throw Exception(
        "Le fichier a été téléchargé mais n'a pas pu être placé dans le dossier Téléchargements de l'appareil.",
      );
    }

    task.publicUri = published;
    try {
      final f = File(sourcePath);
      if (f.existsSync()) await f.delete();
    } catch (_) {}
    task.localFilePath = null;
  }

  /// Valide le fichier obtenu, l'exporte le cas échéant, et marque la tâche terminée.
  Future<void> _finalizeDownload(
    DownloadTask task,
    String savePath,
    String filename, {
    RandomAccessFile? openFile,
  }) async {
    final fileSize = openFile != null ? await openFile.length() : await File(savePath).length();
    task.downloadedBytes = fileSize;

    if (task.totalBytes > 0 && fileSize < task.totalBytes) {
      throw Exception(
        'Téléchargement incomplet ($fileSize / ${task.totalBytes} octets) : le serveur a interrompu le flux.',
      );
    }

    if (fileSize <= 100 * 1024) {
      // Trop petit pour être une vidéo : on nettoie pour ne pas laisser un fragment
      // inutilisable qui fausserait une reprise ultérieure.
      _openFiles.remove(task.id);
      if (openFile != null) {
        try {
          await openFile.close();
        } catch (_) {}
      }
      await _deleteIfTiny(savePath, force: true);
      throw Exception(
        'La source vidéo distante est un embed web protégé et ne permet pas le téléchargement direct en MP4.',
      );
    }

    task.progress = 1.0;
    task.totalBytes = fileSize;
    task.downloadedBytes = fileSize;
    task.errorMessage = null;

    if (task.isExternal) {
      await _publishExport(task, savePath, filename);
    }

    task.status = 'completed';
    debugPrint('[DownloadService] Téléchargement vidéo validé avec succès ($fileSize octets)');

    unawaited(NativeBridge.instance.notifyCompleted(
      title: task.episodeNumber != null
          ? '${task.title} S${task.seasonNumber ?? 1}E${task.episodeNumber}'
          : task.title,
      uri: task.publicUri,
    ));
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

  DownloadTask? _taskById(String id) {
    for (final t in _tasks) {
      if (t.id == id) return t;
    }
    return null;
  }

  /// Démarre un téléchargement avec détection automatique du mode selon l'abonnement.
  /// - Users FREE: téléchargement IN-APP (sandboxé, visible uniquement dans l'app)
  /// - Users VIP: téléchargement EXTERNE (dossier Téléchargements public)
  Future<DownloadTask> startDownload({
    required MediaItem item,
    EpisodeItem? episode,
    int? seasonNumber,
    String? quality = 'HD 1080p',
    String? streamUrl,
    bool? isExternal, // null = auto-détection selon abonnement
    required bool isPremium, // Statut d'abonnement de l'utilisateur
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
      _pauseRequested.remove(taskId);
      existing.status = 'downloading';
      existing.errorMessage = null;
      // localFilePath est déjà renseigné : _executeDownload reprendra à l'offset
      // du fichier partiel s'il en reste un.
      _executeDownload(existing);
      _emitProgress(force: true);
      return existing;
    }

    // Auto-détection du mode selon l'abonnement si non spécifié
    final bool shouldBeExternal = isExternal ?? isPremium;

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
      isExternal: shouldBeExternal,
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

  /// Supprime un fichier de téléchargement trop petit pour être une vidéo (< 100 Ko).
  /// Sans `force`, un fichier plus gros est conservé afin de permettre la reprise.
  Future<void> _deleteIfTiny(String? path, {bool force = false}) async {
    if (path == null) return;
    try {
      final f = File(path);
      if (!f.existsSync()) return;
      if (force || await f.length() < 100 * 1024) {
        await f.delete();
      }
    } catch (_) {}
  }

  /// Détermine la taille totale du fichier à partir des en-têtes de réponse.
  /// `Content-Range: bytes 1000-9999/10000` donne le total réel ; un simple
  /// `Content-Length` sur une réponse 206 ne couvre que le fragment demandé.
  int _resolveTotalBytes(Headers headers, int resumeOffset) {
    final contentRange = headers.value('content-range');
    if (contentRange != null) {
      final slash = contentRange.lastIndexOf('/');
      if (slash != -1) {
        final parsed = int.tryParse(contentRange.substring(slash + 1).trim());
        if (parsed != null && parsed > 0) return parsed;
      }
    }
    final contentLength = int.tryParse(headers.value('content-length') ?? '');
    if (contentLength != null && contentLength > 0) return contentLength + resumeOffset;
    return 0;
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
        Directory extDir;
        if (Platform.isAndroid) {
          try {
            extDir = (await getExternalStorageDirectory()) ?? (await getApplicationDocumentsDirectory());
          } catch (_) {
            extDir = await getApplicationDocumentsDirectory();
          }
        } else {
          extDir = (await getDownloadsDirectory()) ?? (await getApplicationDocumentsDirectory());
        }
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

      final file = File(savePath);

      // 3. Reprise : on demande au serveur de repartir de la fin du fichier partiel.
      final existingBytes = await file.exists() ? await file.length() : 0;

      final response = await _dio.get<ResponseBody>(
        targetUrl,
        cancelToken: cancelToken,
        options: Options(
          responseType: ResponseType.stream,
          followRedirects: true,
          headers: {
            if (existingBytes > 0) 'Range': 'bytes=$existingBytes-',
          },
          validateStatus: (status) => status != null && (status < 400 || status == 416),
        ),
      );

      // 416 « Range Not Satisfiable » : le fichier local couvre déjà toute la
      // ressource. Cela arrive quand un export a échoué après un téléchargement
      // complet — on finalise sans retélécharger quoi que ce soit.
      if (response.statusCode == 416) {
        debugPrint('[DownloadService] Fichier local déjà complet ($existingBytes o), finalisation directe');
        await _finalizeDownload(task, savePath, filename);
        return;
      }

      // Un serveur qui ignore le Range répond 200 avec le fichier entier : repartir
      // de zéro est alors impératif, sinon le flux complet serait collé au fragment.
      final isPartial = response.statusCode == 206;
      final resumeOffset = isPartial ? existingBytes : 0;

      final total = _resolveTotalBytes(response.headers, resumeOffset);

      task.totalBytes = total;
      task.downloadedBytes = resumeOffset;
      task.progress = total > 0 ? (resumeOffset / total).clamp(0.0, 1.0) : 0.0;
      task.errorMessage = null;
      _emitProgress(force: true);

      debugPrint('[DownloadService] → $savePath depuis $targetUrl '
          '(reprise à $resumeOffset o, total $total o, partial=$isPartial)');

      final openFile = await file.open(mode: resumeOffset > 0 ? FileMode.append : FileMode.write);
      _openFiles[task.id] = openFile;

      // 4. Copie du flux vers le disque. pause()/resume() autour de chaque écriture :
      // l'écriture disque est asynchrone et doit finir avant le chunk suivant, sinon
      // les écritures se chevauchent et le fichier est corrompu.
      final completer = Completer<void>();
      var received = resumeOffset;

      // `sub` est référencé depuis son propre callback : la déclaration doit donc
      // être séparée de l'assignation (`late final`), sinon Dart rejette
      // l'auto-référence dans l'initialiseur.
      late final StreamSubscription<List<int>> sub;
      sub = response.data!.stream.listen(
        (List<int> chunk) {
          sub.pause();
          openFile
              .writeFrom(chunk)
              .then((_) {
                received += chunk.length;
                task.downloadedBytes = received;
                if (task.totalBytes > 0) {
                  task.progress = (received / task.totalBytes).clamp(0.0, 1.0);
                }
                _emitProgress();
                if (cancelToken.isCancelled) {
                  if (!completer.isCompleted) completer.complete();
                } else {
                  sub.resume();
                }
              })
              .catchError((Object e) {
                if (!completer.isCompleted) completer.completeError(e);
              });
        },
        onDone: () {
          if (!completer.isCompleted) completer.complete();
        },
        onError: (Object e, StackTrace st) {
          if (!completer.isCompleted) completer.completeError(e);
        },
        cancelOnError: true,
      );

      try {
        await completer.future;
      } finally {
        await sub.cancel();
      }

      // 5. Pause ou suppression demandée : on garde le fichier partiel pour la reprise.
      if (cancelToken.isCancelled) {
        if (_pauseRequested.remove(task.id)) {
          task.status = 'paused';
          debugPrint('[DownloadService] Téléchargement en pause à ${task.downloadedBytes} o (fichier conservé)');
        } else {
          task.status = 'canceled';
        }
        _emitProgress(force: true);
        return;
      }

      // 6. Vérification, export éventuel et finalisation
      await _finalizeDownload(task, savePath, filename, openFile: openFile);
    } on DioException catch (e) {
      if (CancelToken.isCancel(e) || _pauseRequested.remove(task.id)) {
        debugPrint('[DownloadService] Téléchargement mis en pause à ${task.downloadedBytes} o (fichier conservé)');
        task.status = 'paused';
      } else {
        debugPrint('[DownloadService] Erreur Dio: ${e.message}');
        task.status = 'error';
        task.errorMessage = 'Erreur réseau lors du téléchargement : ${e.message}';
      }
    } catch (e) {
      if (_pauseRequested.remove(task.id)) {
        task.status = 'paused';
      } else {
        debugPrint('[DownloadService] Erreur générale: $e');
        task.status = 'error';
        task.errorMessage = e.toString().replaceAll('Exception:', '').trim();
        // Un fragment de quelques octets n'a aucune valeur et fausserait une reprise
        // ultérieure : on le supprime. Au-delà, on le conserve pour pouvoir reprendre.
        await _deleteIfTiny(task.localFilePath);
      }
    } finally {
      final open = _openFiles.remove(task.id);
      if (open != null) {
        try {
          await open.close();
        } catch (_) {}
      }
      _cancelTokens.remove(task.id);
      _emitProgress(force: true);
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
    final task = _taskById(id);
    if (task == null || task.status != 'downloading') return;

    // L'intention est enregistrée AVANT le cancel : le catch de _executeDownload
    // la consulte pour distinguer une pause utilisateur d'une vraie erreur réseau.
    // Le fichier partiel est conservé, c'est ce qui rend la reprise possible.
    _pauseRequested.add(id);
    task.status = 'paused';
    _cancelTokens[id]?.cancel('pause');
    _emitProgress(force: true);
  }

  void resumeDownload(String id) {
    final task = _taskById(id);
    if (task == null || task.status == 'downloading') return;

    _pauseRequested.remove(id);
    task.status = 'downloading';
    task.errorMessage = null;
    _emitProgress(force: true);
    // _executeDownload recalcule l'offset depuis la taille du fichier partiel :
    // la reprise se fait par en-tête Range, pas depuis zéro.
    _executeDownload(task);
  }

  void removeDownload(String id) {
    _pauseRequested.remove(id);
    _cancelTokens[id]?.cancel('deleted');

    final task = _taskById(id);
    final path = task?.localFilePath;
    if (path != null) {
      try {
        final f = File(path);
        if (f.existsSync()) f.deleteSync();
      } catch (_) {}
    }
    final publicUri = task?.publicUri;
    if (publicUri != null) {
      unawaited(NativeBridge.instance.deletePublished(publicUri));
    }
    _tasks.removeWhere((t) => t.id == id);
    _emitProgress(force: true);
  }

  void clearAll() {
    _pauseRequested.clear();
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
      if (task.publicUri != null) {
        unawaited(NativeBridge.instance.deletePublished(task.publicUri!));
      }
    }

    _tasks.clear();
    _emitProgress(force: true);
  }
}
