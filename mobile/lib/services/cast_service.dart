import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'native_bridge.dart';

class CastDevice {
  final String id;
  final String name;
  final String host;
  final int port;
  final String locationUrl;
  final String? controlUrl;
  final String? renderingControlUrl;
  final String deviceType; // Samsung, LG, Android TV, Roku, DLNA

  CastDevice({
    required this.id,
    required this.name,
    required this.host,
    required this.port,
    required this.locationUrl,
    this.controlUrl,
    this.renderingControlUrl,
    this.deviceType = 'Smart TV',
  });
}

enum CastState {
  idle,
  connecting,
  playing,
  paused,
  error,
}

class CastService extends ChangeNotifier {
  static final CastService _instance = CastService._internal();
  factory CastService() => _instance;
  CastService._internal();

  final List<CastDevice> _devices = [];
  bool _isSearching = false;
  RawDatagramSocket? _socket;
  Timer? _searchTimeoutTimer;

  CastDevice? _connectedDevice;
  CastState _state = CastState.idle;
  String? _currentTitle;
  String? _currentMediaUrl;
  Duration _currentPosition = Duration.zero;
  Duration _totalDuration = Duration.zero;
  double _volume = 0.5;

  List<CastDevice> get devices => List.unmodifiable(_devices);
  bool get isSearching => _isSearching;
  CastDevice? get connectedDevice => _connectedDevice;
  CastState get state => _state;
  bool get isConnected => _connectedDevice != null && _state != CastState.idle && _state != CastState.error;
  String? get currentTitle => _currentTitle;
  String? get currentMediaUrl => _currentMediaUrl;
  Duration get currentPosition => _currentPosition;
  Duration get totalDuration => _totalDuration;
  double get volume => _volume;

  void updatePosition(Duration pos, Duration total) {
    _currentPosition = pos;
    _totalDuration = total;
    notifyListeners();
  }

  // ── DÉCOUVERTE SSDP / DLNA MULTICAST ──

  Future<void> startDiscovery({Duration timeout = const Duration(seconds: 8)}) async {
    if (_isSearching) return;
    _isSearching = true;
    _devices.clear();
    notifyListeners();

    await NativeBridge.instance.acquireMulticastLock();

    try {
      _socket = await RawDatagramSocket.bind(InternetAddress.anyIPv4, 0);
      _socket!.broadcastEnabled = true;
      _socket!.multicastHops = 4;

      final ssdpSearch = 'M-SEARCH * HTTP/1.1\r\n'
          'HOST: 239.255.255.250:1900\r\n'
          'MAN: "ssdp:discover"\r\n'
          'MX: 3\r\n'
          'ST: urn:schemas-upnp-org:service:AVTransport:1\r\n\r\n';

      final ssdpSearchAll = 'M-SEARCH * HTTP/1.1\r\n'
          'HOST: 239.255.255.250:1900\r\n'
          'MAN: "ssdp:discover"\r\n'
          'MX: 3\r\n'
          'ST: ssdp:all\r\n\r\n';

      final multicastAddress = InternetAddress('239.255.255.250');
      _socket!.send(utf8.encode(ssdpSearch), multicastAddress, 1900);
      _socket!.send(utf8.encode(ssdpSearchAll), multicastAddress, 1900);

      _socket!.listen((event) {
        if (event == RawSocketEvent.read) {
          final datagram = _socket?.receive();
          if (datagram != null) {
            _parseSsdpResponse(utf8.decode(datagram.data, allowMalformed: true), datagram.address);
          }
        }
      });

      _searchTimeoutTimer?.cancel();
      _searchTimeoutTimer = Timer(timeout, stopDiscovery);
    } catch (e) {
      debugPrint('[CastService] Erreur découverte SSDP: $e');
      stopDiscovery();
    }
  }

  void stopDiscovery() {
    _isSearching = false;
    _searchTimeoutTimer?.cancel();
    _socket?.close();
    _socket = null;
    NativeBridge.instance.releaseMulticastLock();
    notifyListeners();
  }

