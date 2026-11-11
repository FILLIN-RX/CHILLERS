# Implementation Plan: Unified Download Hook

## Problem Statement

**iOS Production Bug**: Downloads open `chillers.site` (frontend) instead of the Railway backend (`https://chillers-production-eace.up.railway.app`).

**Root Cause**: Multiple download call sites build relative URLs like `/api/download/file?...` which resolve to the current domain (chillers.site) instead of the backend origin. On iOS, `window.open(relativeUrl)` navigates to the frontend, not the backend.

**Solution**: Create a unified React hook `useUnifiedDownload` that centralizes all download logic and ALWAYS uses `getBackendOrigin()` from `src/services/http.ts` to build absolute backend URLs for iOS downloads.

---

## Critical URL Construction Pattern (iOS Fix)

```typescript
import { getBackendOrigin } from '@/services/http';

// ❌ WRONG: Relative URL resolves to chillers.site in production
const badUrl = '/api/download/file?url=...';
window.open(badUrl, '_blank'); // Opens frontend, not backend

// ✅ CORRECT: Absolute URL with backend origin
const backendOrigin = getBackendOrigin(); // https://chillers-production-eace.up.railway.app
const goodUrl = `${backendOrigin}/api/download/file?url=...`;
window.open(goodUrl, '_blank'); // Opens backend correctly
```

**This pattern MUST be used in**:
1. `useUnifiedDownload` hook (new)
2. `toIOSDownloadHref()` in `src/services/downloads.ts` (fix existing)
3. `triggerAttachmentDownload()` in `src/services/downloads.ts` (fix existing)

---

## Implementation Sequence

### FEAT-001: Core Unified Download Hook ✅ Priority 1

**What**: Create `src/hooks/useUnifiedDownload.ts` with platform detection and the iOS absolute URL fix.

**Files to Create**:
- `src/hooks/useUnifiedDownload.ts`

**Key Implementation Details**:
1. **Platform Detection**: Use existing `isIOS()` from `src/services/streamSaver.ts` and `isAndroidMobileChrome()` pattern
2. **URL Construction Helper** (CRITICAL FIX):
   ```typescript
   const buildAbsoluteUrl = (url: string): string => {
     if (url.startsWith('http://') || url.startsWith('https://')) return url;
     const origin = getBackendOrigin(); // https://chillers-production-eace.up.railway.app
     return url.startsWith('/') ? `${origin}${url}` : `${origin}/${url}`;
   };
   ```
3. **iOS Download Path**: Call `toIOSDownloadHref()` → build absolute URL → `triggerAttachmentDownload(absoluteUrl)` → auto-close after 2000ms
4. **Desktop/Android Path**: Delegate to `streamDownloadToDisk()` from `src/services/streamSaver.ts`
5. **State Management**: `{ isDownloading, progress: { downloaded, total }, error }`
6. **AbortController**: Store in hook state, abort on `cancelDownload()`
7. **Progress Tracking**: Wire `onProgress` callback from `streamDownloadToDisk` to update state
8. **Error Handling**: Catch AbortError separately, user-friendly messages for network errors

**API Signature**:
```typescript
interface UnifiedDownloadOptions {
  url: string;
  filename: string;
  onProgress?: (downloaded: number, total: number | null) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  debug?: boolean;
}

function useUnifiedDownload() {
  return {
    startDownload: (options: UnifiedDownloadOptions) => Promise<void>,
    cancelDownload: () => void,
    isDownloading: boolean,
    progress: { downloaded: number, total: number | null },
    error: Error | null
  };
}
```

**Verify**: Read the file and grep for `getBackendOrigin`, `isIOS`, `triggerAttachmentDownload`, `streamDownloadToDisk`, `AbortController`.

---

### FEAT-002: Integration Across Call Sites ✅ Priority 2

**What**: Replace all existing download logic with `useUnifiedDownload` and fix service-layer helpers.

**Files to Modify**:
1. **`src/services/downloads.ts`** (Root Cause Fix at Service Layer):
   - `toIOSDownloadHref()`: Change return from `` `${API_BASE_PATH}/download/file?...` `` to `` `${getBackendOrigin()}/api/download/file?...` ``
   - `triggerAttachmentDownload()`: Prepend `getBackendOrigin()` if href is relative: `const absoluteHref = href.startsWith('http') ? href : \`${getBackendOrigin()}${href}\``

2. **`src/components/VideoPlayer.tsx`**:
   - In `handleDirectDownload()` (lines ~850-900), replace the iOS-specific `window.location.href = fullUrl` logic with:
     ```typescript
     const { startDownload } = useUnifiedDownload();
     // ... inside handleDirectDownload
     if (isIOS) {
       startDownload({ url: directDl, filename, onComplete: () => {}, onError: console.error });
       return;
     }
     ```

3. **`src/features/downloads/DownloadModal.tsx`**:
   - Import `useUnifiedDownload` at the top
   - For the iOS button `onClick` handler (lines 135-150), replace `triggerAttachmentDownload(href)` with:
     ```typescript
     const unifiedDl = useUnifiedDownload();
     // ... in onClick
     unifiedDl.startDownload({ url: dl.task.resolvedUrl, filename, onComplete: () => onClose() });
     ```

