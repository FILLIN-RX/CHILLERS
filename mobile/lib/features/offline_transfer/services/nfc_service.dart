library;

import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:nfc_manager/nfc_manager.dart';
import '../models/connection_credentials.dart';

/// Service handling Near Field Communication for fast device pairing
class NFCService {
  bool _isSessionActive = false;
  StreamController<ConnectionCredentials>? _credentialsController;

  /// Stream of credentials received via NFC
  Stream<ConnectionCredentials> get credentialsStream =>
      _credentialsController?.stream ?? const Stream.empty();

  /// Checks if NFC hardware is available and enabled on device
  Future<bool> isNFCAvailable() async {
    try {
      return await NfcManager.instance.isAvailable();
    } catch (e) {
      debugPrint('[NFCService] Error checking availability: $e');
      return false;
    }
  }

  /// Starts NFC emission mode on sender device to broadcast [credentials]
  Future<bool> startEmission(
    ConnectionCredentials credentials, {
    void Function(String message)? onStatusChange,
  }) async {
    final available = await isNFCAvailable();
    if (!available) {
      onStatusChange?.call('NFC indisponible sur cet appareil');
      return false;
    }

    try {
      _isSessionActive = true;
      onStatusChange?.call('Approchez le téléphone récepteur...');

      await NfcManager.instance.startSession(
        pollingOptions: {
          NfcPollingOption.iso14443,
          NfcPollingOption.iso15693,
        },
        onDiscovered: (NfcTag tag) async {
          final ndef = Ndef.from(tag);
          if (ndef == null) {
            onStatusChange?.call('Tag NFC incompatible');
            return;
          }

          if (!ndef.isWritable) {
            onStatusChange?.call('Tag NFC en lecture seule');
            return;
          }

          final jsonPayload = jsonEncode(credentials.toJson());
          final record = NdefRecord.createText(jsonPayload);
          final message = NdefMessage([record]);

          try {
            await ndef.write(message);
            onStatusChange?.call('Identifiants transmis avec succès via NFC !');
            await NfcManager.instance.stopSession();
            _isSessionActive = false;
          } catch (e) {
            onStatusChange?.call('Erreur d\'écriture NFC: $e');
          }
        },
      );
      return true;
    } catch (e) {
      debugPrint('[NFCService] Failed to start emission session: $e');
      _isSessionActive = false;
      return false;
    }
  }

  /// Starts NFC reception mode on receiver device to receive [ConnectionCredentials]
  Future<Stream<ConnectionCredentials>> startReception({
    void Function(String message)? onStatusChange,
  }) async {
    _credentialsController?.close();
    _credentialsController = StreamController<ConnectionCredentials>.broadcast();

    final available = await isNFCAvailable();
    if (!available) {
      onStatusChange?.call('NFC non disponible');
      return _credentialsController!.stream;
    }

    try {
      _isSessionActive = true;
      onStatusChange?.call('Prêt à recevoir - Approchez du téléphone émetteur');

      await NfcManager.instance.startSession(
        pollingOptions: {
          NfcPollingOption.iso14443,
          NfcPollingOption.iso15693,
        },
        onDiscovered: (NfcTag tag) async {
          final ndef = Ndef.from(tag);
          if (ndef == null || ndef.cachedMessage == null) {
            onStatusChange?.call('Aucun message NDEF détecté');
            return;
          }

          for (final record in ndef.cachedMessage!.records) {
            try {
              // Parse text record or generic payload
              String payloadString;
              if (record.typeNameFormat == NdefTypeNameFormat.nfcWellknown) {
                // Text record payload begins with status byte and language code
                final payload = record.payload;
                if (payload.isNotEmpty) {
                  final languageCodeLength = payload[0] & 0x3F;
                  final textBytes = payload.sublist(1 + languageCodeLength);
                  payloadString = utf8.decode(textBytes);
                } else {
                  payloadString = utf8.decode(record.payload);
                }
              } else {
                payloadString = utf8.decode(record.payload);
              }

              final decoded = jsonDecode(payloadString);
              if (decoded is Map<String, dynamic> && decoded['ssid'] != null) {
                final credentials = ConnectionCredentials.fromJson(decoded);
                _credentialsController?.add(credentials);
                onStatusChange?.call('Identifiants reçus via NFC !');
                await NfcManager.instance.stopSession();
                _isSessionActive = false;
                break;
              }
            } catch (e) {
              debugPrint('[NFCService] Record decoding error: $e');
            }
          }
        },
      );
    } catch (e) {
      debugPrint('[NFCService] Failed to start reception session: $e');
      _isSessionActive = false;
    }

    return _credentialsController!.stream;
  }

  /// Stops any active NFC session
  Future<void> stopSession() async {
    if (_isSessionActive) {
      try {
        await NfcManager.instance.stopSession();
      } catch (e) {
        debugPrint('[NFCService] Stop session error: $e');
      }
      _isSessionActive = false;
    }
  }

  /// Cleans up resources
  void dispose() {
    stopSession();
    _credentialsController?.close();
    _credentialsController = null;
  }
}
