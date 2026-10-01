# Video Player UI & Architecture Refactor

## Overview

This document describes the refactoring of the mobile video player to extract header management logic, simplify the UI, and adopt a Netflix-like clean aesthetic.

## Changes Made

### 1. Header Management Extraction

**Problem:** HTTP headers for different streaming providers were hardcoded directly in the video player widget (`_getHeadersForUrl` method), making the code:
- Hard to maintain (scattered logic)
- Difficult to extend (new providers require player changes)
- Bloated (30+ lines of if-else conditions)

**Solution:** Created a centralized `StreamingHeadersService` utility

**File:** `mobile/lib/services/streaming_headers_service.dart`

**Benefits:**
- Single source of truth for all provider headers
- Easy to add/update providers without touching the player
- Reusable across the app
- Testable in isolation
- Clean separation of concerns

**Supported Providers (from Backend):**

All providers are sourced from the backend provider-manager and include:

**Video Hosting Platforms:**
- **Doodstream** & Variants: doodstream.com, dood.to, dood.sh, dood.so, dood.cx, dood.la, dood.wf, dood.pm, d000d.com, d0000d.com, playmogo.com, ds2play
- **Vidzy** & Variants: vidzy.cc, vidzy.org, vidzy.xyz, vidzy.co, vidzy.tv, vidzy.top
- **UqLoad**: uqload.is, uqload.com
- **StreamTape**: streamtape.com
- **LuluVid**: luluvid.com, luluvdo.com, lulutv.com
- **VoE**: voe.sx, rebeccapracticeloss

**Scraping Providers:**
- **FrenchStream**: french-stream.net (1080p premium content)
- **Flemmix**: flemmix.party
- **VidLink**: vidlink.pro
- **AnimeKai**: animekai.to
- **OmniSave**: omnisave (multi-source fallback)

**Direct Sources:**
- **Direct Downloads**: videodownloader.site, hakunaymatata, bcdn
- **MongoDB**: Local database with uploaded links
- **Otaku**: Anime-specific source

**Usage in Player:**
```dart
// Old way (hardcoded):
final headers = _getHeadersForUrl(url);

// New way (using service):
final headers = streamingHeadersService.getHeadersForUrl(url);
```

### 2. Player UI Simplification

**Problem:** The player had too many controls and visual elements:
- Multiple overlay HUDs (brightness, volume, seek)
- Too many buttons/gestures
- Cluttered visual design
- Not minimalist like Netflix

**Netflix-Style Approach:**
Netflix prioritizes:
- Minimal controls
- Light/subtle iconography
- Auto-hide overlays
- Focus on content
- Large touch targets

**Current Player Features (to keep):**
- Play/Pause toggle
- Seek bar with progress
- Volume & brightness sliders (gesture-based, hidden by default)
- Playback speed selector
- Full screen
- Picture-in-Picture
- Screen lock

**Simplified UI Principles:**
1. **Fade-in/fade-out controls** - Auto-hide after 4 seconds of inactivity
2. **Minimal button set** - Only essential controls visible
3. **Light icons** - Use thin/light stroke weight (like Netflix)
4. **Gesture-first** - Hide HUDs by default, show only on gesture
5. **Dark theme** - Consistent with streaming platforms
6. **Larger hit targets** - Easier touch targets on mobile

### 3. Icon Styling (Netflix-Like)

**Current:** Font Awesome solid icons (heavy)
**Target:** Light, thin-stroke icons

**Icon Adjustments:**
```dart
// Netflix style = thin/light icons
FaIcon(
  FontAwesomeIcons.play,
  color: Colors.white,
  size: 24,  // Reasonable size
),

// Use these instead of heavy variants:
// - play / pause (not solid)
// - volume2 / volumeX (not volumeUp/Down)
// - maximize2 / minimize2 (not solidSquare)
// - skipBackward / skipForward (not backwardStep)
// - clock (for rewind/forward duration)
```

### 4. Recommended UI Layout

**Bottom Controls Bar (Shows on tap):**
```
[Play/Pause] [Seek Bar with Time] [Remaining Time]
```

**Top Controls Bar (Shows on tap):**
```
[Title] [Back Button] [Settings/More]
```

**Corner Controls (Always accessible):**
```
Top-Right:   [Subtitle] [Quality] [PiP]
Bottom-Right: [Speed]
Bottom-Left:  [Brightness] (hidden by default)
```

**Minimalist Approach:**
- Most controls hidden until tap
- Fade in smoothly (400ms animation)
- Fade out after 4 seconds of inactivity
- Touch-controlled sliders (vertical for volume/brightness)

### 5. Refactoring Roadmap

#### Phase 1: Architecture (DONE ✓)
- [x] Extract headers to `StreamingHeadersService`
- [x] Update player to use service
- [x] Remove hardcoded provider logic

