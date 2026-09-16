library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/download_chunk.dart';
import '../models/media_metadata.dart';
import '../models/transfer_enums.dart';
import '../models/transfer_progress.dart';

/// HTTP Client handling chunked parallel file downloads for P2P transfers
class HTTPDownloadClient {
  /// Default chunk size: 1 MB
  static const int chunkSize = 1024 * 1024;

  /// Max concurrent downloads
  static const int maxConcurrentChunks = 4;

  bool _isCancelled = false;
  bool _isPaused = false;

  final StreamController<TransferProgress> _progressController =
      StreamController<TransferProgress>.broadcast();

  /// Stream of transfer progress
  Stream<TransferProgress> get progressStream => _progressController.stream;

  /// Fetches media metadata from sender device
  Future<MediaMetadata> fetchMetadata(String ip, int port) async {
    final uri = Uri.parse('http://$ip:$port/metadata');
    final response = await http.get(uri).timeout(const Duration(seconds: 5));

    if (response.statusCode != 200) {
      throw HttpException('Failed to fetch metadata (status ${response.statusCode})');
    }

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return MediaMetadata.fromJson(json);
  }

  /// Downloads file from [ip]:[port] saving to [destinationPath]
  Future<bool> downloadFile({
    required String sessionId,
    required String ip,
    required int port,
    required MediaMetadata metadata,
    required String destinationPath,
  }) async {
    _isCancelled = false;
    _isPaused = false;

    final destFile = File(destinationPath);
    if (!await destFile.parent.exists()) {
      await destFile.parent.create(recursive: true);
    }

    final totalBytes = metadata.fileSize;
    final totalChunks = (totalBytes / chunkSize).ceil();
    final chunks = List.generate(totalChunks, (i) {
      final offset = i * chunkSize;
      final length = (offset + chunkSize > totalBytes)
          ? totalBytes - offset
          : chunkSize;
      return DownloadChunk(
        index: i,
        offset: offset,
        length: length,
      );
    });

    final raf = await destFile.open(mode: FileMode.write);
    try {
      // Pre-allocate file size
      await raf.truncate(totalBytes);

      int transferredBytes = 0;
      DateTime lastSampleTime = DateTime.now();
      int lastSampleBytes = 0;
      double currentSpeed = 0.0;

      // Download queue execution
      final pendingIndices = List<int>.generate(totalChunks, (i) => i);
      final activeFutures = <Future<void>>[];

      while (pendingIndices.isNotEmpty || activeFutures.isNotEmpty) {
        if (_isCancelled) {
          _progressController.add(TransferProgress(
            sessionId: sessionId,
            state: TransferState.cancelled,
            progress: transferredBytes / totalBytes,
            transferredBytes: transferredBytes,
            totalBytes: totalBytes,
            currentSpeed: 0,
            statusMessage: 'Téléchargement annulé',
          ));
          return false;
        }

        while (_isPaused) {
          await Future.delayed(const Duration(milliseconds: 200));
          if (_isCancelled) return false;
        }

        while (pendingIndices.isNotEmpty && activeFutures.length < maxConcurrentChunks) {
          final chunkIndex = pendingIndices.removeAt(0);
          final chunk = chunks[chunkIndex];

          final downloadFuture = _downloadSingleChunkWithRetry(
            ip: ip,
            port: port,
            chunk: chunk,
            raf: raf,
          ).then((success) {
            if (success) {
              transferredBytes += chunk.length;

              final now = DateTime.now();
              final elapsedMs = now.difference(lastSampleTime).inMilliseconds;
              if (elapsedMs >= 500) {
                final deltaBytes = transferredBytes - lastSampleBytes;
                currentSpeed = (deltaBytes / (elapsedMs / 1000.0));
                lastSampleBytes = transferredBytes;
                lastSampleTime = now;
              }

              final remainingBytes = totalBytes - transferredBytes;
              final estSeconds = currentSpeed > 0
                  ? (remainingBytes / currentSpeed).round()
                  : null;

              _progressController.add(TransferProgress(
                sessionId: sessionId,
                state: TransferState.transferring,
                progress: (transferredBytes / totalBytes).clamp(0.0, 1.0),
                transferredBytes: transferredBytes,
                totalBytes: totalBytes,
                currentSpeed: currentSpeed,
                estimatedTimeRemaining:
                    estSeconds != null ? Duration(seconds: estSeconds) : null,
                statusMessage: 'Téléchargement en cours...',
              ));
            } else {
              // Re-queue chunk if failed and not exceeded max retry
              if (chunk.retryCount < 3) {
                chunks[chunkIndex] = chunk.markAsFailed();
                pendingIndices.add(chunkIndex);
              } else {
                throw StateError('Chunk ${chunk.index} failed after max retries');
              }
            }
          });

          activeFutures.add(downloadFuture);
          downloadFuture.whenComplete(() => activeFutures.remove(downloadFuture));
        }

        if (activeFutures.isNotEmpty) {
          await Future.any(activeFutures);
        }
      }

      await raf.flush();
      return true;
    } finally {
      await raf.close();
    }
  }

  Future<void> _writeLock = Future.value();

  Future<void> _writeChunkToRaf(RandomAccessFile raf, int offset, List<int> bytes) {
    final completer = Completer<void>();
    _writeLock = _writeLock.then((_) async {
      try {
        await raf.setPosition(offset);
        await raf.writeFrom(bytes);
        completer.complete();
      } catch (e, st) {
        completer.completeError(e, st);
      }
    });
    return completer.future;
  }

  /// Downloads a single chunk with exponential backoff retry
  Future<bool> _downloadSingleChunkWithRetry({
    required String ip,
    required int port,
    required DownloadChunk chunk,
    required RandomAccessFile raf,
    int maxRetries = 3,
  }) async {
    for (int attempt = 0; attempt < maxRetries; attempt++) {
      if (_isCancelled) return false;

      try {
        final uri = Uri.parse('http://$ip:$port/file?offset=${chunk.offset}&length=${chunk.length}');
        final request = http.Request('GET', uri);
        request.headers['Range'] = 'bytes=${chunk.offset}-${chunk.offset + chunk.length - 1}';

        final client = http.Client();
        try {
          final streamedResponse = await client.send(request).timeout(const Duration(seconds: 15));
          if (streamedResponse.statusCode == 200 || streamedResponse.statusCode == 206) {
            final bytes = await streamedResponse.stream.toBytes();
            if (bytes.length == chunk.length) {
              // Write chunk to specific position in the destination file safely
              await _writeChunkToRaf(raf, chunk.offset, bytes);
              return true;
            }
          }
        } finally {
          client.close();
        }
      } catch (e) {
        debugPrint('[HTTPDownloadClient] Chunk ${chunk.index} attempt $attempt error: $e');
      }

      // Backoff delay: 1s, 2s, 4s
      await Future.delayed(Duration(milliseconds: 1000 * (1 << attempt)));
    }
    return false;
  }

  /// Pauses the active download
  void pause() {
    _isPaused = true;
  }

  /// Resumes a paused download
  void resume() {
    _isPaused = false;
  }

  /// Cancels the active download
  void cancel() {
    _isCancelled = true;
    _isPaused = false;
  }

  /// Disposes stream controller
  void dispose() {
    cancel();
    _progressController.close();
  }
}
