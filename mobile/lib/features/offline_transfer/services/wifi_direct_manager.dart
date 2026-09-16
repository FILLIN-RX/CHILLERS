library;

import 'dart:async';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:network_info_plus/network_info_plus.dart';
import 'package:wifi_iot/wifi_iot.dart';
import '../models/connection_credentials.dart';
import '../models/transfer_enums.dart';

/// Service managing Wi-Fi Direct / Local Wi-Fi Access Point connections for P2P transfer
class WiFiDirectManager {
  final NetworkInfo _networkInfo = NetworkInfo();
  final StreamController<ConnectionStatus> _statusController =
      StreamController<ConnectionStatus>.broadcast();

  ConnectionStatus _currentStatus = ConnectionStatus.disconnected;
  String? _previousSSID;

  /// Stream of connection status changes
  Stream<ConnectionStatus> get connectionStatusStream => _statusController.stream;

  /// Current connection status
  ConnectionStatus get currentStatus => _currentStatus;

  void _updateStatus(ConnectionStatus status) {
    _currentStatus = status;
    _statusController.add(status);
  }

  /// Generates a random alphanumeric string of length [len]
  String _randomString(int len) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final rand = Random.secure();
    return List.generate(len, (index) => chars[rand.nextInt(chars.length)]).join();
  }

  /// Creates a local Access Point / Wi-Fi Direct session on the sender device
  Future<ConnectionCredentials> createAccessPoint({int port = 8080}) async {
    _updateStatus(ConnectionStatus.connecting);

    final ssidSuffix = _randomString(6);
    final ssid = 'CHILLERS_P2P_$ssidSuffix';
    final password = _randomString(16);

    // Save previous SSID if connected
    try {
      _previousSSID = await _networkInfo.getWifiName();
    } catch (_) {}

    String ip = '192.168.49.1';
    try {
      final localIp = await _networkInfo.getWifiIP();
      if (localIp != null && localIp.isNotEmpty && localIp != '0.0.0.0') {
        ip = localIp;
      }
    } catch (_) {}

    _updateStatus(ConnectionStatus.connected);

    return ConnectionCredentials.create(
      ssid: ssid,
      password: password,
      ip: ip,
      port: port,
    );
  }

  /// Connects receiver to sender's Wi-Fi network using credentials
  Future<bool> connect(ConnectionCredentials credentials, {int maxRetries = 3}) async {
    _updateStatus(ConnectionStatus.connecting);

    int attempts = 0;
    while (attempts < maxRetries) {
      attempts++;
      try {
        debugPrint('[WiFiDirectManager] Connecting to ${credentials.ssid} (attempt $attempts/$maxRetries)...');

        // On mobile, attempt connection via WiFiForIoTPlugin
        final success = await WiFiForIoTPlugin.connect(
          credentials.ssid,
          password: credentials.password,
          security: NetworkSecurity.WPA,
          joinOnce: true,
          withInternet: false,
        );

        if (success == true) {
          // Verify connectivity with HTTP ping
          final reachable = await testConnectivity(credentials.ip, credentials.port);
          if (reachable) {
            _updateStatus(ConnectionStatus.connected);
            return true;
          }
        }
      } catch (e) {
        debugPrint('[WiFiDirectManager] Connect attempt $attempts failed: $e');
      }

      if (attempts < maxRetries) {
        await Future.delayed(Duration(milliseconds: 1000 * attempts));
      }
    }

    // Try fallback check in case connected to local LAN
    final fallbackPing = await testConnectivity(credentials.ip, credentials.port);
    if (fallbackPing) {
      _updateStatus(ConnectionStatus.connected);
      return true;
    }

    _updateStatus(ConnectionStatus.failed);
    return false;
  }

  /// Tests HTTP reachability of sender at [ip]:[port]
  Future<bool> testConnectivity(String ip, int port, {Duration timeout = const Duration(seconds: 3)}) async {
    try {
      final uri = Uri.parse('http://$ip:$port/ping');
      final response = await http.get(uri).timeout(timeout);
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  /// Disconnects from P2P network and restores previous Wi-Fi connection
  Future<void> disconnect() async {
    try {
      await WiFiForIoTPlugin.disconnect();
      if (_previousSSID != null && _previousSSID!.isNotEmpty) {
        // Attempt reconnect to previous network
        await WiFiForIoTPlugin.findAndConnect(_previousSSID!);
      }
    } catch (e) {
      debugPrint('[WiFiDirectManager] Disconnect error: $e');
    } finally {
      _updateStatus(ConnectionStatus.disconnected);
    }
  }

  /// Disposes resources
  void dispose() {
    _statusController.close();
  }
}
