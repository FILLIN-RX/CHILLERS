library;

import 'dart:convert';
import '../models/connection_credentials.dart';

/// Helper service for scanning and decoding QR codes and manual pairing codes
class QRScanner {
  /// Parses raw scanned string into [ConnectionCredentials]
  static ConnectionCredentials? parseQRCode(String rawData) {
    try {
      final json = jsonDecode(rawData);
      if (json is Map<String, dynamic> && json['ssid'] != null && json['password'] != null) {
        final credentials = ConnectionCredentials.fromJson(json);
        if (credentials.isValid()) {
          return credentials;
        }
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Validates a manual 6-digit PIN code against credentials
  static bool validateManualCode(String inputCode, ConnectionCredentials credentials) {
    if (inputCode.trim().length != 6) return false;
    return inputCode.trim() == credentials.generateManualCode();
  }
}
