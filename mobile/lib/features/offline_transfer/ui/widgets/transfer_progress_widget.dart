library;

import 'package:flutter/material.dart';
import '../../models/media_metadata.dart';
import '../../models/transfer_enums.dart';
import '../../models/transfer_progress.dart';

/// Interactive progress card for active transfers showing live speed, ETA and status
class TransferProgressWidget extends StatelessWidget {
  final TransferProgress progress;
  final MediaMetadata? metadata;
  final VoidCallback? onPause;
  final VoidCallback? onResume;
  final VoidCallback? onCancel;

  const TransferProgressWidget({
    super.key,
    required this.progress,
    this.metadata,
    this.onPause,
    this.onResume,
    this.onCancel,
  });

  Color _getStatusColor(TransferState state) {
    switch (state) {
      case TransferState.completed:
      case TransferState.success:
        return const Color(0xFF22C55E); // Green
      case TransferState.error:
        return const Color(0xFFEF4444); // Red
      case TransferState.interrupted:
        return const Color(0xFFF59E0B); // Amber
      case TransferState.verifying:
      case TransferState.integrating:
        return const Color(0xFF3B82F6); // Blue
      default:
        return const Color(0xFFE50914); // Netflix red
    }
  }

  String _getStateLabel(TransferState state) {
    switch (state) {
      case TransferState.idle:
        return 'En attente';
      case TransferState.pairingMode:
        return 'Appairage en cours...';
      case TransferState.awaitingConnection:
        return 'Connexion Wi-Fi Direct...';
      case TransferState.connected:
        return 'Connecté';
      case TransferState.transferring:
        return 'Transfert en cours';
      case TransferState.interrupted:
        return 'Transfert en pause';
      case TransferState.verifying:
        return 'Vérification intégrité SHA-256';
      case TransferState.integrating:
        return 'Intégration à la bibliothèque';
      case TransferState.completed:
      case TransferState.success:
        return 'Transfert terminé avec succès !';
      case TransferState.cancelled:
        return 'Transfert annulé';
      case TransferState.error:
        return 'Erreur de transfert';
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _getStatusColor(progress.state);
    final percentage = (progress.progress * 100).toInt();

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF16161E),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Media title & Status Badge
          Row(
            children: [
              Expanded(
                child: Text(
                  metadata?.title ?? 'Média en transfert',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: statusColor.withValues(alpha: 0.4)),
                ),
                child: Text(
                  _getStateLabel(progress.state),
                  style: TextStyle(
                    color: statusColor,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 18),

          // Progress Bar
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: progress.progress > 0 ? progress.progress : null,
              minHeight: 10,
              backgroundColor: Colors.white.withValues(alpha: 0.08),
              valueColor: AlwaysStoppedAnimation<Color>(statusColor),
            ),
          ),

          const SizedBox(height: 14),

          // Metrics: Transferred bytes / Speed / ETA
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '$percentage% (${progress.formattedBytesTransferred})',
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (progress.state == TransferState.transferring)
                Text(
                  '${progress.formattedSpeed} • ${progress.formattedTimeRemaining}',
                  style: const TextStyle(
                    color: Colors.white54,
                    fontSize: 12,
                  ),
                ),
            ],
          ),

          if (progress.statusMessage != null && progress.statusMessage!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              progress.statusMessage!,
              style: TextStyle(
                color: progress.state == TransferState.error ? Colors.redAccent : Colors.white38,
                fontSize: 12,
              ),
            ),
          ],

          // Action Controls
          if (progress.state == TransferState.transferring ||
              progress.state == TransferState.interrupted) ...[
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (progress.state == TransferState.transferring && onPause != null)
                  TextButton.icon(
                    onPressed: onPause,
                    icon: const Icon(Icons.pause, size: 18, color: Colors.white70),
                    label: const Text('Pause', style: TextStyle(color: Colors.white70)),
                  ),
                if (progress.state == TransferState.interrupted && onResume != null)
                  TextButton.icon(
                    onPressed: onResume,
                    icon: const Icon(Icons.play_arrow, size: 18, color: Colors.greenAccent),
                    label: const Text('Reprendre', style: TextStyle(color: Colors.greenAccent)),
                  ),
                const SizedBox(width: 8),
                if (onCancel != null)
                  TextButton.icon(
                    onPressed: onCancel,
                    icon: const Icon(Icons.close, size: 18, color: Colors.redAccent),
                    label: const Text('Annuler', style: TextStyle(color: Colors.redAccent)),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
