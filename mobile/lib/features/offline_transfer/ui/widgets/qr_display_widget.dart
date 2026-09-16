library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../models/connection_credentials.dart';

/// Modern card widget displaying QR Code and 6-digit PIN code for pairing
class QRDisplayWidget extends StatelessWidget {
  final ConnectionCredentials credentials;
  final String? title;

  const QRDisplayWidget({
    super.key,
    required this.credentials,
    this.title,
  });

  @override
  Widget build(BuildContext context) {
    final manualCode = credentials.generateManualCode();
    final qrData = credentials.toQRData();

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (title != null) ...[
          Text(
            title!,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 16),
        ],

        // QR Code Card with glassmorphic container
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.3),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
              BoxShadow(
                color: const Color(0xFFE50914).withValues(alpha: 0.2),
                blurRadius: 30,
                spreadRadius: 2,
              ),
            ],
          ),
          child: QrImageView(
            data: qrData,
            version: QrVersions.auto,
            size: 200.0,
            backgroundColor: Colors.white,
            eyeStyle: const QrEyeStyle(
              eyeShape: QrEyeShape.square,
              color: Color(0xFF0F0F14),
            ),
            dataModuleStyle: const QrDataModuleStyle(
              dataModuleShape: QrDataModuleShape.square,
              color: Color(0xFF0F0F14),
            ),
          ),
        ),

        const SizedBox(height: 20),

        // Manual 6-digit PIN code display
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFF1E1E26),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.pin, color: Color(0xFFE50914), size: 20),
              const SizedBox(width: 8),
              Text(
                'Code PIN : ',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.6),
                  fontSize: 14,
                ),
              ),
              Text(
                manualCode,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 2,
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.copy, color: Colors.white70, size: 18),
                splashRadius: 20,
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: manualCode));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Code copié dans le presse-papiers'),
                      duration: Duration(seconds: 2),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}
