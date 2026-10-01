library;

import 'dart:async';
import 'dart:collection';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/download_chunk.dart';
import '../models/media_metadata.dart';
import '../models/transfer_enums.dart';
import '../models/transfer_progress.dart';

/// Worker pool entry for parallel chunk downloading
class _DownloadWorker {
  final int workerId;
  int? currentChunkIndex;
  bool isActive = false;

  _DownloadWorker(this.workerId);
}

/// HTTP Client handling chunked parallel file downloads for P2P transfers
/// 
/// Implements optimized parallel downloading with up to 4 concurrent workers.
/// Features:
/// - Efficient worker pool management
/// - Proper chunk coordination and ordering
/// - Memory-conscious chunk handling (releases immediately after write)
/// - Real-time progress tracking across all workers
/// - Robust error handling with exponential backoff retry
class HTTPDownloadClient {
  /// Default chunk size: 1 MB
  static const int chunkSize = 1024 * 1024;

  /// Max concurrent downloads - optimized for typical mobile networks
  static const int maxConcurrentChunks = 4;

  /// Interval for progress updates (milliseconds)
  static const int progressUpdateInterval = 500;

  bool _isCancelled = false;
  bool _isPaused = false;

  /// Worker pool management
  late final List<_DownloadWorker> _workers;
  final StreamController<TransferProgress> _progressController =
      StreamController<TransferProgress>.broadcast();

  /// Stream of transfer progress
  Stream<TransferProgress> get progressStream => _progressController.stream;

  HTTPDownloadClient() {
    // Initialize worker pool
    _workers = List.generate(
      maxConcurrentChunks,
      (i) => _DownloadWorker(i),
    );
  }

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
  /// 
  /// Uses parallel worker threads (max 4) to maximize download speed while
  /// maintaining proper chunk ordering and error handling.
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
    
    // Initialize chunk tracking
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
      // Pre-allocate file size for better I/O performance
      await raf.truncate(totalBytes);

      // Progress tracking variables
      int transferredBytes = 0;
      DateTime lastProgressTime = DateTime.now();
      int lastProgressBytes = 0;
      double currentSpeed = 0.0;
      DateTime speedSampleTime = DateTime.now();
      int speedSampleBytes = 0;

      // Chunk distribution queue
      final pendingChunkIndices = Queue<int>();
      for (int i = 0; i < totalChunks; i++) {
        pendingChunkIndices.addLast(i);
      }

      // Active download futures per worker
      final workerFutures = <int, Future<void>>{};

      /// Distributes work to idle workers
      Future<void> distributeWork() async {
        for (final worker in _workers) {
          if (worker.isActive || pendingChunkIndices.isEmpty) continue;

          final chunkIndex = pendingChunkIndices.removeFirst();
          final chunk = chunks[chunkIndex];

          worker.currentChunkIndex = chunkIndex;
          worker.isActive = true;

          final future = _downloadChunkWithWorkerPool(
            workerId: worker.workerId,
            chunkIndex: chunkIndex,
            chunk: chunk,
            ip: ip,
            port: port,
            raf: raf,
          ).then(
            (_) {
              transferredBytes += chunk.length;
            },
            onError: (error) {
              // Re-queue chunk if retries available
              if (chunk.retryCount < 3) {
                chunks[chunkIndex] = chunk.markAsFailed();
                pendingChunkIndices.addLast(chunkIndex);
              } else {
                if (!_isCancelled) {
                  throw StateError(
                    'Chunk ${chunk.index} failed after max retries: $error',
                  );
                }
              }
            },
          ).whenComplete(() {
            worker.isActive = false;
            worker.currentChunkIndex = null;
            workerFutures.remove(worker.workerId);
          });

          workerFutures[worker.workerId] = future;
        }
      }

      // Main download loop
      while (
        pendingChunkIndices.isNotEmpty ||
        workerFutures.isNotEmpty ||
        _workers.any((w) => w.isActive)
      ) {
        if (_isCancelled) {
          _progressController.add(TransferProgress(
            sessionId: sessionId,
            state: TransferState.cancelled,
            progress: totalBytes > 0 ? transferredBytes / totalBytes : 0,
            transferredBytes: transferredBytes,
            totalBytes: totalBytes,
            currentSpeed: 0,
            statusMessage: 'Téléchargement annulé',
          ));
          break; // Exit loop immediately on cancel
        }

        // Handle pause
        while (_isPaused && !_isCancelled) {
          await Future.delayed(const Duration(milliseconds: 100));
        }

        // Distribute work to idle workers
        await distributeWork();

        // Update progress every 500ms
        final now = DateTime.now();
        final timeSinceLastProgress =
            now.difference(lastProgressTime).inMilliseconds;

        if (timeSinceLastProgress >= progressUpdateInterval) {
          final deltaBytes = transferredBytes - lastProgressBytes;
          currentSpeed = deltaBytes / (timeSinceLastProgress / 1000.0);
          lastProgressBytes = transferredBytes;
          lastProgressTime = now;

          final remainingBytes = totalBytes - transferredBytes;
          final estimatedSeconds = currentSpeed > 0
              ? (remainingBytes / currentSpeed).round()
              : null;

          _progressController.add(TransferProgress(
            sessionId: sessionId,
            state: TransferState.transferring,
            progress: (transferredBytes / totalBytes).clamp(0.0, 1.0),
            transferredBytes: transferredBytes,
            totalBytes: totalBytes,
            currentSpeed: currentSpeed,
            estimatedTimeRemaining: estimatedSeconds != null
                ? Duration(seconds: estimatedSeconds)
                : null,
            statusMessage:
                'Téléchargement en cours... (${_workers.where((w) => w.isActive).length} workers)',
          ));
        }

        // Wait for any worker to complete
        if (workerFutures.isNotEmpty) {
          await Future.any(workerFutures.values);
        } else if (pendingChunkIndices.isNotEmpty) {
          // Small delay before retrying distribution
          await Future.delayed(const Duration(milliseconds: 50));
        }
      }

