import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/cast_service.dart';
import '../services/native_bridge.dart';

class CastModal extends StatefulWidget {
  final String videoUrl;
  final String title;

  const CastModal({
    super.key,
    required this.videoUrl,
    required this.title,
  });

  static Future<void> show(
    BuildContext context, {
    required String videoUrl,
    required String title,
  }) {
    return showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => CastModal(
        videoUrl: videoUrl,
        title: title,
      ),
    );
  }

  @override
  State<CastModal> createState() => _CastModalState();
}

class _CastModalState extends State<CastModal> with SingleTickerProviderStateMixin {
  final CastService _castService = CastService();
  late AnimationController _radarController;

  @override
  void initState() {
    super.initState();
    _radarController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();

    _castService.addListener(_onCastServiceUpdate);

    // Démarrer la recherche automatique au montage
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_castService.isConnected) {
        _castService.startDiscovery();
      }
    });
  }

  @override
  void dispose() {
    _castService.removeListener(_onCastServiceUpdate);
    _radarController.dispose();
    super.dispose();
  }

  void _onCastServiceUpdate() {
    if (mounted) setState(() {});
  }

  IconData _getDeviceIcon(String deviceType) {
    final lower = deviceType.toLowerCase();
    if (lower.contains('samsung') || lower.contains('lg') || lower.contains('sony') || lower.contains('tv')) {
      return Icons.tv_rounded;
    } else if (lower.contains('chromecast') || lower.contains('android')) {
      return Icons.cast_connected_rounded;
    } else if (lower.contains('roku') || lower.contains('box')) {
      return Icons.speaker_group_rounded;
    }
    return Icons.devices_other_rounded;
  }

  @override
  Widget build(BuildContext context) {
    final isConnected = _castService.isConnected;
    final connectedDevice = _castService.connectedDevice;

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF14141E),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        border: Border(
          top: BorderSide(color: Colors.white12, width: 1),
        ),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 12,
        bottom: MediaQuery.of(context).viewInsets.bottom + 28,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Poignée drag
          Center(
            child: Container(
              width: 44,
              height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // En-tête
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.cast_rounded, color: AppTheme.primary, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Diffuser sur votre TV',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isConnected ? 'Connecté à ${connectedDevice?.name}' : 'Smart TV, DLNA, Box & Chromecast',
                      style: TextStyle(
                        color: isConnected ? Colors.greenAccent : Colors.white60,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              if (!isConnected)
                IconButton(
                  tooltip: 'Relancer la recherche',
                  icon: _castService.isSearching
                      ? RotationTransition(
                          turns: _radarController,
                          child: const Icon(Icons.sync_rounded, color: AppTheme.primary),
                        )
                      : const Icon(Icons.refresh_rounded, color: Colors.white70),
                  onPressed: () {
                    NativeBridge.instance.selectionHaptic();
                    _castService.startDiscovery();
                  },
                ),
            ],
          ),

          const SizedBox(height: 20),

          // VUE TÉLÉCOMMANDE SI CONNECTÉ
          if (isConnected && connectedDevice != null) ...[
            _buildActiveRemoteControl(connectedDevice),
          ] else ...[
            // LISTE DES SMART TV TROUVÉES
            _buildDevicesList(),
          ],

          const SizedBox(height: 16),

          // Option Lecteur Externe Android (VLC, MX Player, BubbleUPnP)
          OutlinedButton.icon(
            onPressed: () async {
              NativeBridge.instance.selectionHaptic();
              Navigator.of(context).pop();
              await NativeBridge.instance.openExternalCaster(
                videoUrl: widget.videoUrl,
                title: widget.title,
              );
            },
            icon: const Icon(Icons.open_in_new_rounded, size: 18, color: Colors.white70),
            label: const Text(
              'Ouvrir avec VLC, MX Player ou BubbleUPnP',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 12),
              side: const BorderSide(color: Colors.white12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDevicesList() {
    final devices = _castService.devices;
    final isSearching = _castService.isSearching;

    if (devices.isEmpty && isSearching) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 36),
        child: Column(
          children: [
            Stack(
              alignment: Alignment.center,
              children: [
                ScaleTransition(
                  scale: Tween(begin: 0.8, end: 1.4).animate(
                    CurvedAnimation(parent: _radarController, curve: Curves.easeInOut),
                  ),
                  child: Container(
                    width: 70,
                    height: 70,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3), width: 2),
                    ),
                  ),
                ),
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.wifi_tethering_rounded, color: AppTheme.primary, size: 28),
                ),
              ],
            ),
            const SizedBox(height: 20),
            const Text(
              'Recherche d\'appareils sur le réseau Wi-Fi...',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 6),
            const Text(
              'Assurez-vous que votre TV est allumée et sur le même Wi-Fi',
              style: TextStyle(color: Colors.white38, fontSize: 11),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    if (devices.isEmpty && !isSearching) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 30),
        child: Column(
          children: [
            const Icon(Icons.tv_off_rounded, color: Colors.white30, size: 48),
            const SizedBox(height: 12),
            const Text(
              'Aucune TV détectée sur ce réseau Wi-Fi',
              style: TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            const Text(
              'Connectez votre téléphone et votre Smart TV au même Wi-Fi',
              style: TextStyle(color: Colors.white38, fontSize: 12),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () {
                NativeBridge.instance.selectionHaptic();
                _castService.startDiscovery();
              },
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Réessayer la recherche'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      constraints: const BoxConstraints(maxHeight: 280),
      child: ListView.separated(
        shrinkWrap: true,
        itemCount: devices.length,
        separatorBuilder: (_, index) => const Divider(color: Colors.white10, height: 1),
        itemBuilder: (context, index) {
          final device = devices[index];
          return ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            leading: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(_getDeviceIcon(device.deviceType), color: Colors.white, size: 22),
            ),
            title: Text(
              device.name,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
            ),
            subtitle: Text(
              '${device.deviceType} • ${device.host}',
              style: const TextStyle(color: Colors.white38, fontSize: 11),
            ),
            trailing: const Icon(Icons.chevron_right_rounded, color: Colors.white38),
            onTap: () async {
              NativeBridge.instance.mediumHaptic();
              final success = await _castService.castToDevice(
                device: device,
                videoUrl: widget.videoUrl,
                title: widget.title,
              );
              if (success && context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Diffusion lancée sur ${device.name} !'),
                    backgroundColor: Colors.green.shade800,
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              }
            },
          );
        },
      ),
    );
  }

  Widget _buildActiveRemoteControl(CastDevice device) {
    final isPlaying = _castService.state == CastState.playing;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          // Statut actif
          Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: const BoxDecoration(
                  color: Colors.greenAccent,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'En lecture sur ${device.name}',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              TextButton.icon(
                onPressed: () {
                  NativeBridge.instance.selectionHaptic();
                  _castService.stop();
                },
                icon: const Icon(Icons.stop_circle_rounded, color: Colors.redAccent, size: 18),
                label: const Text('Arrêter', style: TextStyle(color: Colors.redAccent, fontSize: 12)),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Contrôles Play / Pause
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton.filled(
                iconSize: 32,
                style: IconButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.all(16),
                ),
                icon: Icon(isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded),
                onPressed: () {
                  NativeBridge.instance.lightHaptic();
                  if (isPlaying) {
                    _castService.pause();
                  } else {
                    _castService.play();
                  }
                },
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Contrôle Volume TV
          Row(
            children: [
              const Icon(Icons.volume_down_rounded, color: Colors.white60, size: 20),
              Expanded(
                child: SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    trackHeight: 3,
                    thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                    activeTrackColor: AppTheme.primary,
                    thumbColor: AppTheme.primary,
                    inactiveTrackColor: Colors.white24,
                  ),
                  child: Slider(
                    value: _castService.volume,
                    onChanged: (val) {
                      _castService.setTvVolume(val);
                    },
                  ),
                ),
              ),
              const Icon(Icons.volume_up_rounded, color: Colors.white60, size: 20),
              SizedBox(
                width: 38,
                child: Text(
                  '${(_castService.volume * 100).round()}%',
                  textAlign: TextAlign.right,
                  style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
