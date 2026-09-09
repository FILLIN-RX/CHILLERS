# Admin Subscription Control System - Technical Design Document

## Overview

The Admin Subscription Control System provides a global ON/OFF toggle that allows administrators to disable the entire subscription system platform-wide, treating all users as free tier. This feature enables operational flexibility for business model transitions, maintenance, and testing. The design prioritizes data preservation, atomic state updates, real-time feature gating updates, and comprehensive audit logging.

**Key Objectives:**
- Atomic global subscription state management with persistent storage
- Real-time feature gating without user re-authentication
- Complete user subscription data preservation during toggles
- Sub-10ms cached feature gate checks and sub-500ms API updates
- Comprehensive audit logging of all state changes
- Support for 1000+ concurrent requests per second

---

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Admin Panel (React)                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Subscription Toggle Component                          │ │
│  │  - Display current state                                │ │
│  │  - Toggle control with loading feedback                 │ │
│  │  - Error/success notifications                          │ │
│  └──────────────────┬──────────────────────────────────────┘ │
└─────────────────────┼──────────────────────────────────────────┘
                      │ HTTP POST/GET
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     Express Backend                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Admin Routes & Middleware                              │ │
│  │  - /admin/subscriptions/global-state (GET/POST)         │ │
│  │  - /admin/subscriptions/audit-history (GET)             │ │
│  │  - adminMiddleware for auth & authorization             │ │
│  └────────────────┬────────────────────────────────────────┘ │
│                   │                                           │
│  ┌────────────────▼────────────────────────────────────────┐ │
│  │  Global Subscription Service                            │ │
│  │  - Get/Set global state                                 │ │
│  │  - Cache management (in-memory/Redis)                   │ │
│  │  - Audit log creation                                   │ │
│  └────────────────┬────────────────────────────────────────┘ │
│                   │                                           │
│  ┌────────────────▼────────────────────────────────────────┐ │
│  │  Feature Gate Checker (all feature routes)              │ │
│  │  - Check global state (cached, <10ms)                   │ │
│  │  - Check user subscription if global state is ON        │ │
│  │  - Grant/deny premium feature access                    │ │
│  └────────────────┬────────────────────────────────────────┘ │
└─────────────────────┼──────────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌───────────────────┐      ┌───────────────────┐
│  MongoDB         │      │  Cache (Redis or  │
│                  │      │  Node Memory)     │
│  - SystemSettings│      │                   │
│  - AuditLog      │      │  Global State:    │
│  - User          │      │  - enabled: bool  │
│  - PaymentProof  │      │  - timestamp      │
│  - DeadLink etc  │      │  - TTL: 5min      │
└───────────────────┘      └───────────────────┘
```

### Component Interaction Flow

```
1. Admin Toggle Sequence:
   Admin clicks toggle → UI sends POST → adminMiddleware verifies auth
   → GlobalSubscriptionController updates state → Database writes
   → Cache invalidates → Response returns → UI reflects new state

2. Feature Gate Check (every premium request):
   User requests premium feature → Feature gate middleware
   → Check cache for global state (hit or miss) → If miss, read DB
   → Check user subscription (if global ON) → Grant/deny access
   → Return response with appropriate status

3. Cache Consistency:
   Database write → Cache key invalidated → Next read hits DB
   → Cache repopulated → Subsequent reads hit cache (sub-10ms)
```

---

## Components and Interfaces

### 1. Database Schema (MongoDB)

#### SystemSettings Collection

```typescript
interface ISystemSettings extends Document {
  settingKey: 'global_subscription_enabled'; // Unique identifier
  value: boolean;                             // true = subscriptions enabled, false = disabled
  lastUpdatedBy: string;                      // Admin user ID
  lastUpdatedAt: Date;                        // Timestamp of last change
  createdAt: Date;                            // Initial creation time
}

