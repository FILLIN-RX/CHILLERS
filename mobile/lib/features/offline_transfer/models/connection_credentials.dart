import 'dart:convert';
import 'dart:typed_data';

/// Connection credentials for P2P transfer
/// 
/// Contains all information needed for a receiver device to connect
/// to a sender device's WiFi Direct access point or local network.
class ConnectionCredentials {
  /// WiFi Direct SSID or network name
  final String ssid;
  
  /// WiFi Direct password (16 characters)
  final String password;
  
  /// Sender's local IP address (e.g., "192.168.49.1")
  final String ip;
  
  /// HTTP server port (8000-9000)
  final int port;
  
  /// Creation timestamp
  final DateTime timestamp;
  
  /// Expiration time (timestamp + 10 minutes)
  final DateTime expiresAt;

  ConnectionCredentials({
    required this.ssid,
    required this.password,
    required this.ip,
    required this.port,
    required this.timestamp,
    required this.expiresAt,
  });

  /// Creates credentials with default 10-minute expiration
  factory ConnectionCredentials.create({
    required String ssid,
    required String password,
    required String ip,
    required int port,
  }) {
    final now = DateTime.now();
    return ConnectionCredentials(
      ssid: ssid,
      password: password,
      ip: ip,
      port: port,
      timestamp: now,
      expiresAt: now.add(const Duration(minutes: 10)),
    );
  }

  /// Validates if credentials are still valid (not expired)
  bool isValid() {
    return DateTime.now().isBefore(expiresAt);
  }

  /// Serializes to JSON for NFC/QR transmission
  Map<String, dynamic> toJson() {
    return {
      'v': '1.0', // Version
      'type': 'chillers_p2p',
      'ssid': ssid,
      'password': password,
      'ip': ip,
      'port': port,
      'timestamp': timestamp.millisecondsSinceEpoch,
      'expires': expiresAt.millisecondsSinceEpoch,
    };
  }

  /// Deserializes from JSON
  factory ConnectionCredentials.fromJson(Map<String, dynamic> json) {
    return ConnectionCredentials(
      ssid: json['ssid'] as String,
      password: json['password'] as String,
      ip: json['ip'] as String,
      port: json['port'] as int,
      timestamp: DateTime.fromMillisecondsSinceEpoch(json['timestamp'] as int),
      expiresAt: DateTime.fromMillisecondsSinceEpoch(json['expires'] as int),
    );
  }

  /// Converts to NDEF payload for NFC transmission
  /// 
  /// Format: UTF-8 encoded JSON string
  Uint8List toNDEF() {
    final jsonString = jsonEncode(toJson());
    return Uint8List.fromList(utf8.encode(jsonString));
  }

  /// Parses from NDEF payload
  /// 
  /// Expects UTF-8 encoded JSON string
  factory ConnectionCredentials.fromNDEF(Uint8List payload) {
    final jsonString = utf8.decode(payload);
    final json = jsonDecode(jsonString) as Map<String, dynamic>;
    return ConnectionCredentials.fromJson(json);
  }

  /// Converts to QR code data string
  String toQRData() {
    return jsonEncode(toJson());
  }

  /// Parses from QR code data string
  factory ConnectionCredentials.fromQRData(String qrData) {
    final json = jsonDecode(qrData) as Map<String, dynamic>;
    return ConnectionCredentials.fromJson(json);
  }

  /// Generates a 6-digit manual code for manual entry
  /// 
  /// This is a simplified version for user input, not for full credentials
  String generateManualCode() {
    // Generate a hash-based 6-digit code from the credentials
    final data = '$ssid$password$ip$port';
    final hash = data.hashCode.abs();
    final code = (hash % 900000 + 100000).toString();
    return code;
  }

  @override
  String toString() {
    return 'ConnectionCredentials(ssid: $ssid, ip: $ip, port: $port, valid: ${isValid()})';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is ConnectionCredentials &&
        other.ssid == ssid &&
        other.password == password &&
        other.ip == ip &&
        other.port == port;
  }

  @override
  int get hashCode {
    return Object.hash(ssid, password, ip, port);
  }

  /// Creates a copy with optional field updates
  ConnectionCredentials copyWith({
    String? ssid,
    String? password,
    String? ip,
    int? port,
    DateTime? timestamp,
    DateTime? expiresAt,
  }) {
    return ConnectionCredentials(
      ssid: ssid ?? this.ssid,
      password: password ?? this.password,
      ip: ip ?? this.ip,
      port: port ?? this.port,
      timestamp: timestamp ?? this.timestamp,
      expiresAt: expiresAt ?? this.expiresAt,
    );
  }
}
