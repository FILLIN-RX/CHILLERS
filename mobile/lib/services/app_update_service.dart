import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import '../config/constants.dart';
import '../config/theme.dart';

/// Information about an available app update
class AppUpdateInfo {
  final String latestVersion;
  final int latestBuildNumber;
  final String currentVersion;
  final int currentBuildNumber;
  final String apkUrl;
  final String? changelog;
  final bool hasUpdate;
  final bool forceUpdate;

  AppUpdateInfo({
    required this.latestVersion,
    required this.latestBuildNumber,
    required this.currentVersion,
    required this.currentBuildNumber,
    required this.apkUrl,
    this.changelog,
    required this.hasUpdate,
    this.forceUpdate = false,
  });
}

/// Service that checks for in-app updates and handles download/installation of APKs
class AppUpdateService {
  static final AppUpdateService _instance = AppUpdateService._internal();
  factory AppUpdateService() => _instance;
  AppUpdateService._internal();

  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 30),
  ));

  /// Checks if a new update is available on the server
  Future<AppUpdateInfo?> checkForUpdate() async {
    // In-app APK updates are only relevant on Android
    if (kIsWeb || !Platform.isAndroid) return null;

    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final currentVersion = packageInfo.version;
      final currentBuildNumber = int.tryParse(packageInfo.buildNumber) ?? 1;

      // Try primary API base and fallback to web site if needed
      final urls = [
        '${AppConstants.baseUrl}/api/app-version',
        'https://www.chillers.site/api/app-version',
      ];

      Map<String, dynamic>? data;
      for (final url in urls) {
        try {
          final res = await _dio.get(
            url,
            options: Options(
              headers: {'Accept': 'application/json'},
              validateStatus: (status) => status != null && status < 500,
            ),
          );
          if (res.statusCode == 200 && res.data != null) {
            if (res.data is Map<String, dynamic>) {
              final raw = res.data as Map<String, dynamic>;
              data = raw['data'] is Map<String, dynamic> ? raw['data'] : raw;
              break;
            }
          }
        } catch (_) {
          continue;
        }
      }

      if (data == null) return null;

      final latestVersion = (data['version'] ?? currentVersion).toString();
      final latestBuildNumber = int.tryParse(data['buildNumber']?.toString() ?? '') ?? 1;
      final apkUrl = (data['apkUrl'] ?? data['universalApkUrl'] ?? '').toString();
      final changelog = data['changelog']?.toString();
      final forceUpdate = data['forceUpdate'] == true;

      if (apkUrl.isEmpty) return null;

      final isNewer = _isVersionNewer(
        latestVersion: latestVersion,
        latestBuild: latestBuildNumber,
        currentVersion: currentVersion,
        currentBuild: currentBuildNumber,
      );

      return AppUpdateInfo(
        latestVersion: latestVersion,
        latestBuildNumber: latestBuildNumber,
        currentVersion: currentVersion,
        currentBuildNumber: currentBuildNumber,
        apkUrl: apkUrl,
        changelog: changelog,
        hasUpdate: isNewer,
        forceUpdate: forceUpdate,
      );
    } catch (e) {
      debugPrint('[AppUpdateService] Error checking for update: $e');
      return null;
    }
  }

  /// Compares semantic versions (e.g. 1.1.0 vs 1.0.0) or build numbers
  bool _isVersionNewer({
    required String latestVersion,
    required int latestBuild,
    required String currentVersion,
    required int currentBuild,
  }) {
    final latestParts = latestVersion.split('.').map((e) => int.tryParse(e) ?? 0).toList();
    final currentParts = currentVersion.split('.').map((e) => int.tryParse(e) ?? 0).toList();

    final maxLength = latestParts.length > currentParts.length ? latestParts.length : currentParts.length;
    for (int i = 0; i < maxLength; i++) {
      final l = i < latestParts.length ? latestParts[i] : 0;
      final c = i < currentParts.length ? currentParts[i] : 0;
      if (l > c) return true;
      if (l < c) return false;
    }

    return latestBuild > currentBuild;
  }

  /// Downloads the APK to temporary directory and triggers Android installer
  Future<void> downloadAndInstall({
    required String apkUrl,
    required void Function(double progress, int received, int total) onProgress,
    required void Function(String error) onError,
  }) async {
    try {
      final tempDir = await getTemporaryDirectory();
      final savePath = '${tempDir.path}/chillers_update.apk';

      final file = File(savePath);
      if (await file.exists()) {
        await file.delete();
      }

      await _dio.download(
        apkUrl,
        savePath,
        onReceiveProgress: (received, total) {
          if (total > 0) {
            final progress = (received / total).clamp(0.0, 1.0);
            onProgress(progress, received, total);
          }
        },
      );

      // Trigger open file which Android routes to the Package Installer
      final result = await OpenFilex.open(
        savePath,
        type: 'application/vnd.android.package-archive',
      );

      if (result.type != ResultType.done) {
        onError('Impossible d\'ouvrir l\'installateur: ${result.message}');
      }
    } catch (e) {
      debugPrint('[AppUpdateService] Download/install error: $e');
      onError('Erreur lors du téléchargement de la mise à jour: $e');
    }
  }

  /// Helper to prompt the user with a customized modal dialog if an update is available
  Future<void> showUpdateDialogIfAvailable(
    BuildContext context, {
    bool checkSilently = true,
  }) async {
    final updateInfo = await checkForUpdate();
    if (!context.mounted) return;

    if (updateInfo == null || !updateInfo.hasUpdate) {
      if (!checkSilently) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Votre application est à jour !'),
            backgroundColor: Colors.green,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return;
    }

    showDialog(
      context: context,
      barrierDismissible: !updateInfo.forceUpdate,
      builder: (ctx) => _AppUpdateDialog(updateInfo: updateInfo),
    );
  }
}

