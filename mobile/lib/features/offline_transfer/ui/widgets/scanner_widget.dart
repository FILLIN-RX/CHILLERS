library;

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../models/connection_credentials.dart';
import '../../services/qr_scanner.dart';

/// Scanner camera view widget with targeting reticle and auto-detection
class ScannerWidget extends StatefulWidget {
  final void Function(ConnectionCredentials credentials) onCredentialsScanned;
  final VoidCallback? onCancel;

  const ScannerWidget({
    super.key,
    required this.onCredentialsScanned,
    this.onCancel,
  });

  @override
  State<ScannerWidget> createState() => _ScannerWidgetState();
}

class _ScannerWidgetState extends State<ScannerWidget> {
  final MobileScannerController _controller = MobileScannerController();
  bool _hasDetected = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleBarcode(BarcodeCapture capture) {
    if (_hasDetected) return;

    for (final barcode in capture.barcodes) {
      final rawValue = barcode.rawValue;
      if (rawValue != null && rawValue.isNotEmpty) {
        final credentials = QRScanner.parseQRCode(rawValue);
        if (credentials != null) {
          _hasDetected = true;
          widget.onCredentialsScanned(credentials);
          break;
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: Stack(
        alignment: Alignment.center,
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _handleBarcode,
          ),

          // Dark overlay with cutout
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white24, width: 2),
              borderRadius: BorderRadius.circular(24),
            ),
          ),

          // Scan reticle
          Container(
            width: 220,
            height: 220,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE50914), width: 3),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFE50914).withValues(alpha: 0.3),
                  blurRadius: 20,
                  spreadRadius: 2,
                ),
              ],
            ),
          ),

          // Instruction label
          Positioned(
            bottom: 24,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'Pointez la caméra vers le QR Code',
                style: TextStyle(color: Colors.white, fontSize: 13),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
