# Implementation Plan: Admin Subscription Control System

## Overview

This implementation plan breaks down the global subscription toggle feature into discrete TypeScript/Express tasks. The architecture uses a service-based pattern with MongoDB persistence, in-memory caching for sub-10ms feature gate checks, and comprehensive audit logging. Each task is sequenced to build incrementally from database models through API endpoints to feature gate integration and testing.

---

## Tasks

### Phase 1: Database Models and Collections

- [x] 1. Create SystemSettings MongoDB Model and Schema
  - Create `backend/src/models/SystemSettings.ts` with interface extending Document
  - Define fields: settingKey (unique index), value (boolean), lastUpdatedBy, lastUpdatedAt, createdAt
  - Add indexes: unique index on settingKey, index on lastUpdatedAt
  - Export model for use in service layer
  - _Requirements: 7.1, 7.2, 7.5_

- [x] 2. Create AuditLog MongoDB Model and Schema
  - Create `backend/src/models/AuditLog.ts` with interface extending Document
  - Define fields: action, adminId, adminEmail, previousState, newState, timestamp, httpStatusCode, requestIpAddress, userAgent, success, errorMessage
  - Add indexes: descending index on timestamp (for chronological sorting), index on adminId, index on action
  - Export model for use in service layer
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 3. Initialize SystemSettings with Default Values
  - Create `backend/src/scripts/init-system-settings.ts` that runs on application startup
  - Check if SystemSettings document exists with settingKey='global_subscription_enabled'
  - If not found, create document with value=true (default: subscriptions enabled), timestamp=now
  - Call this initialization function in `app.ts` before starting server
  - Log initialization completion
  - _Requirements: 7.2, 7.3_

### Phase 2: Backend Service Layer

- [x] 4. Create GlobalSubscriptionService with State Management
  - Create `backend/src/services/global-subscription.service.ts`
  - Implement constructor with in-memory cache initialization (Map, TTL 5 minutes)
  - Implement `getGlobalState()` method:
    - Check in-memory cache first
    - If cache miss, query SystemSettings from database using findOne with settingKey filter
    - Cache the result with 5-minute TTL
    - Return {enabled: boolean, cachedAt?: Date}
    - On database error: log error, return {enabled: true} (fail-safe)
  - _Requirements: 1.6, 7.3, 7.4, 10.1, 10.3_

- [x] 5. Implement GlobalSubscriptionService State Mutation
  - Add `setGlobalState(enabled: boolean, adminId: string, adminEmail: string, ipAddress: string, userAgent?: string)` method
  - Fetch current state from database (read before write for previousState)
  - Atomically update SystemSettings document using findOneAndUpdate with filter on settingKey
  - Update fields: value=enabled, lastUpdatedBy=adminId, lastUpdatedAt=now
  - On write success: call invalidateCache()
  - On write failure: don't invalidate cache, throw error with context for logging
  - Return {success: boolean, previousState: boolean, newState: boolean, message: string}
  - _Requirements: 1.3, 7.6, 9.2_

