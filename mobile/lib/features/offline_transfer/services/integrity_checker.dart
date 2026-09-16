library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';

/// Service responsible for calculating and verifying SHA-256 hashes of files
class IntegrityChecker {
  /// Chunk size used for calculating hash (1 MB)
  static const int chunkSize = 1024 * 1024;

  /// Calculates SHA-256 hash of a file at the given [filePath]
  /// Streams file in chunks to prevent high memory usage.
  Future<String> calculateFileHash(String filePath) async {
    final file = File(filePath);
    if (!await file.exists()) {
      throw FileSystemException('File not found for hash calculation', filePath);
    }

    final digest = await sha256.bind(file.openRead()).first;
    return digest.toString();
  }

  /// Calculates SHA-256 hash with real-time progress reporting (0.0 to 1.0)
  Future<String> calculateFileHashWithProgress(
    String filePath, {
    void Function(double progress)? onProgress,
  }) async {
    final file = File(filePath);
    if (!await file.exists()) {
      throw FileSystemException('File not found for hash calculation', filePath);
    }

    final totalBytes = await file.length();
    if (totalBytes == 0) {
      return sha256.convert([]).toString();
    }

    Digest? digest;
    final output = ChunkedConversionSink<Digest>.withCallback((digests) {
      if (digests.isNotEmpty) {
        digest = digests.single;
      }
    });
    final input = sha256.startChunkedConversion(output);

    int processedBytes = 0;
    final stream = file.openRead();

    await for (final chunk in stream) {
      input.add(chunk);
      processedBytes += chunk.length;
      if (onProgress != null) {
        final progress = (processedBytes / totalBytes).clamp(0.0, 1.0);
        onProgress(progress);
      }
    }
    input.close();

    return digest?.toString() ?? sha256.convert([]).toString();
  }

  /// Verifies if a file matches the expected SHA-256 hash (case-insensitive)
  Future<bool> verifyFileIntegrity(
    String filePath,
    String expectedHash, {
    void Function(double progress)? onProgress,
  }) async {
    try {
      final actualHash = await calculateFileHashWithProgress(
        filePath,
        onProgress: onProgress,
      );
      return actualHash.toLowerCase() == expectedHash.toLowerCase();
    } catch (_) {
      return false;
    }
  }
}