// Indexes:
// - settingKey: unique index
// - lastUpdatedAt: index for audit queries
```

MongoDB Collection Definition:
```json
{
  "_id": ObjectId,
  "settingKey": "global_subscription_enabled",
  "value": true,
  "lastUpdatedBy": "admin-user-id-123",
  "lastUpdatedAt": "2024-01-15T10:30:00Z",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### AuditLog Collection

```typescript
interface IAuditLog extends Document {
  action: 'subscription_toggle';
  adminId: string;
  adminEmail: string;
  previousState: boolean;
  newState: boolean;
  timestamp: Date;
  httpStatusCode: number;
  requestIpAddress: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

// Indexes:
// - timestamp: descending index (for sorting recent changes)
// - adminId: for filtering by admin
// - action: for filtering by action type
```

MongoDB Collection Definition:
```json
{
  "_id": ObjectId,
  "action": "subscription_toggle",
  "adminId": "user-123",
  "adminEmail": "admin@example.com",
  "previousState": true,
  "newState": false,
  "timestamp": "2024-01-15T10:30:00Z",
  "httpStatusCode": 200,
  "requestIpAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "success": true,
  "errorMessage": null
}
```

### 2. Service Layer Architecture

#### GlobalSubscriptionService

**Location:** `backend/src/services/global-subscription.service.ts`

```typescript
interface GlobalSubscriptionService {
  // Get current global subscription state
  getGlobalState(): Promise<{
    enabled: boolean;
    cachedAt?: Date;
  }>;

  // Set global subscription state with audit logging
  setGlobalState(
    enabled: boolean,
    adminId: string,
    adminEmail: string,
    ipAddress: string,
    userAgent?: string
  ): Promise<{
    success: boolean;
    previousState: boolean;
    newState: boolean;
    message: string;
  }>;

  // Get audit log history (most recent first)
  getAuditHistory(limit?: number): Promise<IAuditLog[]>;

  // Initialize default state on first run
  initializeDefaultState(): Promise<void>;

  // Invalidate cache (called after state change)
  invalidateCache(): Promise<void>;
}
```

**Key Implementation Details:**
- Uses lazy initialization pattern (creates SystemSettings document on first request)
- Implements two-tier caching:
  - L1: Node.js in-memory cache (fast, simple)
  - L2: Redis (optional, for distributed systems)
- Default state: `true` (subscriptions enabled)
- Cache TTL: 5 minutes (configurable)
- Fallback behavior: if cache miss and DB error, assume subscriptions enabled (safe default)

### 3. API Controller Layer

#### SubscriptionStateController

**Location:** `backend/src/modules/admin/subscription-state.controller.ts`

```typescript
// GET /admin/subscriptions/global-state
// Returns current global subscription state
interface GetGlobalStateResponse {
  success: boolean;
  globalSubscriptionEnabled: boolean;
  cachedAt?: Date;
}

// POST /admin/subscriptions/global-state
// Updates global subscription state
interface PostGlobalStateRequest {
  enabled: boolean; // Must be boolean, not truthy/falsy
}

interface PostGlobalStateResponse {
  success: boolean;
  globalSubscriptionEnabled: boolean;
  previousState: boolean;
  message: string;
  updatedAt: Date;
}

// GET /admin/subscriptions/audit-history
// Returns audit log of subscription state changes
interface GetAuditHistoryResponse {
  success: boolean;
  auditLogs: {
    id: string;
    adminEmail: string;
    previousState: boolean;
    newState: boolean;
    timestamp: Date;
    httpStatusCode: number;
    requestIpAddress: string;
  }[];
}
```

### 4. Feature Gate Middleware

**Location:** `backend/src/middleware/feature-gate.middleware.ts`

```typescript
// This middleware is applied to all premium feature routes
interface FeatureGateRequest extends Request {
  user?: {
    id: string;
    subscription: {
      plan: 'free' | 'standard' | 'premium';
      status: 'active' | 'inactive' | 'cancelled';
      expiresAt?: Date;
    };
  };
  globalSubscriptionEnabled?: boolean;
  userCanAccessPremium?: boolean;
}

// Logic:
function premiumFeatureGate(req: FeatureGateRequest, res: Response, next: NextFunction) {
  try {
    // 1. Get global subscription state (from cache, <10ms)
    const globalState = getGlobalSubscriptionState(); // cached
    
    // 2. If global state is OFF, deny access to all premium features
    if (!globalState) {
      req.userCanAccessPremium = false;
      return res.status(403).json({
        success: false,
        message: 'Premium features are currently disabled'
      });
    }

    // 3. If global state is ON, check user subscription
    if (req.user?.subscription) {
      const hasActivePremium = 
        req.user.subscription.plan !== 'free' &&
        req.user.subscription.status === 'active' &&
        (!req.user.subscription.expiresAt || 
         new Date(req.user.subscription.expiresAt) > new Date());
      
      req.userCanAccessPremium = hasActivePremium;
      
      if (!hasActivePremium) {
        return res.status(403).json({
          success: false,
          message: 'Premium subscription required'
        });
      }
    } else {
      // No subscription data = free tier
      req.userCanAccessPremium = false;
      return res.status(403).json({
        success: false,
        message: 'Premium subscription required'
      });
    }

    next();
  } catch (error) {
    // Error in feature gate check = deny access (fail-safe)
    req.userCanAccessPremium = false;
    return res.status(500).json({
      success: false,
      message: 'Service error - access denied'
    });
  }
}
```

### 5. Frontend Component

**Location:** `src/components/admin/GlobalSubscriptionToggle.tsx`

```typescript
interface GlobalSubscriptionToggleProps {
  onToggle?: (newState: boolean) => void;
}

interface ToggleState {
  enabled: boolean;
  loading: boolean;
  error?: string;
  successMessage?: string;
}

// Component responsibilities:
// - Display current state
// - Show loading state during toggle
// - Show success/error notifications
// - Revert UI on failure
// - Fetch initial state on mount
// - Handle real-time updates (optional polling or websocket)
```

---

## Data Models

### TypeScript Interfaces

```typescript
// System Settings
interface ISystemSettings extends Document {
  settingKey: string;
  value: boolean;
  lastUpdatedBy: string;
  lastUpdatedAt: Date;
  createdAt: Date;
}

// Audit Log
interface IAuditLog extends Document {
  action: 'subscription_toggle';
  adminId: string;
  adminEmail: string;
  previousState: boolean;
  newState: boolean;
  timestamp: Date;
  httpStatusCode: number;
  requestIpAddress: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

// User Subscription (existing, extended)
interface IUserSubscription {
  plan: 'free' | 'standard' | 'premium';
  status: 'active' | 'inactive' | 'cancelled';
  expiresAt?: Date;
}

// Global State (cached representation)
interface IGlobalSubscriptionState {
  enabled: boolean;
  loadedAt: Date;
  expiresAt: Date; // TTL expiration
}
```

---

## Caching Strategy

### Cache Architecture

**Two-Tier Caching Approach:**

#### Tier 1: In-Memory Cache (Node.js Memory)
- **Storage:** Node.js application memory
- **TTL:** 5 minutes (configurable)
- **Use case:** Fast local access, sub-10ms latency
- **Invalidation:** Manual (on state change)

#### Tier 2: Redis Cache (Optional)
- **Storage:** Redis instance
- **TTL:** 5 minutes
- **Use case:** Distributed systems, shared state across multiple Node instances
- **Invalidation:** Pub/Sub notifications

### Cache Invalidation Strategy

**Event-Driven Invalidation:**

```
1. Admin updates global state via POST /admin/subscriptions/global-state
2. Controller receives request → adminMiddleware verifies auth
3. GlobalSubscriptionService.setGlobalState() called
4. Database write occurs (SystemSettings collection updated)
5. If write succeeds:
   - Invalidate in-memory cache
   - If Redis enabled: publish invalidation event
   - Return success response
6. If write fails:
   - Don't invalidate cache
   - Return error response
7. Next feature gate check:
   - Cache miss → Load from DB → Repopulate cache
```

### Cache Miss Handling

**Scenario:** Cache expires or is invalidated while requests in flight

```
1. Request arrives → Check cache
2. Cache miss (expired or invalidated)
3. Load from database (5-10ms typical)
4. Repopulate cache with fresh TTL
5. Use value for this request
6. Return response
```

**Performance:** First request after invalidation: ~5-10ms (includes DB read)
**Subsequent requests:** <1ms (cache hit)

### Concurrency Handling

**Problem:** Thundering herd on cache expiration

```
Multiple concurrent requests hit cache simultaneously
→ All miss at same moment → All query database
→ Database spike (should be acceptable for 1000 req/sec)
```

**Mitigation:**
- Cache lock using simple flag (prevent simultaneous reloads)
- Other requests wait for first request's DB result
- Uses Promise chaining to share result

---

## API Endpoint Specifications

### GET /admin/subscriptions/global-state

**Purpose:** Retrieve current global subscription state

**Authentication:** Required (adminMiddleware)

**Request:**
```http
GET /api/admin/subscriptions/global-state HTTP/1.1
Authorization: Bearer {admin-token}
```

**Response Success (200):**
```json
{
  "success": true,
  "globalSubscriptionEnabled": true,
  "cachedAt": "2024-01-15T10:30:00Z"
}
```

**Response Error - Unauthorized (401):**
```json
{
  "success": false,
  "message": "Non autorisé: Token manquant"
}
```

**Response Error - Server (500):**
```json
{
  "success": false,
  "message": "Service error"
}
```

---

### POST /admin/subscriptions/global-state

**Purpose:** Update global subscription state

**Authentication:** Required (adminMiddleware)

**Request:**
```http
POST /api/admin/subscriptions/global-state HTTP/1.1
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "enabled": false
}
```

**Response Success (200):**
```json
{
  "success": true,
  "globalSubscriptionEnabled": false,
  "previousState": true,
  "message": "Subscriptions disabled",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

**Response Error - Bad Request (400):**
```json
{
  "success": false,
  "message": "enabled must be a boolean"
}
```

**Response Error - Unauthorized (401):**
```json
{
  "success": false,
  "message": "Non autorisé: Token invalide"
}
```

**Response Error - Server (500):**
```json
{
  "success": false,
  "message": "Database error - state update failed"
}
```

---

### GET /admin/subscriptions/audit-history

**Purpose:** Retrieve audit log of subscription state changes

**Authentication:** Required (adminMiddleware)

**Query Parameters:**
- `limit` (optional, default: 100, max: 500): Number of recent logs to return

**Request:**
```http
GET /api/admin/subscriptions/audit-history?limit=50 HTTP/1.1
Authorization: Bearer {admin-token}
```

**Response Success (200):**
```json
{
  "success": true,
  "auditLogs": [
    {
      "id": "audit-log-id-456",
      "adminEmail": "admin@example.com",
      "previousState": true,
      "newState": false,
      "timestamp": "2024-01-15T10:30:00Z",
      "httpStatusCode": 200,
      "requestIpAddress": "192.168.1.1"
    },
    {
      "id": "audit-log-id-455",
      "adminEmail": "admin@example.com",
      "previousState": false,
      "newState": true,
      "timestamp": "2024-01-15T10:25:00Z",
      "httpStatusCode": 200,
      "requestIpAddress": "192.168.1.1"
    }
  ]
}
```

**Response Error - Unauthorized (401):**
```json
{
  "success": false,
  "message": "Non autorisé"
}
```

---

## Feature Gate Check Logic Integration Points

### Integration Point 1: Streaming Routes

**Where to add:** `backend/src/streaming/streaming.routes.ts`

```typescript
// Add feature gate middleware to premium quality routes
router.get('/stream/:id/1080p', 
  premiumFeatureGate,           // NEW: Check global state first
  requireAuth,
  streamingController.stream1080p
);

router.get('/stream/:id/download',
  premiumFeatureGate,           // NEW: Check global state first
  requireAuth,
  streamingController.download
);
```

### Integration Point 2: Movie/Series Detail Routes

**Where to add:** Premium feature checks in `backend/src/modules/movies/movies.controller.ts`

```typescript
export const getMovieDetails = async (req, res) => {
  const movie = await Movie.findById(req.params.id);
  
  if (!movie) return res.status(404).json({ success: false });

  // NEW: Check if premium content requires gate
  if (movie.requiresPremium) {
    const globalState = getGlobalSubscriptionState(); // cached
    if (!globalState) {
      return res.status(403).json({
        success: false,
        message: 'This feature is unavailable'
      });
    }
    
    if (!req.user?.subscription?.plan?.startsWith('premium')) {
      return res.status(403).json({
        success: false,
        message: 'Premium subscription required'
      });
    }
  }

  res.json({ success: true, movie });
};
```

### Integration Point 3: Middleware Chain

**Where to add:** `backend/src/app.ts`

```typescript
// Apply to all /api routes (after auth, before controllers)
app.use('/api', premiumFeatureGate);  // NEW: Add cache check

// Then route handlers check if specific features are blocked
```

---

## Error Handling and Fallback Behavior

### Error Scenarios

#### Scenario 1: Database Write Fails During Toggle

**Context:** Admin clicks toggle, but MongoDB is down

**Behavior:**
1. Controller catches error
2. Does NOT invalidate cache
3. Returns HTTP 500 with generic error message
4. Logs error with context for debugging
5. UI reverts toggle state
6. User sees error notification

**Response:**
```json
{
  "success": false,
  "message": "Failed to update subscription state"
}
```

#### Scenario 2: Cache Invalidation Fails

**Context:** Database write succeeds, but Redis is down

**Behavior:**
1. Database write succeeds
2. Cache invalidation attempted on Redis
3. Redis call fails/times out
4. Error is logged
5. Controller still returns success (eventual consistency)
6. Next request hits database and repopulates cache

**Response:**
```json
{
  "success": true,
  "globalSubscriptionEnabled": false,
  "message": "Subscriptions disabled"
}
```

**Reason:** Database is source of truth; cache can be repopulated

#### Scenario 3: Feature Gate Check Fails

**Context:** During a premium feature request, database is unavailable

**Behavior:**
1. Cache is checked (likely hit)
2. If cache hit: use cached value
3. If cache miss AND database error:
   - Deny access (fail-safe)
   - Return HTTP 500 with generic message
   - Log error
4. User sees "Service unavailable - try again later"

**Response:**
```json
{
  "success": false,
  "message": "Unable to verify access - try again later"
}
```

**Reason:** Cannot verify subscription status, so deny access to be safe

#### Scenario 4: Invalid Request Data

**Context:** Admin sends POST with `enabled: "true"` (string instead of boolean)

**Behavior:**
1. Controller validates request body
2. Returns HTTP 400 with validation error
3. No database operation occurs
4. UI shows validation error

**Response:**
```json
{
  "success": false,
  "message": "enabled must be a boolean"
}
```

#### Scenario 5: Unauthorized Access

**Context:** Non-admin user attempts to POST to global-state endpoint

**Behavior:**
1. adminMiddleware verifies JWT
2. JWT is valid but user.role !== 'admin'
3. Returns HTTP 401 with auth error
4. No state change occurs

**Response:**
```json
{
  "success": false,
  "message": "Non autorisé: Unauthorized"
}
```

### Fallback Behavior Design

**Principle:** "When in doubt, enable subscriptions"

- Database unavailable during feature gate check → Assume subscriptions enabled (business-safe default)
- Cannot verify admin token → Reject request (security-safe default)
- Cache inconsistency detected → Reload from database (consistency recovery)
- Concurrent toggle attempts → Last write wins (atomic database operation)

---

## Audit Logging Strategy

### Log Creation

**When:** After successful state change and database write

**What to Log:**
```json
{
  "action": "subscription_toggle",
  "adminId": "user-123",
  "adminEmail": "admin@example.com",
  "previousState": true,
  "newState": false,
  "timestamp": "2024-01-15T10:30:00Z",
  "httpStatusCode": 200,
  "requestIpAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "success": true,
  "errorMessage": null
}
```

### Log Storage

**Collection:** MongoDB `AuditLog`
**Indexes:**
- `timestamp` (descending): for chronological queries
- `adminId`: for filtering by admin
- `action`: for filtering by action type

### Log Retrieval

**Endpoint:** GET `/admin/subscriptions/audit-history`
**Query:** Most recent 100 logs, sorted descending by timestamp
**Response:** JSON array of audit log objects

### Log Retention

**Policy:** Keep all logs indefinitely (compliance/auditing)
**Backup:** Include in MongoDB backups

---

## Concurrent Request Handling

### Design Goal
Support 1000+ requests/second across multiple concurrent feature gate checks

### Concurrency Strategy

#### 1. Cache-First Approach
- First 100 requests/sec: All hit in-memory cache (sub-1ms)
- No database contention
- CPU-bound only (JSON parsing, comparison logic)

#### 2. Cache Miss Handling (Coordinated Reload)
```typescript
let cacheLoadPromise: Promise<boolean> | null = null;

function getGlobalSubscriptionState(): Promise<boolean> {
  // Check if cache is valid
  if (cache.isValid()) {
    return Promise.resolve(cache.value);
  }

  // If already loading, wait for that load
  if (cacheLoadPromise) {
    return cacheLoadPromise;
  }

  // First request to miss cache - load from DB
  cacheLoadPromise = loadFromDatabase()
    .then(value => {
      cache.set(value, TTL_5_MINUTES);
      cacheLoadPromise = null;
      return value;
    })
    .catch(error => {
      cacheLoadPromise = null;
      throw error;
    });

  return cacheLoadPromise;
}
```

**Result:** On cache expiration with 1000 concurrent requests:
- 1 request loads from database
- 999 requests wait for that load to complete
- All 1000 requests proceed within ~10ms total

#### 3. Database Query Optimization
- Single query: `db.systemSettings.findOne({ settingKey: 'global_subscription_enabled' })`
- Uses indexed lookup: settingKey is unique index
- Typical latency: 2-5ms

#### 4. Lock-Free Design
- No explicit locking needed
- Concurrent reads are safe (MongoDB read isolation)
- Atomic write at database level (MongoDB guarantees)
- Promise chaining handles in-application coordination

### Load Testing Targets

**Test Scenario 1: Sustained Load (1000 req/sec, cache hit)**
- Expected: Sub-10ms latency (p99)
- Actual mechanism: All requests read from in-memory cache
- Database: 0 queries/sec (idle)

**Test Scenario 2: Cache Miss (all 1000 req/sec miss simultaneously)**
- Expected: ~10-15ms latency (p99)
- Actual mechanism: 1 DB query + 999 waiting for result
- Database: 1 query to SystemSettings
- Network: 1 round trip (~5ms)

**Test Scenario 3: Mixed: 10% update + 90% read (100 updates/sec, 900 reads/sec)**
- Expected: Updates ~50-100ms (DB + cache invalidation)
- Expected: Reads ~5-10ms (cache hit most of time)
- Database: 100 writes/sec + occasional cache misses

---

## Real-Time Updates Without Re-login

### Current Session Preservation

**Design:** Feature gate checks happen on EVERY premium request (not cached per session)

**Flow:**
1. User logs in → Session established → User token issued (no global state check yet)
2. User requests premium feature (e.g., HD stream)
3. Feature gate middleware runs → Checks CURRENT global state from cache
4. If global state changed after user login → New state immediately used
5. User sees new feature availability instantly

**No Re-login Needed:** Because sessions don't embed subscription status; gate checks are always fresh

### Implementation Detail

```typescript
// Feature gate middleware (runs on EVERY premium request)
async function premiumFeatureGate(req, res, next) {
  // Always check current state (not from session/token)
  const currentGlobalState = await getGlobalSubscriptionState(); // cached
  
  // Use fresh state, not cached from login time
  if (!currentGlobalState) {
    return res.status(403).json({ success: false });
  }

  // ... rest of gate logic
}
```

### UI Polling Strategy (Optional)

For real-time UI updates (showing features as locked/unlocked):

**Option 1: Polling (Simple, built-in)**
```typescript
// Client-side every 5-10 seconds
useEffect(() => {
  const interval = setInterval(async () => {
    const state = await fetch('/api/admin/subscriptions/global-state');
    setGlobalState(state.globalSubscriptionEnabled);
  }, 10000);

  return () => clearInterval(interval);
}, []);
```

**Option 2: WebSocket (More efficient)**
- Establish WebSocket connection
- Server broadcasts state changes to all connected clients
- Client immediately updates UI
- See Testing Strategy section for implementation

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Idempotent Toggle

*For any* sequence of toggle requests to the same state, the final Global_Subscription_State SHALL equal that state and multiple identical POSTs SHALL produce identical responses.

**Validates: Requirements 1.3, 4.3**

### Property 2: State Retrieval Consistency

*For any* sequence of POST updates to Global_Subscription_State, a GET request immediately after SHALL return the exact state that was POSTed.

**Validates: Requirements 1.6, 4.4**

### Property 3: Global State Feature Gate Effect

*When* Global_Subscription_State is OFF, all users (regardless of their stored User_Subscription_Data) SHALL be denied access to premium features. *When* Global_Subscription_State is ON, users with active premium subscriptions SHALL have access to premium features.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 4: User Subscription Data Preservation

*For any* User_Subscription_Data state and any sequence of Global_Subscription_State toggles, the User_Subscription_Data (fields: plan, status, expiresAt) SHALL remain unchanged after each toggle. Toggling OFF then ON SHALL result in identical User_Subscription_Data as before the toggles.

**Validates: Requirements 3.1, 3.2, 3.6**

### Property 5: Immediate Feature Gate Updates

*For any* user with premium subscription, when Global_Subscription_State transitions from OFF to ON, subsequent premium feature requests SHALL be granted (until cache expires). When Global_Subscription_State transitions from ON to OFF, subsequent premium feature requests SHALL be denied.

**Validates: Requirements 2.8, 8.1, 8.2**

### Property 6: Audit Log Immutability and Ordering

*For any* sequence of Global_Subscription_State changes, the corresponding audit logs SHALL be created in MongoDB, and retrieving audit logs SHALL return them in reverse chronological order (most recent first).

**Validates: Requirements 6.1, 6.5**

### Property 7: Cache Invalidation Correctness

*For any* Global_Subscription_State change, if the cache was previously populated, a subsequent feature gate check SHALL observe the new state (not the stale cached value).

**Validates: Requirements 7.5, 7.6**

### Property 8: Authentication and Authorization

*For any* unauthenticated request or non-admin authenticated request to POST /admin/subscriptions/global-state, THE System SHALL return HTTP 401 and NOT modify Global_Subscription_State.

**Validates: Requirements 1.7, 4.6**

### Property 9: No Automatic Subscription Expiration

*When* Global_Subscription_State is OFF, THE System SHALL NOT automatically expire, cancel, or downgrade any User_Subscription_Data. Manual admin updates SHALL still be allowed.

**Validates: Requirements 3.3, 3.5**

### Property 10: Error Safety

*When* a database error occurs during feature gate check, THE System SHALL deny access (fail-safe behavior) and log the error without corrupting state.

**Validates: Requirements 9.1, 9.3, 9.4**

---

## Testing Strategy

### Test Classification

Based on acceptance criteria prework analysis:

**Property-Based Tests** (20+ properties):
- State idempotence and consistency
- Feature gate logic across input variations
- Subscription data preservation
- Cache behavior
- Audit log ordering
- Concurrent access patterns

**Example-Based Tests** (15+ unit tests):
- Authorization failures (401 responses)
- Validation errors (400 responses)
- API response formats
- Session preservation (no re-login)
- Error message sanitization

**Integration Tests** (5+ scenarios):
- Database persistence (state survives restart)
- Cache invalidation end-to-end
- Audit logging end-to-end
- Feature gate integration with actual routes
- Concurrent request handling under load

**Performance/Load Tests** (3 scenarios):
- Cache hit latency: <10ms @ 1000 req/sec
- API update latency: <500ms
- Cache miss handling: <20ms @ 1000 req/sec

### Property-Based Testing Approach

**Library:** Use Hypothesis (Python) or fast-check (JavaScript) depending on language choice

**Example Property Test (pseudo-code):**
```
Property: "Toggle idempotence"
For all (initialState: boolean, adminId: string, adminEmail: string):
  1. Set global state to initialState
  2. POST to toggle with enabled=!initialState
  3. Verify state is now !initialState
  4. POST again with enabled=!initialState
  5. Verify state is still !initialState (idempotent)
  6. GET endpoint should return !initialState
  7. Verify audit log has exactly 2 entries
```

**Test Tag Format:**
```
Feature: admin-subscription-control, Property 1: Idempotent Toggle
```

**Run Configuration:** Minimum 100 iterations per property test

### Unit Test Examples

```typescript
// Test: POST with non-boolean enabled field returns 400
test('POST /admin/subscriptions/global-state with enabled=string returns 400', async () => {
  const response = await request(app)
    .post('/api/admin/subscriptions/global-state')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ enabled: "true" });

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  expect(response.body.message).toMatch(/boolean/i);
});