class _AppUpdateDialog extends StatefulWidget {
  final AppUpdateInfo updateInfo;

  const _AppUpdateDialog({required this.updateInfo});

  @override
  State<_AppUpdateDialog> createState() => _AppUpdateDialogState();
}

class _AppUpdateDialogState extends State<_AppUpdateDialog> {
  bool _isDownloading = false;
  double _progress = 0.0;
  String _statusText = '';
  String? _errorMessage;

  void _startDownload() {
    setState(() {
      _isDownloading = true;
      _errorMessage = null;
      _statusText = 'Téléchargement de la mise à jour...';
    });

    AppUpdateService().downloadAndInstall(
      apkUrl: widget.updateInfo.apkUrl,
      onProgress: (progress, received, total) {
        if (!mounted) return;
        final receivedMb = (received / (1024 * 1024)).toStringAsFixed(1);
        final totalMb = (total / (1024 * 1024)).toStringAsFixed(1);
        setState(() {
          _progress = progress;
          _statusText = 'Téléchargement: $receivedMb Mo / $totalMb Mo (${(progress * 100).toInt()}%)';
        });
      },
      onError: (err) {
        if (!mounted) return;
        setState(() {
          _isDownloading = false;
          _errorMessage = err;
        });
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !widget.updateInfo.forceUpdate && !_isDownloading,
      child: Dialog(
        backgroundColor: AppTheme.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppTheme.border),
        ),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.system_update_rounded,
                      color: AppTheme.primary,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Mise à jour disponible',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'v${widget.updateInfo.currentVersion} ➔ v${widget.updateInfo.latestVersion}',
                          style: TextStyle(
                            color: Colors.grey.shade400,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (widget.updateInfo.changelog != null &&
                  widget.updateInfo.changelog!.isNotEmpty) ...[
                const Text(
                  'Nouveautés :',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.background,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.border),
                  ),
                  child: Text(
                    widget.updateInfo.changelog!,
                    style: TextStyle(
                      color: Colors.grey.shade300,
                      fontSize: 12,
                      height: 1.4,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              if (_isDownloading) ...[
                Text(
                  _statusText,
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LinearProgressIndicator(
                    value: _progress,
                    backgroundColor: Colors.white10,
                    color: AppTheme.primary,
                    minHeight: 8,
                  ),
                ),
                const SizedBox(height: 16),
              ],
              if (_errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    _errorMessage!,
                    style: const TextStyle(color: Colors.redAccent, fontSize: 12),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  if (!widget.updateInfo.forceUpdate && !_isDownloading)
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: Text(
                        'Plus tard',
                        style: TextStyle(color: Colors.grey.shade400),
                      ),
                    ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: _isDownloading ? null : _startDownload,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                    ),
                    child: Text(_isDownloading ? 'Installation...' : 'Installer maintenant'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
