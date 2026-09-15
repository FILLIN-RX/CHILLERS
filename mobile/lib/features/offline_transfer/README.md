# Offline P2P Transfer Feature

This module implements peer-to-peer file transfer functionality for offline media sharing between CHILLERS app users.

## Architecture

The module follows a clean architecture pattern with clear separation of concerns:

```
lib/features/offline_transfer/
├── models/           # Data models and entities
├── services/         # Business logic and external services
├── ui/              # User interface components
├── utils/           # Helper functions and utilities
└── offline_transfer.dart  # Main barrel export file
```

## Folder Structure

### 📁 models/
Contains all data models used throughout the feature:
- **Connection Models**: `ConnectionCredentials`, `TransferSession`
- **Transfer Models**: `TransferProgress`, `DownloadChunk`
- **Media Models**: `MediaMetadata`
- **Enums**: `TransferState`, `TransferRole`, `ChunkStatus`

Import: `import 'package:chillers_mobile/features/offline_transfer/models/models.dart';`

### 📁 services/
Contains business logic and service layer implementations:

#### Core Services
- **TransferManager**: Orchestrates the entire transfer process
- **ConnectionManager**: Unified connection management (Wi-Fi Direct / Local Network)

#### Pairing Services
- **NFCService**: NFC-based device pairing (Mobile only)
- **QRGenerator**: Generates QR codes with connection credentials
- **QRScanner**: Scans QR codes to extract connection credentials

#### Network Services
- **WiFiDirectManager**: Manages Wi-Fi Direct connections (Mobile)
- **LocalHTTPServer**: Serves files via HTTP (Sender)
- **HTTPDownloadClient**: Downloads files in chunks (Receiver)

#### Utility Services
- **IntegrityChecker**: SHA-256 hash verification
- **PlatformDetector**: Detects runtime platform
- **TransferLogger**: Logging and error tracking

Import: `import 'package:chillers_mobile/features/offline_transfer/services/services.dart';`

### 📁 ui/
Contains all user interface components:

#### Screens
- **TransferSenderScreen**: Sender interface with pairing options
- **TransferReceiverScreen**: Receiver interface for scanning/connecting
- **TransferProgressScreen**: Real-time transfer progress display

#### Widgets
- **PairingModeWidget**: NFC/QR pairing options
- **QRCodeDisplay**: Shows QR code for scanning
- **QRScannerWidget**: Camera scanner for QR codes
- **NFCPairingWidget**: NFC tap interface
- **TransferProgressWidget**: Progress bar and metrics
- **ConnectionStatusWidget**: Connection status indicator
- **TransferSuccessWidget**: Success animation
- **TransferErrorWidget**: Error display and recovery options

Import: `import 'package:chillers_mobile/features/offline_transfer/ui/ui.dart';`

### 📁 utils/
Contains utility functions and helpers:
- **Formatters**: Speed, size, and time formatting
- **Validators**: Credential and data validation
- **Constants**: Configuration constants
- **Extensions**: Dart extension methods

Import: `import 'package:chillers_mobile/features/offline_transfer/utils/utils.dart';`

## Usage Examples

### Basic Import
```dart
// Import the entire feature
import 'package:chillers_mobile/features/offline_transfer/offline_transfer.dart';

// Or import specific modules
import 'package:chillers_mobile/features/offline_transfer/models/models.dart';
import 'package:chillers_mobile/features/offline_transfer/services/services.dart';
```

### Initialize Transfer Manager
```dart
final transferManager = TransferManager();
```

### Start Sharing (Sender)
```dart
// Select a downloaded media item
final mediaItem = await MediaLibrary.getMediaItem(mediaId);

// Initiate share mode
final session = await transferManager.initiateShare(mediaItem);

// Listen to session updates
session.progressStream.listen((progress) {
  print('Progress: ${progress.progress * 100}%');
  print('Speed: ${progress.formattedSpeed}');
});
```

### Receive File (Receiver)
```dart
// After scanning QR code or receiving NFC credentials
final credentials = ConnectionCredentials.fromJson(qrData);

// Initiate receive mode
final session = await transferManager.initiateReceive(credentials);

// Monitor transfer
session.progressStream.listen((progress) {
  if (progress.state == TransferState.completed) {
    print('Transfer completed!');
  }
});
```

## Platform Support

This feature supports the following platforms:

| Platform | Pairing Methods | Connection Type |
|----------|----------------|-----------------|
| Android  | NFC, QR Code   | Wi-Fi Direct    |
| iOS      | QR Code        | Personal Hotspot |
| Windows  | QR Code (Manual) | Local Network  |
| Linux    | QR Code (Manual) | Local Network  |
| macOS    | QR Code (Manual) | Local Network  |

## Requirements Mapping

This module implements the following spec requirements:

- **Requirement 12.1**: Multi-platform transfer support (Mobile ↔ Mobile, Desktop ↔ Desktop, Mobile ↔ Desktop)
- **Requirement 12.2**: Platform detection and appropriate connection strategy selection

## Design Principles

1. **Separation of Concerns**: Each folder has a distinct responsibility
2. **Barrel Exports**: Clean imports via barrel files (`.dart` files in each folder)
3. **Platform Abstraction**: Platform-specific code isolated in services
4. **Testability**: Services and models designed for easy unit testing
5. **Documentation**: All public APIs are well-documented

## Next Steps

The following components will be implemented in subsequent tasks:

1. **Models**: Define data structures for transfers
2. **Services**: Implement transfer logic and network services
3. **UI Components**: Build user interface screens and widgets
4. **Testing**: Unit tests and integration tests
5. **Platform Integration**: Platform-specific implementations

## Dependencies

Required Flutter packages (to be added):
- `network_info_plus`: Network information
- `wifi_iot` / `network_info_plus`: Wi-Fi Direct management
- `nfc_manager`: NFC communication
- `qr_flutter`: QR code generation
- `mobile_scanner`: QR code scanning
- `shelf` or `dart:io`: HTTP server
- `crypto`: SHA-256 hashing
- `path_provider`: File path management
- `universal_io`: Platform detection
- `multicast_dns`: mDNS for local network discovery

## Notes

- **Security**: All connections use WPA2/WPA3 encryption
- **Performance**: Target transfer speed of 20-60 MB/s
- **Reliability**: 95%+ success rate with automatic retry
- **User Experience**: < 15 seconds connection time