  Future<void> _parseSsdpResponse(String response, InternetAddress address) async {
    final lines = response.split('\r\n');
    String? location;

    for (final line in lines) {
      final lower = line.toLowerCase();
      if (lower.startsWith('location:')) {
        location = line.substring(9).trim();
        break;
      }
    }

    if (location == null || location.isEmpty) return;

    // Éviter d'interroger plusieurs fois le même périphérique
    if (_devices.any((d) => d.locationUrl == location)) return;

    try {
      final uri = Uri.parse(location);
      final res = await http.get(uri).timeout(const Duration(seconds: 3));
      if (res.statusCode == 200) {
        final xml = res.body;
        final name = _extractXmlTag(xml, 'friendlyName') ?? 'Smart TV (${address.address})';
        final controlUrl = _extractControlUrl(xml, uri, 'urn:schemas-upnp-org:service:AVTransport:1');
        final renderingUrl = _extractControlUrl(xml, uri, 'urn:schemas-upnp-org:service:RenderingControl:1');

        String deviceType = 'Smart TV';
        final lowerName = name.toLowerCase();
        if (lowerName.contains('samsung')) {
          deviceType = 'Samsung Smart TV';
        } else if (lowerName.contains('lg') || lowerName.contains('webos')) {
          deviceType = 'LG webOS TV';
        } else if (lowerName.contains('sony') || lowerName.contains('bravia')) {
          deviceType = 'Sony Bravia TV';
        } else if (lowerName.contains('android') || lowerName.contains('chromecast')) {
          deviceType = 'Android TV / Google Cast';
        } else if (lowerName.contains('roku')) {
          deviceType = 'Roku TV';
        } else if (lowerName.contains('freebox')) {
          deviceType = 'Freebox TV';
        }

        final device = CastDevice(
          id: '${address.address}:${uri.port}',
          name: name,
          host: address.address,
          port: uri.port,
          locationUrl: location,
          controlUrl: controlUrl,
          renderingControlUrl: renderingUrl,
          deviceType: deviceType,
        );

        if (!_devices.any((d) => d.id == device.id)) {
          _devices.add(device);
          notifyListeners();
        }
      }
    } catch (_) {}
  }

  String? _extractXmlTag(String xml, String tag) {
    final startTag = '<$tag>';
    final endTag = '</$tag>';
    final startIdx = xml.indexOf(startTag);
    if (startIdx == -1) return null;
    final endIdx = xml.indexOf(endTag, startIdx);
    if (endIdx == -1) return null;
    return xml.substring(startIdx + startTag.length, endIdx).trim();
  }

  String? _extractControlUrl(String xml, Uri baseUri, String serviceType) {
    final serviceIdx = xml.indexOf(serviceType);
    if (serviceIdx == -1) return null;
    final controlTagIdx = xml.indexOf('<controlURL>', serviceIdx);
    if (controlTagIdx == -1) return null;
    final endIdx = xml.indexOf('</controlURL>', controlTagIdx);
    if (endIdx == -1) return null;
    final relUrl = xml.substring(controlTagIdx + 12, endIdx).trim();
    return baseUri.resolve(relUrl).toString();
  }

  // ── PROTOCOLE DLNA AVTransport (Lecture, Pause, Seek, Volume) ──