// Test: Unauthenticated POST returns 401
test('POST /admin/subscriptions/global-state without token returns 401', async () => {
  const response = await request(app)
    .post('/api/admin/subscriptions/global-state')
    .send({ enabled: false });

  expect(response.status).toBe(401);
  expect(response.body.message).toMatch(/autorisé/i);
});

// Test: Non-admin user returns 401
test('POST /admin/subscriptions/global-state as non-admin returns 401', async () => {
  const response = await request(app)
    .post('/api/admin/subscriptions/global-state')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ enabled: false });

  expect(response.status).toBe(401);
});
```

### Integration Test Examples

```typescript
// Test: Global state survives application restart
test('Global subscription state persists after restart', async () => {
  // 1. Start server
  // 2. POST to disable subscriptions
  // 3. Verify state is disabled
  // 4. Stop server
  // 5. Start server again
  // 6. Verify state is still disabled
});

// Test: Feature gate respects global state
test('Premium feature denied when global state is OFF', async () => {
  // 1. Set global state to OFF
  // 2. Try to access premium feature
  // 3. Expect 403 response
  // 4. Set global state to ON
  // 5. Try to access premium feature with valid subscription
  // 6. Expect success response
});
```

### Performance Test Configuration

```typescript
// Load test: 1000 requests/sec with cache hits
test('1000 req/sec feature gate checks respond within 10ms', async () => {
  // 1. Warm up cache
  // 2. Send 1000 concurrent requests
  // 3. Measure latency
  // 4. Assert p99 latency < 10ms
  // 5. Verify no database queries (all cache hits)
});