- [x] 6. Implement AuditLog Creation in GlobalSubscriptionService
  - Add `createAuditLog(adminId: string, adminEmail: string, previousState: boolean, newState: boolean, ipAddress: string, httpStatusCode: number, userAgent?: string, success: boolean, errorMessage?: string)` method
  - Create new AuditLog document with all parameters
  - Save to AuditLog collection
  - Handle creation errors gracefully (log but don't throw, to prevent toggle failure if audit fails)
  - _Requirements: 6.1, 6.4_

- [x] 7. Implement AuditLog Retrieval in GlobalSubscriptionService
  - Add `getAuditHistory(limit: number = 100)` method
  - Query AuditLog collection, filter by action='subscription_toggle'
  - Sort by timestamp descending (most recent first)
  - Apply limit (max 500 to prevent abuse)
  - Return array of audit logs
  - On database error: log error and return empty array
  - _Requirements: 6.4, 6.5_

- [x] 8. Implement Cache Invalidation with Lock Prevention
  - Add `invalidateCache()` method to GlobalSubscriptionService
  - Clear in-memory cache entry for global_subscription_enabled
  - If Redis is available: publish invalidation event (for distributed systems)
  - On Redis error: log but don't throw (eventual consistency)
  - If concurrent reload requests in flight: use Promise chaining to share result (single DB query)
  - _Requirements: 7.5, 7.6, 10.4_

- [x] 9. Implement Service Error Handling and Fallback Behavior
  - Update all service methods to catch and log database errors without exposing internals
  - Feature gate checks on database error: log error and assume subscriptions enabled (fail-safe)
  - Toggle operations on database error: return error response and don't invalidate cache
  - Implement timeout handling for long-running queries (5 second timeout)
  - _Requirements: 9.1, 9.3, 10.1_

### Phase 3: API Controller Layer

- [~] 10. Create SubscriptionStateController - GET Endpoint
  - Create `backend/src/modules/admin/subscription-state.controller.ts` (or extend subscription.controller.ts)
  - Implement `getGlobalState(req: Request, res: Response)` handler:
    - Call GlobalSubscriptionService.getGlobalState()
    - Return JSON: {success: true, globalSubscriptionEnabled: boolean, cachedAt?: Date}
    - On error: return HTTP 500 with {success: false, message: 'Service error'}
    - Endpoint target: GET /admin/subscriptions/global-state
  - _Requirements: 1.6, 4.1, 4.2_

- [~] 11. Create SubscriptionStateController - POST Endpoint
  - Implement `setGlobalState(req: AuthRequest, res: Response)` handler in SubscriptionStateController:
    - Extract adminId and adminEmail from req.admin (verified by adminMiddleware)
    - Extract ipAddress from req.ip and userAgent from req.get('user-agent')
    - Parse request body: { enabled: boolean }
    - Validate that enabled is boolean type, return HTTP 400 if not
    - Call GlobalSubscriptionService.setGlobalState()
    - On success: create audit log entry via GlobalSubscriptionService.createAuditLog()
    - Return HTTP 200: {success: true, globalSubscriptionEnabled: boolean, previousState: boolean, message: string, updatedAt: Date}
    - On validation error: return HTTP 400 with error details
    - On service error: return HTTP 500 with generic error message
    - Endpoint target: POST /admin/subscriptions/global-state
  - _Requirements: 1.3, 4.3, 4.4, 4.5, 6.1_

- [~] 12. Create SubscriptionStateController - Audit History Endpoint
  - Implement `getAuditHistory(req: Request, res: Response)` handler:
    - Extract query parameter limit (default 100, max 500)
    - Call GlobalSubscriptionService.getAuditHistory(limit)
    - Return HTTP 200: {success: true, auditLogs: array of {id, adminEmail, previousState, newState, timestamp, httpStatusCode, requestIpAddress}}
    - On error: return HTTP 500 with generic error message
    - Endpoint target: GET /admin/subscriptions/audit-history
  - _Requirements: 6.4, 6.5_

- [x] 13. Register New Routes in admin.routes.ts
  - Add route definitions to `backend/src/modules/admin/admin.routes.ts`:
    - GET /subscriptions/global-state → adminMiddleware → getGlobalState
    - POST /subscriptions/global-state → adminMiddleware → setGlobalState
    - GET /subscriptions/audit-history → adminMiddleware → getAuditHistory
  - Ensure adminMiddleware is applied before all handlers for auth verification
  - Test routes are registered by calling them in a test client
  - _Requirements: 1.7, 4.6_

### Phase 4: Feature Gate Integration

- [x] 14. Create Feature Gate Middleware
  - Create `backend/src/middleware/premium-feature-gate.middleware.ts`
  - Implement middleware that runs on all premium feature routes:
    - Get global subscription state from GlobalSubscriptionService (cached, <10ms)
    - If global state is OFF: return HTTP 403 {success: false, message: 'Premium features are currently disabled'}
    - If global state is ON: check user subscription from req.user.subscription
    - If user has active premium: call next() to allow access
    - If user doesn't have active premium or subscription is null/expired: return HTTP 403 {success: false, message: 'Premium subscription required'}
    - On service error: log error and return HTTP 403 (fail-safe: deny access)
  - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7, 10.1_

- [x] 15. Integrate Feature Gate into Streaming Routes
  - Update `backend/src/streaming/streaming.routes.ts` to apply premium-feature-gate middleware:
    - Apply middleware to 1080p quality routes
    - Apply middleware to download routes
    - Apply middleware to any other premium streaming features
  - Test that middleware is invoked before reaching stream handlers
  - _Requirements: 2.1, 2.2, 8.1_

- [x] 16. Integrate Feature Gate into Movie/Series Detail Routes
  - Update movie and series controllers to check premium requirements:
    - In `backend/src/modules/movies/movies.controller.ts` or similar location where movie/series details are retrieved
    - For premium content: check global state before returning details
    - If global state is OFF: return HTTP 403 regardless of user subscription
    - If user tries to access premium feature when global is ON but user lacks subscription: return HTTP 403
  - _Requirements: 2.1, 2.3, 8.1_

### Phase 5: Frontend Implementation

- [x] 17. Create GlobalSubscriptionToggle React Component
  - Create `src/components/admin/GlobalSubscriptionToggle.tsx`
  - Component props: onToggle?: (newState: boolean) => void
  - Component state: {enabled: boolean, loading: boolean, error?: string, successMessage?: string}
  - On mount: fetch current state via GET /admin/subscriptions/global-state
  - Display current state clearly (e.g., "Subscriptions: ON" or "Subscriptions: OFF")
  - Implement toggle handler that:
    - Shows loading state (spinner, disabled button)
    - Sends POST /admin/subscriptions/global-state with {enabled: newState}
    - On success: show success notification, update UI to reflect new state
    - On failure: show error notification, immediately revert toggle to reflect server state
  - Make component responsive for desktop and tablet
  - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 18. Create Admin Subscriptions Page
  - Create `src/app/admin/subscriptions/page.tsx` (or update existing admin settings page)
  - Import and render GlobalSubscriptionToggle component
  - Display current state and toggle control prominently
  - Add optional: Audit history list (most recent 20 changes) if toggle feature is fully enabled
  - Implement responsive layout (desktop + tablet friendly)
  - Add proper error boundaries and loading states
  - _Requirements: 5.1, 5.7, 5.8_

### Phase 6: Testing - Property-Based and Unit Tests

- [~] 19.* Write Property-Based Tests for Idempotence
  - Create `backend/src/__tests__/services/global-subscription.properties.test.ts`
  - Implement test for Property 1: Idempotent Toggle
    - **Property 1: Idempotent Toggle**
    - **Validates: Requirements 1.3, 4.3**
    - Generate random sequence of boolean states, toggle to same state multiple times
    - Verify final state matches the expected state, not alternating
    - Verify multiple identical POSTs return identical responses
  - _Requirements: 1.3, 4.3_

- [~] 20.* Write Property-Based Tests for State Consistency
  - Implement test for Property 2: State Retrieval Consistency
    - **Property 2: State Retrieval Consistency**
    - **Validates: Requirements 1.6, 4.4**
    - For any sequence of POST updates, GET immediately after must return exact posted state
    - Generate random valid state transitions, POST each, GET after each, verify equality
  - _Requirements: 1.6, 4.4_

- [~] 21.* Write Property-Based Tests for Feature Gate Logic
  - Implement test for Property 3: Global State Feature Gate Effect
    - **Property 3: Global State Feature Gate Effect**
    - **Validates: Requirements 2.1, 2.2, 2.3**
    - When global state is OFF: all users denied, including premium
    - When global state is ON: only premium users with active subscriptions granted
    - Generate random user subscription states, random global states, verify gate decisions
  - _Requirements: 2.1, 2.2, 2.3_

- [~] 22.* Write Property-Based Tests for Subscription Data Preservation
  - Implement test for Property 4: User Subscription Data Preservation
    - **Property 4: User Subscription Data Preservation**
    - **Validates: Requirements 3.1, 3.2, 3.6**
    - For any user subscription and sequence of toggles, data unchanged
    - Round-trip property: toggle OFF then ON = original state
    - Generate random subscription data, toggle multiple times, verify data integrity
  - _Requirements: 3.1, 3.2, 3.6_

- [~] 23.* Write Property-Based Tests for Feature Gate Updates
  - Implement test for Property 5: Immediate Feature Gate Updates
    - **Property 5: Immediate Feature Gate Updates**
    - **Validates: Requirements 2.8, 8.1, 8.2**
    - When global transitions OFF→ON: subsequent checks grant access to premium users
    - When global transitions ON→OFF: subsequent checks deny access to all
    - Generate state transitions, verify subsequent gate checks reflect new state immediately
  - _Requirements: 2.8, 8.1, 8.2_

- [~] 24.* Write Property-Based Tests for Audit Log Ordering
  - Implement test for Property 6: Audit Log Immutability and Ordering
    - **Property 6: Audit Log Immutability and Ordering**
    - **Validates: Requirements 6.1, 6.5**
    - For any sequence of state changes, audit logs created in order
    - Retrieving logs returns reverse chronological (most recent first)
    - Generate random toggle sequence, verify audit trail is correct and immutable
  - _Requirements: 6.1, 6.5_

- [~] 25.* Write Property-Based Tests for Cache Invalidation
  - Implement test for Property 7: Cache Invalidation Correctness
    - **Property 7: Cache Invalidation Correctness**
    - **Validates: Requirements 7.5, 7.6**
    - After state change, cache returns new state (not stale)
    - Generate state changes with concurrent reads, verify cache coherency
  - _Requirements: 7.5, 7.6_

- [~] 26.* Write Property-Based Tests for Authentication and Authorization
  - Implement test for Property 8: Authentication and Authorization
    - **Property 8: Authentication and Authorization**
    - **Validates: Requirements 1.7, 4.6**
    - Unauthenticated/non-admin requests return 401 and don't modify state
    - Generate invalid tokens, non-admin users, verify rejection
  - _Requirements: 1.7, 4.6_

- [~] 27.* Write Property-Based Tests for No Automatic Subscription Expiration
  - Implement test for Property 9: No Automatic Subscription Expiration
    - **Property 9: No Automatic Subscription Expiration**
    - **Validates: Requirements 3.3, 3.5**
    - When global is OFF: subscriptions not auto-expired
    - Generate toggle sequences, verify subscription expiration fields unchanged
  - _Requirements: 3.3, 3.5_

- [~] 28.* Write Property-Based Tests for Error Safety
  - Implement test for Property 10: Error Safety
    - **Property 10: Error Safety**
    - **Validates: Requirements 9.1, 9.3, 9.4**
    - On database errors: access denied (fail-safe) and state not corrupted
    - Generate error scenarios (connection failure, timeout), verify safe response
  - _Requirements: 9.1, 9.3, 9.4_

- [~] 29. Write Unit Tests for Controller - GET Endpoint
  - Create test file `backend/src/__tests__/modules/admin/subscription-state.controller.test.ts`
  - Test getGlobalState():
    - Successfully returns current state with HTTP 200
    - Returns {success: true, globalSubscriptionEnabled: boolean}
    - Handles service errors gracefully with HTTP 500
  - _Requirements: 1.6, 4.1, 4.2_

- [~] 30. Write Unit Tests for Controller - POST Endpoint
  - Test setGlobalState():
    - Validates request body (enabled must be boolean)
    - Returns HTTP 400 on validation failure
    - Creates audit log on successful toggle
    - Returns HTTP 200 with correct response format
    - Handles authorization errors (requires adminMiddleware verification)
  - _Requirements: 4.3, 4.4, 4.5, 6.1_

- [~] 31. Write Unit Tests for Controller - Audit History Endpoint
  - Test getAuditHistory():
    - Returns audit logs in reverse chronological order
    - Respects limit parameter (default 100, max 500)
    - Returns HTTP 200 with correct response format
    - Handles service errors gracefully
  - _Requirements: 6.4, 6.5_

- [~] 32. Write Unit Tests for GlobalSubscriptionService
  - Test getGlobalState():
    - Returns cached state on cache hit (<10ms)
    - Queries database on cache miss
    - Handles database errors by returning enabled=true (fail-safe)
    - Repopulates cache after miss
  - Test setGlobalState():
    - Reads previous state before writing
    - Atomically updates database
    - Invalidates cache on success
    - Doesn't invalidate cache on failure
  - Test invalidateCache():
    - Clears in-memory cache
    - Subsequent calls hit database
  - _Requirements: 1.3, 7.4, 7.5, 7.6, 10.1_

- [~] 33. Write Unit Tests for Feature Gate Middleware
  - Test middleware behavior:
    - Denies access when global state is OFF
    - Checks user subscription when global state is ON
    - Grants access to premium users with active subscriptions
    - Denies access to free tier users
    - Denies access on service error (fail-safe)
    - Returns appropriate HTTP 403 responses
  - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7, 10.1_

### Phase 7: Testing - Integration Tests

- [~] 34.* Write Integration Tests - Database Persistence
  - Create `backend/src/__tests__/integration/subscription-persistence.test.ts`
  - Test that state survives application restart:
    - Set global state to OFF via API
    - Restart application (or simulate by reloading service)
    - Verify state is still OFF (read from database directly)
    - Test both ON and OFF states
  - _Requirements: 1.5, 7.2, 7.3_

- [~] 35.* Write Integration Tests - Audit Logging End-to-End
  - Create `backend/src/__tests__/integration/audit-logging.test.ts`
  - Test complete audit trail:
    - Toggle state multiple times via API
    - Retrieve audit history
    - Verify each state change is logged with correct details
    - Verify logs are immutable (old logs unchanged)
    - Verify logs in correct chronological order
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [~] 36.* Write Integration Tests - Feature Gate Routing Integration
  - Create `backend/src/__tests__/integration/feature-gate-routing.test.ts`
  - Test feature gate with actual route handlers:
    - Set global state to OFF
    - Request premium feature, verify denied with 403
    - Set global state to ON
    - Request with premium user, verify allowed
    - Request with free user, verify denied
  - _Requirements: 2.1, 2.2, 2.3, 8.1_

- [~] 37.* Write Integration Tests - Cache Invalidation End-to-End
  - Create `backend/src/__tests__/integration/cache-invalidation.test.ts`
  - Test cache behavior:
    - Make GET request (cache miss, populate cache)
    - Make second GET request (cache hit, verify <10ms latency)
    - Make POST to toggle state (cache invalidation)
    - Make GET request (cache miss, verify new state)
  - _Requirements: 7.5, 7.6, 10.1, 10.3_

- [~] 38.* Write Integration Tests - Concurrent Request Handling
  - Create `backend/src/__tests__/integration/concurrent-requests.test.ts`
  - Test concurrent feature gate checks:
    - Simulate 1000+ concurrent requests
    - Verify latency <10ms (p99) for cache hits
    - Toggle state and verify cache invalidation handling
    - Verify no race conditions or data corruption
  - _Requirements: 10.2, 10.4_

### Phase 8: Performance and Load Testing

- [~] 39.* Write Performance Test - Cache Hit Latency
  - Create `backend/src/__tests__/performance/cache-hit-latency.test.ts`
  - Test that cached feature gate checks are <10ms at 1000 req/sec:
    - Warm up cache with initial read
    - Simulate 1000+ concurrent requests for feature gate check
    - Measure response time distribution (p50, p95, p99)
    - Verify p99 latency < 10ms
    - Verify no database queries during test
  - _Requirements: 10.1, 10.3, 10.4_

- [~] 40.* Write Performance Test - API Update Latency
  - Create `backend/src/__tests__/performance/api-update-latency.test.ts`
  - Test that state updates complete within 500ms:
    - Make POST request to toggle state
    - Measure response time
    - Verify <500ms latency
    - Verify database write completed
    - Verify cache invalidation completed
  - _Requirements: 1.4, 10.2_

- [~] 41.* Write Load Test - 1000 Requests Per Second
  - Create `backend/src/__tests__/load/sustained-load.test.ts`
  - Test sustained load handling:
    - Generate 1000+ requests/sec to feature gate endpoint
    - Maintain for 10+ seconds
    - Verify no errors or timeouts
    - Verify latency distribution acceptable
    - Verify no memory leaks
  - _Requirements: 10.1, 10.2, 10.4_

### Phase 9: Checkpoint and Final Validation

- [~] 42. Checkpoint - Ensure All Tests Pass
  - Run full test suite: `npm test` or `yarn test` (with watch mode disabled)
  - Verify all unit tests pass (20+ tests)
  - Verify all property-based tests pass (10+ properties)
  - Verify all integration tests pass (5+ scenarios)
  - Verify all performance tests meet targets
  - Ask the user if questions arise
  - _Requirements: All (cross-cutting)_

### Phase 10: Documentation and Integration

- [~] 43. Document New APIs
  - Update backend API documentation (if exists in project):
    - Document GET /admin/subscriptions/global-state endpoint
    - Document POST /admin/subscriptions/global-state endpoint
    - Document GET /admin/subscriptions/audit-history endpoint
  - Include request/response examples from design document
  - Note authentication requirement (adminMiddleware)
  - _Requirements: 1.2, 4.1, 4.2_

- [~] 44. Create Migration Script for Existing Deployments
  - Create `backend/src/scripts/migrate-system-settings.ts`
  - Script ensures SystemSettings collection exists and is properly initialized
  - Can be run on existing deployments without data loss
  - Creates indexes if missing
  - Logs migration results
  - _Requirements: 7.1, 7.2_

- [~] 45. Update Deployment Checklist
  - Document deployment steps:
    - Ensure MongoDB indexes are created (systemSettings.settingKey unique)
    - Run migration script: `npm run migrate:system-settings`
    - Verify cache is functioning properly (Redis optional)
    - Test toggle endpoint manually before pushing to production
    - Verify feature gate is blocking premium features appropriately
  - _Requirements: 1.5, 7.1_

- [~] 46. Verify Backward Compatibility
  - Test that existing subscription functionality still works:
    - User subscription CRUD operations unchanged
    - Existing subscription checks still work (non-global)
    - Payment proof system still works
    - No breaking changes to User model
  - Verify existing feature gating logic coexists with new global gate
  - _Requirements: 3.1, 3.2, 3.6_

---

## Notes

- Tasks marked with `*` are optional tests and can be skipped for faster MVP development
- All required tasks (without `*`) must be completed for feature to be production-ready
- Tests are essential for correctness guarantee validation
- Each task references specific requirements for full traceability
- Service layer provides single source of truth for global state
- Caching strategy ensures performance targets (sub-10ms reads)
- Fail-safe design: on errors, subscriptions enabled (business-safe default)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2", "3"] },
    { "id": 1, "tasks": ["4", "5", "6", "7", "8", "9"] },
    { "id": 2, "tasks": ["10", "11", "12", "13"] },
    { "id": 3, "tasks": ["14", "15", "16"] },
    { "id": 4, "tasks": ["17", "18"] },
    { "id": 5, "tasks": ["19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33"] },
    { "id": 6, "tasks": ["34", "35", "36", "37", "38"] },
    { "id": 7, "tasks": ["39", "40", "41"] },
    { "id": 8, "tasks": ["42", "43", "44", "45", "46"] }
  ]
}
```

---

## Execution Instructions

1. **Review this task list** and ensure all requirements are understood
2. **Begin with Wave 0** (database models) - these are prerequisites for everything
3. **Progress sequentially through waves** - each wave depends on previous waves
4. **Run tests immediately** after implementing each component
5. **Optional tests** (marked with `*`) can be skipped for MVP but should be included for production
6. **Stop at any checkpoint** and ask for clarification if needed
7. **Use the task list UI** to mark tasks complete as you implement them

## Testing Strategy Summary

- **Property-Based Tests (10)**: Validate correctness properties using generative testing
- **Unit Tests (15+)**: Test individual functions with examples and edge cases
- **Integration Tests (5+)**: Test end-to-end flows and data persistence
- **Performance Tests (3+)**: Validate latency targets (sub-10ms reads, sub-500ms updates)
- **Load Tests**: Verify 1000+ req/sec handling without degradation