  Future<bool> castToDevice({
    required CastDevice device,
    required String videoUrl,
    required String title,
  }) async {
    _connectedDevice = device;
    _currentTitle = title;
    _currentMediaUrl = videoUrl;
    _state = CastState.connecting;
    notifyListeners();
    NativeBridge.instance.mediumHaptic();

    if (device.controlUrl == null) {
      // Fallback intent externe Android
      final launched = await NativeBridge.instance.openExternalCaster(videoUrl: videoUrl, title: title);
      _state = launched ? CastState.playing : CastState.error;
      notifyListeners();
      return launched;
    }

    try {
      // 1. SetAVTransportURI
      final setUriBody = '<?xml version="1.0" encoding="utf-8"?>'
          '<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">'
          '<s:Body>'
          '<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">'
          '<InstanceID>0</InstanceID>'
          '<CurrentURI>$videoUrl</CurrentURI>'
          '<CurrentURIMetaData>&lt;DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"&gt;&lt;item id="1" parentID="0" restricted="1"&gt;&lt;dc:title&gt;$title&lt;/dc:title&gt;&lt;res protocolInfo="http-get:*:video/mp4:*"&gt;$videoUrl&lt;/res&gt;&lt;/item&gt;&lt;/DIDL-Lite&gt;</CurrentURIMetaData>'
          '</u:SetAVTransportURI>'
          '</s:Body>'
          '</s:Envelope>';

      await http.post(
        Uri.parse(device.controlUrl!),
        headers: {
          'Content-Type': 'text/xml; charset="utf-8"',
          'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"',
        },
        body: setUriBody,
      ).timeout(const Duration(seconds: 5));

      // 2. Play
      final playBody = '<?xml version="1.0" encoding="utf-8"?>'
          '<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">'
          '<s:Body>'
          '<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">'
          '<InstanceID>0</InstanceID>'
          '<Speed>1</Speed>'
          '</u:Play>'
          '</s:Body>'
          '</s:Envelope>';

      await http.post(
        Uri.parse(device.controlUrl!),
        headers: {
          'Content-Type': 'text/xml; charset="utf-8"',
          'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#Play"',
        },
        body: playBody,
      ).timeout(const Duration(seconds: 5));

      _state = CastState.playing;
      notifyListeners();
      NativeBridge.instance.lightHaptic();
      return true;
    } catch (e) {
      debugPrint('[CastService] Erreur SOAP Cast: $e');
      // Tentative fallback via Intent natif
      final launched = await NativeBridge.instance.openExternalCaster(videoUrl: videoUrl, title: title);
      _state = launched ? CastState.playing : CastState.error;
      notifyListeners();
      return launched;
    }
  }

  Future<void> play() async {
    if (_connectedDevice?.controlUrl == null) return;
    _sendAvTransportSoap('Play', '<InstanceID>0</InstanceID><Speed>1</Speed>');
    _state = CastState.playing;
    notifyListeners();
  }

  Future<void> pause() async {
    if (_connectedDevice?.controlUrl == null) return;
    _sendAvTransportSoap('Pause', '<InstanceID>0</InstanceID>');
    _state = CastState.paused;
    notifyListeners();
  }

  Future<void> stop() async {
    if (_connectedDevice?.controlUrl != null) {
      _sendAvTransportSoap('Stop', '<InstanceID>0</InstanceID>');
    }
    _connectedDevice = null;
    _state = CastState.idle;
    _currentMediaUrl = null;
    _currentTitle = null;
    notifyListeners();
  }

  Future<void> setTvVolume(double volume) async {
    _volume = volume.clamp(0.0, 1.0);
    notifyListeners();
    if (_connectedDevice?.renderingControlUrl == null) return;

    final targetVal = (_volume * 100).round();
    final body = '<?xml version="1.0" encoding="utf-8"?>'
        '<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">'
        '<s:Body>'
        '<u:SetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1">'
        '<InstanceID>0</InstanceID>'
        '<Channel>Master</Channel>'
        '<DesiredVolume>$targetVal</DesiredVolume>'
        '</u:SetVolume>'
        '</s:Body>'
        '</s:Envelope>';

    try {
      await http.post(
        Uri.parse(_connectedDevice!.renderingControlUrl!),
        headers: {
          'Content-Type': 'text/xml; charset="utf-8"',
          'SOAPAction': '"urn:schemas-upnp-org:service:RenderingControl:1#SetVolume"',
        },
        body: body,
      );
    } catch (_) {}
  }

  Future<void> _sendAvTransportSoap(String action, String innerXml) async {
    if (_connectedDevice?.controlUrl == null) return;
    final body = '<?xml version="1.0" encoding="utf-8"?>'
        '<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">'
        '<s:Body>'
        '<u:$action xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">'
        '$innerXml'
        '</u:$action>'
        '</s:Body>'
        '</s:Envelope>';

    try {
      await http.post(
        Uri.parse(_connectedDevice!.controlUrl!),
        headers: {
          'Content-Type': 'text/xml; charset="utf-8"',
          'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#$action"',
        },
        body: body,
      );
    } catch (_) {}
  }
}
