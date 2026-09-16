library;

import 'package:flutter/material.dart';
import '../../../../models/media_item.dart';
import '../screens/transfer_sender_screen.dart';

/// Reusable action button to initiate offline P2P sharing for a downloaded media item
class ShareOfflineButton extends StatelessWidget {
  final MediaItem media;
  final bool isCompact;

  const ShareOfflineButton({
    super.key,
    required this.media,
    this.isCompact = false,
  });

  @override
  Widget build(BuildContext context) {
    if (isCompact) {
      return IconButton(
        icon: const Icon(Icons.share_rounded, color: Colors.white),
        tooltip: 'Partager hors ligne (P2P)',
        onPressed: () => _openSenderScreen(context),
      );
    }

    return ElevatedButton.icon(
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFFE50914),
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        elevation: 4,
      ),
      icon: const Icon(Icons.wifi_tethering_rounded, size: 20),
      label: const Text(
        'Partager Hors Ligne',
        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
      ),
      onPressed: () => _openSenderScreen(context),
    );
  }

  void _openSenderScreen(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => TransferSenderScreen(media: media),
      ),
    );
  }
}