#### Phase 2: UI Simplification (IN PROGRESS)
- [ ] Audit current UI components
- [ ] Identify unnecessary controls
- [ ] Redesign control layout
- [ ] Update icon styling (light/thin)
- [ ] Implement fade-in/fade-out animations
- [ ] Test on various screen sizes

#### Phase 3: Polish
- [ ] Theme colors (Netflix-inspired)
- [ ] Touch feedback (haptics)
- [ ] Accessibility (WCAG compliance)
- [ ] Performance optimization
- [ ] Test with real streams

### 6. File Changes Summary

**New Files:**
- `mobile/lib/services/streaming_headers_service.dart` - Centralized header management

**Modified Files:**
- `mobile/lib/widgets/app_video_player.dart` - Updated to use service, cleaner imports

**To Be Updated:**
- Player UI components (buttons, overlays, themes)
- Icon set (replace heavy icons with thin variants)
- Control visibility logic (fade animations)

### 7. Testing Checklist

- [ ] All streaming providers work with extracted headers
- [ ] Headers are correctly matched to URLs
- [ ] New providers can be added without code changes
- [ ] Player UI renders cleanly
- [ ] Icons display with light/thin style
- [ ] Controls auto-hide correctly
- [ ] Gestures work (brightness, volume, seek)
- [ ] Touch targets are large enough (minimum 44px)
- [ ] Responsive on all screen sizes
- [ ] Performance is smooth (60fps)
- [ ] Haptic feedback works
- [ ] Accessibility features functional

### 8. Future Enhancements

1. **Provider Detection UI**
   - Show current provider in player info
   - Help troubleshoot stream issues
   
2. **Smart Quality Selection**
   - Auto-detect best quality
   - Save user preferences
   
3. **Gesture Customization**
   - Allow users to configure gesture sensitivity
   - Custom gesture actions
   
4. **Advanced Controls Panel**
   - Video filters (brightness, contrast, saturation)
   - Audio settings (subtitles, language, audio track)
   - Playback options (subtitles sync, delay)

5. **Player Analytics**
   - Track which providers are used
   - Stream quality metrics
   - Performance stats

### 9. Code Examples

**Getting headers from service:**
```dart
import '../services/streaming_headers_service.dart';

final headers = streamingHeadersService.getHeadersForUrl(url);
// Returns: {'User-Agent': '...', 'Referer': '...', etc.}

// Check if provider needs special headers
if (streamingHeadersService.requiresSpecialHeaders(url)) {
  // Apply special handling if needed
}

// Get provider name
final provider = streamingHeadersService.getProviderFromUrl(url);
print('Streaming from: $provider');
```

**Adding a new provider (no player changes needed):**
```dart
// In StreamingHeadersService:
static const Map<String, Map<String, String>> _providerHeaders = {
  'newprovider': {
    'Referer': 'https://newprovider.com/',
    'Origin': 'https://newprovider.com',
  },
  // ... rest of providers
};

// Player automatically supports it!
```

### 10. Architecture Diagram

```
┌─────────────────────────────────────────┐
│      AppVideoPlayer (Widget)            │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ UI Components                    │  │
│  │ - Controls (Play, Seek, Speed)   │  │
│  │ - Overlays (HUD, Locks, etc)     │  │
│  │ - Gestures (Tap, Swipe, etc)     │  │
│  └──────────────────────────────────┘  │
│                │                        │
│                ▼                        │
│  ┌──────────────────────────────────┐  │
│  │ _getHeadersForUrl()              │  │
│  │ (Uses StreamingHeadersService)   │  │
│  └──────────────────────────────────┘  │
└─────────────┬──────────────────────────┘
              │
              ▼
    ┌──────────────────────────────────┐
    │ StreamingHeadersService (Util)   │
    │                                  │
    │ ┌────────────────────────────┐   │
    │ │ Provider Headers Map       │   │
    │ │ - Dood                     │   │
    │ │ - Vidzy                    │   │
    │ │ - UqLoad                   │   │
    │ │ - StreamTape               │   │
    │ │ - etc...                   │   │
    │ └────────────────────────────┘   │
    │                                  │
    │ Public Methods:                  │
    │ - getHeadersForUrl()             │
    │ - getRefererForUrl()             │
    │ - getProviderFromUrl()           │
    │ - requiresSpecialHeaders()       │
    │ - isKnownProvider()              │
    │ - getSupportedProviders()        │
    └──────────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────────┐
    │ HTTP Request to Streaming URL    │
    │ (With Correct Headers)           │
    └──────────────────────────────────┘
```

## Summary

This refactor achieves three goals:

1. **Better Architecture**: Extracted header logic into a reusable service
2. **Cleaner Codebase**: Removed 30+ lines of hardcoded conditions
3. **Maintainability**: Adding new providers is now trivial - no player code changes needed
4. **Future Work**: UI simplification to Netflix-like aesthetic (phase 2)

The groundwork is laid for a modern, minimal video player experience.
