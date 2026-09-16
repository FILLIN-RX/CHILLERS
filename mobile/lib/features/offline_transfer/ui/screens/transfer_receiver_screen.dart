library;

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';
import '../../models/connection_credentials.dart';
import '../../models/transfer_enums.dart';
import '../../models/transfer_progress.dart';
import '../../models/transfer_session.dart';
import '../../services/transfer_manager.dart';
import '../widgets/scanner_widget.dart';
import '../widgets/transfer_progress_widget.dart';

/// Screen managing receiver side for scanning/NFC, downloading and saving media
class TransferReceiverScreen extends StatefulWidget {
  const TransferReceiverScreen({super.key});

  @override
  State<TransferReceiverScreen> createState() => _TransferReceiverScreenState();
}

class _TransferReceiverScreenState extends State<TransferReceiverScreen> {
  final TransferManager _transferManager = TransferManager();
  final TextEditingController _pinController = TextEditingController();

  TransferSession? _session;
  StreamSubscription<TransferProgress>? _progressSub;
  StreamSubscription<TransferState>? _statusSub;
  StreamSubscription<ConnectionCredentials>? _nfcSub;

  TransferProgress? _currentProgress;
  TransferState _currentState = TransferState.idle;

  bool _isManualEntry = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _startNfcListener();
  }

  Future<void> _startNfcListener() async {
    try {
      final nfcStream = await _transferManager.nfcService.startReception(
        onStatusChange: (status) {
          debugPrint('[TransferReceiverScreen] NFC: $status');
        },
      );
      _nfcSub = nfcStream.listen((credentials) {
        if (mounted && _session == null) {
          _onCredentialsReceived(credentials);
        }
      });
    } catch (_) {}
  }

  Future<void> _onCredentialsReceived(ConnectionCredentials credentials) async {
    setState(() {
      _errorMessage = null;
      _currentState = TransferState.awaitingConnection;
    });

    try {
      final tempDir = await getTemporaryDirectory();
      final tempPath = '${tempDir.path}/p2p_incoming_${const Uuid().v4()}.mp4';

      final session = await _transferManager.initiateReceive(
        credentials: credentials,
        destinationFilePath: tempPath,
      );

      _session = session;

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
    } catch (e) {
      if (mounted) {
        setState(() => _errorMessage = 'Erreur lors de la réception : $e');
      }
    }
  }

  @override
  void dispose() {
    _pinController.dispose();
    _progressSub?.cancel();
    _statusSub?.cancel();
    _nfcSub?.cancel();
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
          'Recevoir un Média',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: _currentState == TransferState.success || _currentState == TransferState.completed
            ? _buildSuccessView()
            : _session != null
                ? _buildTransferringView()
                : _buildPairingView(),
      ),
    );
  }

  Widget _buildPairingView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          if (_errorMessage != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: Colors.redAccent, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
          ],

          if (!_isManualEntry) ...[
            // Camera QR Scanner Container
            SizedBox(
              height: 320,
              child: ScannerWidget(
                onCredentialsScanned: _onCredentialsReceived,
              ),
            ),
            const SizedBox(height: 20),

            // Toggle to manual entry
            TextButton.icon(
              onPressed: () => setState(() => _isManualEntry = true),
              icon: const Icon(Icons.keyboard, color: Colors.white70),
              label: const Text(
                'Entrer un code à 6 chiffres manuellement',
                style: TextStyle(color: Colors.white70),
              ),
            ),
          ] else ...[
            // Manual PIN Input Form
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF191922),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              ),
              child: Column(
                children: [
                  const Text(
                    'Entrez le code PIN affiché sur l\'émetteur',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    controller: _pinController,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      letterSpacing: 8,
                      fontWeight: FontWeight.bold,
                    ),
                    decoration: InputDecoration(
                      hintText: '000000',
                      hintStyle: const TextStyle(color: Colors.white24),
                      filled: true,
                      fillColor: const Color(0xFF101015),
                      counterText: '',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFE50914),
                      minimumSize: const Size.fromHeight(48),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () {
                      if (_pinController.text.trim().length == 6) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Recherche de l\'émetteur local en cours...'),
                          ),
                        );
                      }
                    },
                    child: const Text('Rejoindre le transfert', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            TextButton.icon(
              onPressed: () => setState(() => _isManualEntry = false),
              icon: const Icon(Icons.qr_code_scanner, color: Colors.white70),
              label: const Text('Scanner un QR Code', style: TextStyle(color: Colors.white70)),
            ),
          ],

          const SizedBox(height: 24),

          // NFC Passive Listening Hint
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.04),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
            ),
            child: const Row(
              children: [
                Icon(Icons.nfc, color: Color(0xFFE50914), size: 22),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'NFC actif : Vous pouvez aussi simplement approcher votre téléphone de l\'émetteur.',
                    style: TextStyle(color: Colors.white60, fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransferringView() {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Center(
        child: TransferProgressWidget(
          progress: _currentProgress ??
              TransferProgress(
                sessionId: _session!.id,
                state: _currentState,
                progress: 0,
                transferredBytes: 0,
                totalBytes: _session?.totalBytes ?? 0,
                currentSpeed: 0,
                statusMessage: 'Connexion à l\'émetteur...',
              ),
          metadata: _session?.media,
          onPause: () => _transferManager.pauseTransfer(_session!.id),
          onResume: () => _transferManager.resumeTransfer(_session!.id),
          onCancel: () => _transferManager.cancelTransfer(_session!.id),
        ),
      ),
    );
  }

  Widget _buildSuccessView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF22C55E).withValues(alpha: 0.2),
                border: Border.all(color: const Color(0xFF22C55E), width: 3),
              ),
              child: const Icon(Icons.check_rounded, color: Color(0xFF22C55E), size: 64),
            ),
            const SizedBox(height: 24),
            const Text(
              'Média Reçu avec Succès !',
              style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              _session?.media.title ?? 'Fichier média',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white70, fontSize: 16),
            ),
            const SizedBox(height: 12),
            const Text(
              'Le média a été vérifié (SHA-256) et ajouté à votre bibliothèque de téléchargements.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white38, fontSize: 13),
            ),
            const SizedBox(height: 32),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFE50914),
                minimumSize: const Size.fromHeight(50),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              icon: const Icon(Icons.play_arrow_rounded, color: Colors.white),
              label: const Text(
                'Regarder Maintenant',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              onPressed: () {
                Navigator.of(context).pop();
              },
            ),
          ],
        ),
      ),
    );
  }
}
