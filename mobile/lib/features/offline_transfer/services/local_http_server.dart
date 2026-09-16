library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;
import '../models/media_metadata.dart';

/// Ephemeral HTTP server running on the sender device to serve media chunks and metadata
class LocalHTTPServer {
  HttpServer? _server;
  String? _filePath;
  MediaMetadata? _metadata;
  int _port = 8080;

  /// Gets the currently active port
  int get port => _port;

  /// Gets whether server is currently running
  bool get isRunning => _server != null;

  /// Starts the HTTP server on an available port between [minPort] and [maxPort]
  Future<int> start({
    required String filePath,
    required MediaMetadata metadata,
    int minPort = 8000,
    int maxPort = 9000,
  }) async {
    await stop();

    _filePath = filePath;
    _metadata = metadata;

    final handler = const Pipeline()
        .addMiddleware(_corsMiddleware())
        .addMiddleware(logRequests())
        .addHandler(_handleRequest);

    for (int p = minPort; p <= maxPort; p++) {
      try {
        _server = await shelf_io.serve(handler, InternetAddress.anyIPv4, p);
        _port = _server!.port;
        debugPrint('[LocalHTTPServer] Running on port $_port for file $filePath');
        return _port;
      } catch (e) {
        // Port in use, try next
      }
    }

    // Fallback: bind to port 0 (OS assigned)
    _server = await shelf_io.serve(handler, InternetAddress.anyIPv4, 0);
    _port = _server!.port;
    debugPrint('[LocalHTTPServer] Running on OS-assigned port $_port');
    return _port;
  }

  /// CORS Middleware to allow requests from any client
  static Middleware _corsMiddleware() {
    return (Handler innerHandler) {
      return (Request request) async {
        if (request.method == 'OPTIONS') {
          return Response.ok('', headers: _corsHeaders);
        }
        final response = await innerHandler(request);
        return response.change(headers: _corsHeaders);
      };
    };
  }

  static const Map<String, String> _corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, Content-Type, Range, Accept',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
  };

  /// Main router handler
  Future<Response> _handleRequest(Request request) async {
    final path = request.url.path;

    if (path == 'ping') {
      return Response.ok(
        jsonEncode({'status': 'ok', 'app': 'chillers_p2p'}),
        headers: {'Content-Type': 'application/json'},
      );
    }

    if (path == 'metadata') {
      if (_metadata == null) {
        return Response.notFound('Metadata not available');
      }
      return Response.ok(
        jsonEncode(_metadata!.toJson()),
        headers: {'Content-Type': 'application/json'},
      );
    }

    if (path == 'file') {
      if (_filePath == null) {
        return Response.notFound('No file configured');
      }
      return _serveFile(request);
    }

    return Response.notFound('Endpoint not found');
  }

  /// Serves file with support for chunked range requests (HTTP 206)
  Future<Response> _serveFile(Request request) async {
    final file = File(_filePath!);
    if (!await file.exists()) {
      return Response.notFound('Media file not found on disk');
    }

    final fileSize = await file.length();
    final rangeHeader = request.headers['range'];

    // Check query params for explicit offset and length: ?offset=0&length=1048576
    final queryOffset = int.tryParse(request.url.queryParameters['offset'] ?? '');
    final queryLength = int.tryParse(request.url.queryParameters['length'] ?? '');

    int start = 0;
    int end = fileSize - 1;

    if (queryOffset != null) {
      start = queryOffset.clamp(0, fileSize - 1);
      if (queryLength != null && queryLength > 0) {
        end = (start + queryLength - 1).clamp(start, fileSize - 1);
      }
    } else if (rangeHeader != null && rangeHeader.startsWith('bytes=')) {
      final parts = rangeHeader.substring(6).split('-');
      start = int.tryParse(parts[0]) ?? 0;
      if (parts.length > 1 && parts[1].isNotEmpty) {
        end = int.tryParse(parts[1]) ?? (fileSize - 1);
      }
      if (start >= fileSize || end >= fileSize || start > end) {
        return Response(
          416,
          headers: {'Content-Range': 'bytes */$fileSize'},
          body: 'Requested Range Not Satisfiable',
        );
      }
    }

    final chunkLength = end - start + 1;
    final stream = file.openRead(start, end + 1);

    final isPartial = (start > 0 || end < fileSize - 1);
    final statusCode = isPartial ? 206 : 200;

    final headers = {
      'Content-Type': 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkLength.toString(),
      if (isPartial) 'Content-Range': 'bytes $start-$end/$fileSize',
    };

    return Response(
      statusCode,
      body: stream,
      headers: headers,
    );
  }

  /// Stops the HTTP server and releases port
  Future<void> stop() async {
    if (_server != null) {
      try {
        await _server!.close(force: true);
      } catch (e) {
        debugPrint('[LocalHTTPServer] Error closing server: $e');
      }
      _server = null;
      _filePath = null;
      _metadata = null;
    }
  }
}
