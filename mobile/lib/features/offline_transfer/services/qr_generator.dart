library;

import 'dart:convert';
import '../models/connection_credentials.dart';

/// Helper service for generating QR code payloads and manual pairing codes
class QRGenerator {
  /// Generates the serialized JSON payload for QR code rendering
  static String generatePayload(ConnectionCredentials credentials) {
    return jsonEncode(credentials.toJson());
  }

  /// Generates a simplified 6-digit alphanumeric code for manual connection entry
  static String generateManualCode(ConnectionCredentials credentials) {
    return credentials.generateManualCode();
  }

  /// Validates if a QR payload is valid and not expired
  static bool validatePayload(String rawPayload) {
    try {
      final json = jsonDecode(rawPayload);
      if (json is! Map<String, dynamic>) return false;
      if (json['type'] != 'chillers_p2p' || json['ssid'] == null || json['password'] == null) {
        return false;
      }
      final creds = ConnectionCredentials.fromJson(json);
      return creds.isValid();
    } catch (_) {
      return false;
    }
  }
}
