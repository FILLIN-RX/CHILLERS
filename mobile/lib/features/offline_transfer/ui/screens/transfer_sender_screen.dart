library;

import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../models/media_item.dart';
import '../../models/transfer_enums.dart';
import '../../models/transfer_progress.dart';
import '../../models/transfer_session.dart';
import '../../services/transfer_manager.dart';
import '../widgets/qr_display_widget.dart';
import '../widgets/transfer_progress_widget.dart';

/// Screen managing the sender side of offline P2P transfer
class TransferSenderScreen extends StatefulWidget {
  final MediaItem media;

  const TransferSenderScreen({super.key, required this.media});

  @override
  State<TransferSenderScreen> createState() => _TransferSenderScreenState();
}

class _TransferSenderScreenState extends State<TransferSenderScreen> {
  final TransferManager _transferManager = TransferManager();

  TransferSession? _session;
  StreamSubscription<TransferProgress>? _progressSub;
  StreamSubscription<TransferState>? _statusSub;

  TransferProgress? _currentProgress;
  TransferState _currentState = TransferState.idle;

  bool _isLoading = true;
  String? _errorMessage;
  int _selectedTabIndex = 0; // 0: QR Code, 1: NFC

  @override
  void initState() {
    super.initState();
    _startSharing();
  }

  Future<void> _startSharing() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final localPath = await _transferManager.mediaLibrary.getMediaFilePath(widget.media.id);
      if (localPath == null) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Ce média n\'est pas encore disponible en téléchargement local.';
        });
        return;
      }

      final metadata = await _transferManager.mediaLibrary.createMetadataFromDownloadedMedia(widget.media);
      if (metadata == null) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Impossible de lire les métadonnées du fichier.';
        });
        return;
      }

      final session = await _transferManager.initiateShare(
        metadata: metadata,
        localFilePath: localPath,
      );

      _session = session;
      _currentState = session.state;

      _progressSub = _transferManager.progressStream(session.id).listen((p) {
        if (mounted) {
          setState(() {
            _currentProgress = p;
            _currentState = p.state;
          });
        }
      });

      _statusSub = _transferManager.statusStream(session.id).listen((s) {
        if (mounted) {
          setState(() => _currentState = s);
        }
      });

      setState(() => _isLoading = false);
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Erreur lors de l\'initialisation : $e';
        });
      }
    }
  }

  @override
  void dispose() {
    _progressSub?.cancel();
    _statusSub?.cancel();
    if (_session != null) {
      _transferManager.cancelTransfer(_session!.id);
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F0F14),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Partage Hors Ligne',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: _isLoading
            ? const Center(
                child: CircularProgressIndicator(color: Color(0xFFE50914)),
              )
            : _errorMessage != null
                ? _buildErrorView()
                : _buildContent(),
      ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded, color: Colors.redAccent, size: 64),
            const SizedBox(height: 16),
            Text(
              _errorMessage!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 16),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFE50914),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Fermer', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    final isTransferring = _currentState == TransferState.transferring ||
        _currentState == TransferState.interrupted ||
        _currentState == TransferState.verifying ||
        _currentState == TransferState.completed ||
        _currentState == TransferState.success;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Media Summary Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF191922),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
            ),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: widget.media.poster != null
                      ? Image.network(
                          widget.media.poster!,
                          width: 50,
                          height: 70,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) => Container(
                            width: 50,
                            height: 70,
                            color: Colors.white10,
                            child: const Icon(Icons.movie, color: Colors.white30),
                          ),
                        )
                      : Container(
                          width: 50,
                          height: 70,
                          color: Colors.white10,
                          child: const Icon(Icons.movie, color: Colors.white30),
                        ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.media.title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _session?.media.formattedFileSize ?? 'Prêt pour transfert',
                        style: const TextStyle(color: Colors.white54, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          if (isTransferring && _currentProgress != null) ...[
            TransferProgressWidget(
              progress: _currentProgress!,
              metadata: _session?.media,
              onPause: () => _transferManager.pauseTransfer(_session!.id),
              onResume: () => _transferManager.resumeTransfer(_session!.id),
              onCancel: () => _transferManager.cancelTransfer(_session!.id),
            ),
          ] else ...[
            // Tab Selector: QR Code vs NFC
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFF1E1E26),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _selectedTabIndex = 0),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: _selectedTabIndex == 0
                              ? const Color(0xFFE50914)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.qr_code_scanner, size: 18, color: Colors.white),
                            SizedBox(width: 8),
                            Text('QR Code', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _selectedTabIndex = 1),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: _selectedTabIndex == 1
                              ? const Color(0xFFE50914)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.nfc, size: 18, color: Colors.white),
                            SizedBox(width: 8),
                            Text('NFC Tap', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            if (_selectedTabIndex == 0 && _session != null) ...[
              QRDisplayWidget(
                credentials: _session!.credentials,
                title: 'Faites scanner ce QR Code par l\'appareil récepteur',
              ),
            ] else ...[
              // NFC Tap Visual Animation Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(32),
                decoration: BoxDecoration(
                  color: const Color(0xFF191922),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFFE50914).withValues(alpha: 0.15),
                        border: Border.all(color: const Color(0xFFE50914), width: 2),
                      ),
                      child: const Icon(
                        Icons.nfc,
                        color: Color(0xFFE50914),
                        size: 54,
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'Approchez les deux téléphones',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Placez le dos de votre appareil contre celui du récepteur pour transmettre les identifiants automatiquement.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white54, fontSize: 13, height: 1.4),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}
