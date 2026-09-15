# Offline Transfer Module Structure

## Directory Tree

```
lib/features/offline_transfer/
├── models/                           # Data models and entities
│   └── models.dart                  # Barrel export for all models
│
├── services/                         # Business logic and services
│   └── services.dart                # Barrel export for all services
│
├── ui/                              # User interface components
│   ├── screens/                     # Full-screen pages
│   │   └── screens.dart            # Barrel export for screens
│   ├── widgets/                     # Reusable UI components
│   │   └── widgets.dart            # Barrel export for widgets
│   └── ui.dart                     # Barrel export for all UI
│
├── utils/                           # Helper functions and utilities
│   └── utils.dart                  # Barrel export for utilities
│
├── offline_transfer.dart            # Main module export
└── README.md                        # Module documentation
```

## Import Paths

### Full Module Import
```dart
import 'package:chillers_mobile/features/offline_transfer/offline_transfer.dart';
```

### Specific Submodule Imports
```dart
// Models only
import 'package:chillers_mobile/features/offline_transfer/models/models.dart';

// Services only
import 'package:chillers_mobile/features/offline_transfer/services/services.dart';

// UI components only
import 'package:chillers_mobile/features/offline_transfer/ui/ui.dart';

// Utilities only
import 'package:chillers_mobile/features/offline_transfer/utils/utils.dart';
```

## Folder Responsibilities

### 📁 models/
**Purpose**: Data structures and domain entities

**Contents**:
- Connection credentials
- Transfer session state
- Progress tracking models
- Media metadata
- Download chunks
- Enums and types

**No Dependencies On**: UI, Services (only pure data)

---

### 📁 services/
**Purpose**: Business logic and external integrations

**Contents**:
- Transfer orchestration
- NFC communication
- QR code generation/scanning
- Wi-Fi Direct management
- HTTP server and client
- Integrity checking
- Platform detection
- Error handling

**Dependencies**: Models only

---

### 📁 ui/
**Purpose**: User interface and presentation

**Structure**:
```
ui/
├── screens/           # Full pages (TransferSenderScreen, etc.)
├── widgets/           # Reusable components (QRCodeDisplay, etc.)
└── ui.dart           # Main UI barrel export
```

**Dependencies**: Models, Services

---

### 📁 utils/
**Purpose**: Helper functions and shared utilities

**Contents**:
- Formatters (speed, size, time)
- Validators
- Constants
- Extensions
- Logging utilities

**No Dependencies On**: Services, UI (only Models if needed)

---

## Design Principles

1. **Layered Architecture**: Clear separation between data, logic, and presentation
2. **Dependency Direction**: UI → Services → Models (never backwards)
3. **Barrel Exports**: Each folder has a barrel file for clean imports
4. **Platform Agnostic**: Platform-specific code isolated in services
5. **Testability**: Pure functions and clear interfaces enable easy testing

## Status

✅ **Task 1.1 Completed**: Flutter module structure created
- Directory structure established
- Barrel exports configured
- Documentation added
- Ready for implementation

## Next Steps

1. **Task 1.2**: Implement data models
2. **Task 1.3**: Implement core services
3. **Task 1.4**: Build UI components
4. **Task 1.5**: Add unit tests