4. **`src/hooks/useDownloadsBatch.ts`**:
   - In `launchReady()` callback (lines 201-217), replace the manual `triggerAttachmentDownload(href)` with:
     ```typescript
     const unifiedDl = useUnifiedDownload();
     unifiedDl.startDownload({ url, filename, onComplete: () => updateTask(id, { launchedAt: Date.now() }) });
     ```

**What to Preserve**:
- Existing batch pool logic (MAX_CONCURRENT_DOWNLOADS, scheduler)
- Zustand store state shape (DownloadTask, status, progress)
- Modal UI (language selection, status display, retry buttons)
- Existing `useDownload` hook (keep for now, gradual migration)

**Verify**: 
- Grep for `getBackendOrigin` in `src/services/downloads.ts` (2 occurrences)
- Grep for `useUnifiedDownload` in `VideoPlayer.tsx`, `DownloadModal.tsx`, `useDownloadsBatch.ts`
- Run `npm run build` and confirm no TypeScript errors
- Manual test: open VideoPlayer on iOS simulator, trigger download, check browser console for absolute backend URL

---

### FEAT-003: Unit Tests ✅ Priority 3

**What**: Comprehensive Jest + @testing-library/react tests for the new hook.

**Files to Create**:
- `src/hooks/__tests__/useUnifiedDownload.test.ts`

**Test Cases** (9 minimum):
1. **iOS Detection**: Mock `isIOS()` → true, call `startDownload()`, assert `triggerAttachmentDownload` called
2. **iOS Absolute URL Construction**: Mock `getBackendOrigin()` → 'https://test-backend.railway.app', pass relative URL, assert absolute URL passed to `triggerAttachmentDownload`
3. **Desktop Path**: Mock `isIOS()` → false, call `startDownload()`, assert `streamDownloadToDisk` called
4. **Progress Tracking**: Mock `streamDownloadToDisk` to call `onProgress(500, 1000)`, assert `hook.progress.downloaded === 500`, `hook.progress.total === 1000`
5. **Cancellation**: Call `startDownload()`, then `cancelDownload()`, assert `AbortController.abort()` called and `isDownloading === false`
6. **Error Handling**: Mock `streamDownloadToDisk` to throw, assert `hook.error` is set
7. **onComplete Callback**: Mock success, pass `onComplete` spy, assert spy called once
8. **onError Callback**: Mock failure, pass `onError` spy, assert spy called with error
9. **Android Mobile Chrome**: Mock `isAndroidMobileChrome()` → true, assert native Blob download path used

**Test Setup**:
```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUnifiedDownload } from '../useUnifiedDownload';

jest.mock('@/services/streamSaver', () => ({
  isIOS: jest.fn(() => false),
  isAndroidMobileChrome: jest.fn(() => false),
  streamDownloadToDisk: jest.fn(() => Promise.resolve({ totalBytes: 1000 })),
}));

jest.mock('@/services/downloads', () => ({
  triggerAttachmentDownload: jest.fn(),
  toIOSDownloadHref: jest.fn((url) => url),
}));

jest.mock('@/services/http', () => ({
  getBackendOrigin: jest.fn(() => 'https://test-backend.railway.app'),
}));
```

**Verify**: Run `npm test -- useUnifiedDownload.test.ts` and confirm all tests pass.

---

## Test Commands

```bash
# Run unit tests for the hook
npm test -- useUnifiedDownload.test.ts

# Run all tests
npm test

# Build check (TypeScript compilation)
npm run build

# Manual iOS test
# 1. Open iOS Simulator (Xcode)
# 2. Navigate to http://localhost:3000/watch/...
# 3. Click download button
# 4. Open Safari Web Inspector → Console
# 5. Verify log shows "https://chillers-production-eace.up.railway.app/api/download/..."
```

---

## Verification Checklist

- [ ] `useUnifiedDownload.ts` exists with complete JSDoc
- [ ] Hook uses `getBackendOrigin()` for iOS absolute URLs
- [ ] `toIOSDownloadHref()` and `triggerAttachmentDownload()` fixed in `downloads.ts`
- [ ] VideoPlayer, DownloadModal, useDownloadsBatch integrated
- [ ] All unit tests pass (9+ test cases)
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] Manual iOS test confirms absolute backend URLs in console logs
- [ ] Existing download flows (language selection, retry, cancel) still work

---

## Rollback Plan

If the changes break production:

1. **Quick Fix**: Revert `src/services/downloads.ts` changes to restore old `toIOSDownloadHref()` and `triggerAttachmentDownload()`
2. **Component Rollback**: Remove `useUnifiedDownload` calls from VideoPlayer, DownloadModal, useDownloadsBatch
3. **Full Rollback**: `git revert <commit-hash>` for all unified download changes

The old code paths remain in place during gradual migration, so partial rollback is safe.

---

## Post-Deployment Monitoring

1. **iOS Downloads**: Monitor CloudWatch/Railway logs for `/api/download/file` requests from iOS user agents
2. **Error Rate**: Track download failure rate in Sentry/error tracking
3. **User Reports**: Watch support channels for "download opens wrong page" reports
4. **Backend Load**: Monitor Railway backend CPU/memory during iOS download spikes

---

## Future Enhancements (Out of Scope)

- Migrate existing `useDownload` hook to use `useUnifiedDownload` internally (backward-compatible refactor)
- Add download queue UI showing all in-flight downloads
- Add download retry with exponential backoff
- Add download resume for interrupted downloads (Range requests)
- Add P2P download for large files (WebTorrent fallback)

---

**END OF PLAN**