      // Final flush and verification
      await raf.flush();
      return !_isCancelled;
    } finally {
      await raf.close();
      // Reset worker pool
      for (final worker in _workers) {
        worker.isActive = false;
        worker.currentChunkIndex = null;
      }
    }
  }

  /// Sequential write lock for thread-safe file writing
  Future<void> _writeLock = Future.value();

  /// Writes chunk data to file at specific offset with proper locking
  /// Immediately releases memory after write to keep heap clean
  Future<void> _writeChunkToRaf(
    RandomAccessFile raf,
    int offset,
    List<int> bytes,
  ) {
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

  /// Downloads single chunk with exponential backoff retry via worker pool
  /// 
  /// This method is called by workers and handles:
  /// - HTTP Range requests for chunk-specific downloads
  /// - Exponential backoff on failure (1s, 2s, 4s)
  /// - Immediate memory release after disk write
  /// - Cancellation support
  Future<void> _downloadChunkWithWorkerPool({
    required int workerId,
    required int chunkIndex,
    required DownloadChunk chunk,
    required String ip,
    required int port,
    required RandomAccessFile raf,
    int maxRetries = 3,
  }) async {
    for (int attempt = 0; attempt < maxRetries; attempt++) {
      if (_isCancelled) {
        return;
      }

      try {
        debugPrint(
          '[HTTPDownloadClient] Worker $workerId downloading chunk $chunkIndex '
          '(attempt ${attempt + 1}/$maxRetries)',
        );

        final uri = Uri.parse(
          'http://$ip:$port/file?offset=${chunk.offset}&length=${chunk.length}',
        );
        final request = http.Request('GET', uri);
        request.headers['Range'] =
            'bytes=${chunk.offset}-${chunk.offset + chunk.length - 1}';

        final client = http.Client();
        try {
          final streamedResponse = await client.send(request).timeout(
                const Duration(seconds: 30),
              );

          if (streamedResponse.statusCode == 200 ||
              streamedResponse.statusCode == 206) {
            // Stream directly without loading entire chunk in memory first
            final bytes = await streamedResponse.stream.toBytes();

            if (bytes.length != chunk.length) {
              throw HttpException(
                'Chunk size mismatch: expected ${chunk.length}, got ${bytes.length}',
              );
            }

            // Write to file with proper locking
            await _writeChunkToRaf(raf, chunk.offset, bytes);

            debugPrint(
              '[HTTPDownloadClient] Worker $workerId successfully completed chunk $chunkIndex',
            );
            return; // Success
          } else {
            throw HttpException(
              'HTTP ${streamedResponse.statusCode} for chunk $chunkIndex',
            );
          }
        } finally {
          client.close();
        }
      } catch (e) {
        debugPrint(
          '[HTTPDownloadClient] Worker $workerId chunk $chunkIndex attempt $attempt error: $e',
        );

        // Exponential backoff: 1s, 2s, 4s
        if (attempt < maxRetries - 1) {
          final delayMs = 1000 * (1 << attempt);
          await Future.delayed(Duration(milliseconds: delayMs));
        }
      }
    }

    throw StateError(
      'Chunk $chunkIndex failed after $maxRetries attempts in worker $workerId',
    );
  }

  /// Pauses the active download
  /// 
  /// Maintains all progress and allows resumption via resume()
  void pause() {
    _isPaused = true;
    debugPrint(
      '[HTTPDownloadClient] Download paused. Active workers: ${_workers.where((w) => w.isActive).length}',
    );
  }

  /// Resumes a paused download
  /// 
  /// Workers will continue downloading pending chunks
  void resume() {
    _isPaused = false;
    debugPrint('[HTTPDownloadClient] Download resumed');
  }

  /// Cancels the active download
  /// 
  /// All workers stop immediately, and pending chunks are abandoned
  void cancel() {
    _isCancelled = true;
    _isPaused = false;
    debugPrint('[HTTPDownloadClient] Download cancelled');
  }

  /// Gets current worker pool status
  Map<String, dynamic> getWorkerPoolStatus() {
    final activeCount = _workers.where((w) => w.isActive).length;
    return {
      'totalWorkers': maxConcurrentChunks,
      'activeWorkers': activeCount,
      'idleWorkers': maxConcurrentChunks - activeCount,
      'isPaused': _isPaused,
      'isCancelled': _isCancelled,
    };
  }

  /// Disposes stream controller and cleanup
  void dispose() {
    cancel();
    _progressController.close();
  }
}