// Load test: Cache miss handling
test('1000 concurrent requests handle cache miss efficiently', async () => {
  // 1. Clear cache
  // 2. Send 1000 concurrent requests
  // 3. Verify only 1 database query executed
  // 4. Verify all requests complete within 20ms
});
```

---

## File Modifications and Creations Summary

### Backend Files to Create/Modify

**New Files:**

1. **`backend/src/models/SystemSettings.ts`**
   - MongoDB model for global subscription state
   - Schema with settingKey, value, lastUpdatedBy, timestamps

2. **`backend/src/models/AuditLog.ts`**
   - MongoDB model for subscription state change audit logs
   - Schema with action, adminId, adminEmail, states, timestamps, http details

3. **`backend/src/services/global-subscription.service.ts`**
   - Service class for managing global subscription state
   - Methods: getGlobalState(), setGlobalState(), getAuditHistory(), initializeDefaultState(), invalidateCache()
   - Implements two-tier caching (in-memory + Redis optional)

4. **`backend/src/modules/admin/subscription-state.controller.ts`**
   - Controller for global subscription state endpoints
   - Methods: getGlobalState(), setGlobalState(), getAuditHistory()
   - Request validation, response formatting, error handling

5. **`backend/src/middleware/feature-gate.middleware.ts`**
   - Premium feature gate middleware
   - Checks global state first, then user subscription
   - Fail-safe error handling

**Modified Files:**

1. **`backend/src/modules/admin/admin.routes.ts`**
   - Add new routes:
     - GET /subscriptions/global-state
     - POST /subscriptions/global-state
     - GET /subscriptions/audit-history

2. **`backend/src/app.ts`**
   - Import and register feature gate middleware on `/api` routes (optional, depends on architecture)

3. **`backend/src/modules/admin/subscription.controller.ts`**
   - Export existing subscription functions (already present)

### Frontend Files to Create

**New Files:**

1. **`src/components/admin/GlobalSubscriptionToggle.tsx`**
   - React component for toggle control
   - State management (enabled/loading/error)
   - API integration (GET/POST)
   - Notifications (success/error)
   - Error recovery (revert on failure)

2. **`src/pages/admin/subscriptions.tsx`** (or similar)
   - Admin subscription management page
   - Embed GlobalSubscriptionToggle component
   - Display audit history (optional)

### Configuration Files

1. **`.kiro/specs/admin-subscription-control/.config.kiro`** (already required)
   ```json
   {
     "specId": "bcc01001-6dc9-47c2-a321-4a52d69a3810",
     "workflowType": "requirements-first",
     "specType": "feature"
   }
   ```

---

## Summary

This design provides a robust, scalable implementation of the Admin Subscription Control System with:

✅ **Atomic state management** through MongoDB transactions and cache invalidation
✅ **Real-time feature gating** with sub-10ms cached checks
✅ **Data preservation** through read-only design for User_Subscription_Data
✅ **Comprehensive auditing** with MongoDB AuditLog collection
✅ **Error safety** with fail-safe defaults and graceful degradation
✅ **High concurrency** supporting 1000+ req/sec through caching strategy
✅ **Backward compatibility** by extending existing admin module
✅ **Clear separation of concerns** through service/controller/middleware layers

The implementation is ready for development of backend services, API controllers, middleware, and frontend components following the modular architecture patterns already established in the codebase.
