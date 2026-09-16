library;

import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';
import '../../../models/media_item.dart';
import '../../../services/download_service.dart';
import '../models/media_metadata.dart';
import 'integrity_checker.dart';

/// Adapter facilitating interaction between offline P2P transfer and CHILLERS DownloadService
class MediaLibraryAdapter {
  final DownloadService _downloadService = DownloadService();
  final IntegrityChecker _integrityChecker = IntegrityChecker();

  /// Gets local file path for a downloaded media
  Future<String?> getMediaFilePath(String mediaId) async {
    final task = _downloadService.completedTasks.cast<DownloadTask?>().firstWhere(
          (t) => t?.mediaId == mediaId,
          orElse: () => null,
        );

    if (task?.localFilePath != null) {
      final file = File(task!.localFilePath!);
      if (await file.exists()) {
        return task.localFilePath;
      }
    }
    return null;
  }

  /// Extracts [MediaMetadata] from a downloaded [MediaItem]
  Future<MediaMetadata?> createMetadataFromDownloadedMedia(MediaItem media) async {
    final filePath = await getMediaFilePath(media.id);
    if (filePath == null) return null;

    final file = File(filePath);
    final fileSize = await file.length();
    final sha256Hash = await _integrityChecker.calculateFileHash(filePath);

    final releaseYear = int.tryParse(media.year ?? '');

    return MediaMetadata(
      title: media.title,
      mediaType: media.type,
      fileSize: fileSize,
      sha256: sha256Hash,
      poster: media.poster,
      synopsis: media.description,
      duration: media.runtime != null ? media.runtime! * 60 : null,
      rating: media.rating,
      genre: media.genres?.join(', '),
      year: releaseYear,
    );
  }

  /// Saves received media file into the CHILLERS downloads library
  Future<DownloadTask> saveReceivedMedia({
    required String tempFilePath,
    required MediaMetadata metadata,
  }) async {
    final tempFile = File(tempFilePath);
    if (!await tempFile.exists()) {
      throw FileSystemException('Received temporary file does not exist', tempFilePath);
    }

    final appDocDir = await getApplicationDocumentsDirectory();
    final downloadsDir = Directory('${appDocDir.path}/downloads');
    if (!await downloadsDir.exists()) {
      await downloadsDir.create(recursive: true);
    }

    const extension = 'mp4';
    final destinationName = 'p2p_${const Uuid().v4()}.$extension';
    final permanentPath = '${downloadsDir.path}/$destinationName';

    // Move file to permanent downloads directory
    await tempFile.copy(permanentPath);
    try {
      await tempFile.delete();
    } catch (_) {}

    final task = DownloadTask(
      id: const Uuid().v4(),
      mediaId: const Uuid().v4(),
      title: metadata.title,
      poster: metadata.poster,
      type: metadata.mediaType,
      quality: 'HD (P2P Transfer)',
      localFilePath: permanentPath,
      totalBytes: metadata.fileSize,
      downloadedBytes: metadata.fileSize,
      progress: 1.0,
      status: 'completed',
      createdAt: DateTime.now(),
    );

    // Persist to downloads database
    await _downloadService.addCompletedTask(task);
    debugPrint('[MediaLibraryAdapter] Received media saved: ${task.title} at $permanentPath');

    return task;
  }
}
