library;

import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:nfc_manager/ndef_record.dart';
import 'package:nfc_manager/nfc_manager.dart';
import 'package:nfc_manager/nfc_manager_android.dart';
import 'package:nfc_manager/nfc_manager_ios.dart';
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
      final availability = await NfcManager.instance.checkAvailability();
      return availability == NfcAvailability.enabled;
    } catch (e) {
      debugPrint('[NFCService] Error checking availability: $e');
      return false;
    }
  }

  Uint8List _createTextPayload(String text, {String languageCode = 'en'}) {
    final langBytes = ascii.encode(languageCode);
    final textBytes = utf8.encode(text);
    final statusByte = langBytes.length & 0x3F;
    final builder = BytesBuilder();
    builder.addByte(statusByte);
    builder.add(langBytes);
    builder.add(textBytes);
    return builder.toBytes();
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
          final jsonPayload = jsonEncode(credentials.toJson());
          final record = NdefRecord(
            typeNameFormat: TypeNameFormat.wellKnown,
            type: Uint8List.fromList(utf8.encode('T')),
            identifier: Uint8List(0),
            payload: _createTextPayload(jsonPayload),
          );
          final message = NdefMessage(records: [record]);

          try {
            if (defaultTargetPlatform == TargetPlatform.android) {
              final ndef = NdefAndroid.from(tag);
              if (ndef == null) {
                onStatusChange?.call('Tag NFC incompatible');
                return;
              }
              if (!ndef.isWritable) {
                onStatusChange?.call('Tag NFC en lecture seule');
                return;
              }
              await ndef.writeNdefMessage(message);
            } else if (defaultTargetPlatform == TargetPlatform.iOS) {
              final ndef = NdefIos.from(tag);
              if (ndef == null) {
                onStatusChange?.call('Tag NFC incompatible');
                return;
              }
              await ndef.writeNdef(message);
            } else {
              onStatusChange?.call('Plateforme non supportée');
              return;
            }

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
          NdefMessage? message;
          if (defaultTargetPlatform == TargetPlatform.android) {
            final ndef = NdefAndroid.from(tag);
            message = ndef?.cachedNdefMessage;
            if (message == null && ndef != null) {
              try {
                message = await ndef.getNdefMessage();
              } catch (_) {}
            }
          } else if (defaultTargetPlatform == TargetPlatform.iOS) {
            final ndef = NdefIos.from(tag);
            message = ndef?.cachedNdefMessage;
            if (message == null && ndef != null) {
              try {
                message = await ndef.readNdef();
              } catch (_) {}
            }
          }

          if (message == null || message.records.isEmpty) {
            onStatusChange?.call('Aucun message NDEF détecté');
            return;
          }

          for (final record in message.records) {
            try {
              // Parse text record or generic payload
              String payloadString;
              if (record.typeNameFormat == TypeNameFormat.wellKnown &&
                  record.type.length == 1 &&
                  record.type[0] == 0x54) {
                // Text record payload begins with status byte and language code
                final payload = record.payload;
                if (payload.isNotEmpty) {
                  final languageCodeLength = payload[0] & 0x3F;
                  if (payload.length >= 1 + languageCodeLength) {
                    final textBytes = payload.sublist(1 + languageCodeLength);
                    payloadString = utf8.decode(textBytes);
                  } else {
                    payloadString = utf8.decode(payload);
                  }
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
