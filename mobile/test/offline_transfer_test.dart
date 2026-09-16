import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:chillers_mobile/features/offline_transfer/offline_transfer.dart';

void main() {
  group('ConnectionCredentials Tests', () {
    test('Credentials creation, JSON serialization and validity', () {
      final creds = ConnectionCredentials.create(
        ssid: 'CHILLERS_P2P_A1B2C3',
        password: 'secretpassword12',
        ip: '192.168.49.1',
        port: 8080,
      );

      expect(creds.isValid(), isTrue);
      expect(creds.ssid, 'CHILLERS_P2P_A1B2C3');
      expect(creds.port, 8080);

      final json = creds.toJson();
      expect(json['ssid'], 'CHILLERS_P2P_A1B2C3');
      expect(json['port'], 8080);

      final deserialized = ConnectionCredentials.fromJson(json);
      expect(deserialized.ssid, creds.ssid);
      expect(deserialized.password, creds.password);
      expect(deserialized.ip, creds.ip);
      expect(deserialized.port, creds.port);
    });

    test('QR Code Data and Manual PIN generation', () {
      final creds = ConnectionCredentials.create(
        ssid: 'CHILLERS_P2P_TEST99',
        password: 'randompassword123',
        ip: '192.168.49.1',
        port: 8080,
      );

      final qrData = creds.toQRData();
      final parsed = QRScanner.parseQRCode(qrData);
      expect(parsed, isNotNull);
      expect(parsed!.ssid, creds.ssid);
      expect(parsed.password, creds.password);

      final manualCode = creds.generateManualCode();
      expect(manualCode.length, 6);
      expect(QRScanner.validateManualCode(manualCode, creds), isTrue);
      expect(QRScanner.validateManualCode('000000', creds), isFalse);
    });
  });

  group('MediaMetadata Tests', () {
    test('Formatting and validity', () {
      final metadata = MediaMetadata(
        title: 'Inception',
        mediaType: 'movie',
        fileSize: 1572864000, // ~1.5 GB
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        duration: 8880, // 2h 28m
        year: 2010,
      );

      expect(metadata.isValid(), isTrue);
      expect(metadata.formattedFileSize, contains('GB'));
      expect(metadata.formattedDuration, '2h 28m');

      final json = metadata.toJson();
      final restored = MediaMetadata.fromJson(json);
      expect(restored.title, 'Inception');
      expect(restored.fileSize, 1572864000);
      expect(restored.sha256, metadata.sha256);
    });
  });

  group('TransferSession & State Machine Tests', () {
    test('Session lifecycle and progress calculation', () {
      final creds = ConnectionCredentials.create(
        ssid: 'CHILLERS_P2P_SESSION',
        password: 'pass',
        ip: '127.0.0.1',
        port: 8080,
      );
      final meta = MediaMetadata(
        title: 'Test Movie',
        mediaType: 'movie',
        fileSize: 1000000,
        sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      );

      var session = TransferSession.sender(
        id: 'sess-123',
        media: meta,
        credentials: creds,
      );

      expect(session.state, TransferState.pairingMode);
      expect(session.isActive, isTrue);
      expect(session.isFinished, isFalse);

      session = session.transitionTo(TransferState.transferring);
      expect(session.isTransferring, isTrue);

      session = session.updateProgress(
        transferredBytes: 500000,
        currentSpeed: 25000000,
      );
      expect(session.progress, 0.5);
      expect(session.progressPercentage, 50);

      session = session.transitionTo(TransferState.completed);
      expect(session.isFinished, isTrue);
      expect(session.isActive, isFalse);
    });
  });

  group('IntegrityChecker Tests', () {
    test('Calculates and verifies SHA-256 correctly', () async {
      final checker = IntegrityChecker();
      final tempDir = Directory.systemTemp.createTempSync('p2p_test_');
      final testFile = File('${tempDir.path}/test_file.bin');

      try {
        // Write 100 KB test payload
        final payload = List<int>.generate(102400, (i) => i % 256);
        await testFile.writeAsBytes(payload);

        final calculatedHash = await checker.calculateFileHash(testFile.path);
        expect(calculatedHash.length, 64);

        final isValid = await checker.verifyFileIntegrity(testFile.path, calculatedHash);
        expect(isValid, isTrue);

        final isCorruptValid = await checker.verifyFileIntegrity(
          testFile.path,
          '0000000000000000000000000000000000000000000000000000000000000000',
        );
        expect(isCorruptValid, isFalse);
      } finally {
        tempDir.deleteSync(recursive: true);
      }
    });
  });

  group('LocalHTTPServer & HTTPDownloadClient Chunk Transfer Tests', () {
    test('End-to-end local HTTP chunked file download and verification', () async {
      final tempDir = Directory.systemTemp.createTempSync('p2p_http_test_');
      final sourceFile = File('${tempDir.path}/source.mp4');
      final destFile = File('${tempDir.path}/destination.mp4');

      try {
        // Create 2.5 MB test binary file
        const testSize = 2500000;
        final data = List<int>.generate(testSize, (i) => (i * 7) % 256);
        await sourceFile.writeAsBytes(data);

        final checker = IntegrityChecker();
        final sha256Hash = await checker.calculateFileHash(sourceFile.path);

        final metadata = MediaMetadata(
          title: 'Test Chunked Video',
          mediaType: 'movie',
          fileSize: testSize,
          sha256: sha256Hash,
        );

        final server = LocalHTTPServer();
        final port = await server.start(
          filePath: sourceFile.path,
          metadata: metadata,
          minPort: 8800,
          maxPort: 8900,
        );
        expect(port, isPositive);

        final client = HTTPDownloadClient();
        final fetchedMeta = await client.fetchMetadata('127.0.0.1', port);
        expect(fetchedMeta.title, 'Test Chunked Video');
        expect(fetchedMeta.fileSize, testSize);
        expect(fetchedMeta.sha256, sha256Hash);

        final downloadSuccess = await client.downloadFile(
          sessionId: 'test-session',
          ip: '127.0.0.1',
          port: port,
          metadata: fetchedMeta,
          destinationPath: destFile.path,
        );

        expect(downloadSuccess, isTrue);
        expect(await destFile.exists(), isTrue);
        expect(await destFile.length(), testSize);

        final isIntact = await checker.verifyFileIntegrity(destFile.path, sha256Hash);
        expect(isIntact, isTrue);

        await server.stop();
        client.dispose();
      } finally {
        tempDir.deleteSync(recursive: true);
      }
    });
  });
}
