# Admin Subscription Control API Documentation

This document describes the Admin Subscription Control System REST API endpoints. These endpoints allow administrators to globally toggle the subscription system on/off and audit state changes.

## Base URL

All endpoints are prefixed with `/api/admin/subscriptions`

## Authentication

All endpoints require admin authentication via the `adminMiddleware`. Include a valid admin JWT token in the Authorization header:

```
Authorization: Bearer <admin-jwt-token>
```

---

## Endpoints

### 1. Get Global Subscription State

Retrieve the current global subscription state.

**Endpoint:** `GET /api/admin/subscriptions/global-state`

**Authentication:** Required (adminMiddleware)

**Request Headers:**
```http
Authorization: Bearer <admin-token>
```

**Response Success (200):**
```json
{
  "success": true,
  "globalSubscriptionEnabled": true,
  "cachedAt": "2024-01-15T10:30:00.000Z"
}
```

**Response Fields:**
- `success` (boolean): Indicates if the request was successful
- `globalSubscriptionEnabled` (boolean): Current state of the global subscription toggle
  - `true` = Subscriptions are enabled (normal operation)
  - `false` = Subscriptions are disabled (all users treated as free tier)
- `cachedAt` (Date, optional): Timestamp when the value was cached (for debugging)

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

**Requirements:** 1.6, 4.1, 4.2

---

### 2. Set Global Subscription State

Update the global subscription state (toggle subscriptions on/off).

**Endpoint:** `POST /api/admin/subscriptions/global-state`

**Authentication:** Required (adminMiddleware)

**Request Headers:**
```http
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "enabled": false
}
```

**Request Fields:**
- `enabled` (boolean, required): New state for the global subscription toggle
  - `true` = Enable subscriptions (allow premium features for subscribed users)
  - `false` = Disable subscriptions (block all premium features regardless of user subscription)

**Response Success (200):**
```json
{
  "success": true,
  "globalSubscriptionEnabled": false,
  "previousState": true,
  "message": "Subscriptions disabled",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Response Fields:**
- `success` (boolean): Indicates if the operation was successful
- `globalSubscriptionEnabled` (boolean): New state after the update
- `previousState` (boolean): State before the update
- `message` (string): Human-readable description of the change
- `updatedAt` (Date): Timestamp of the update

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

**Side Effects:**
- Creates an audit log entry with admin details, IP address, and state change
- Invalidates the in-memory cache (next request will fetch from database)
- All subsequent premium feature requests will immediately reflect the new state

**Requirements:** 1.3, 4.3, 4.4, 4.5, 6.1

---

### 3. Get Audit History

Retrieve the audit log of subscription state changes (most recent first).

**Endpoint:** `GET /api/admin/subscriptions/audit-history`

**Authentication:** Required (adminMiddleware)

**Query Parameters:**
- `limit` (number, optional): Number of recent logs to return
  - Default: `100`
  - Minimum: `1`
  - Maximum: `500`

**Request Example:**
```http
GET /api/admin/subscriptions/audit-history?limit=50
Authorization: Bearer <admin-token>
```

**Response Success (200):**
```json
{
  "success": true,
  "auditLogs": [
    {
      "id": "65a1234567890abcdef12345",
      "adminEmail": "admin@example.com",
      "previousState": true,
      "newState": false,
      "timestamp": "2024-01-15T10:30:00.000Z",
      "httpStatusCode": 200,
      "requestIpAddress": "192.168.1.1"
    },
    {
      "id": "65a1234567890abcdef12344",
      "adminEmail": "admin@example.com",
      "previousState": false,
      "newState": true,
      "timestamp": "2024-01-15T10:25:00.000Z",
      "httpStatusCode": 200,
      "requestIpAddress": "192.168.1.1"
    }
  ]
}
```

**Response Fields:**
- `success` (boolean): Indicates if the request was successful
- `auditLogs` (array): List of audit log entries, sorted by timestamp (descending)
  - `id` (string): Unique identifier for the audit log entry
  - `adminEmail` (string): Email of the admin who made the change
  - `previousState` (boolean): State before the change
  - `newState` (boolean): State after the change
  - `timestamp` (Date): When the change occurred
  - `httpStatusCode` (number): HTTP status code of the toggle request (200 = success, 500 = error)
  - `requestIpAddress` (string): IP address of the admin who made the request

**Response Error - Unauthorized (401):**
```json
{
  "success": false,
  "message": "Non autorisé"
}
```

**Response Error - Server (500):**
```json
{
  "success": false,
  "message": "Service error"
}
```

**Requirements:** 6.4, 6.5

---

## Feature Impact

When the global subscription state is toggled, the following behavior applies:

### When `globalSubscriptionEnabled = false` (Subscriptions Disabled)

- **All premium features are blocked** for all users, including those with active premium subscriptions
- Premium streaming routes return HTTP 403
- Premium content access is denied
- User subscription data is **preserved** in the database (not deleted or modified)
- Audit log captures the state change with admin details

### When `globalSubscriptionEnabled = true` (Subscriptions Enabled - Default)

- **Normal subscription-based access control** applies
- Users with active premium subscriptions can access premium features
- Free tier users are denied access to premium features
- Feature gates check both global state AND individual user subscription status

---

## Implementation Details

### Caching

- The global subscription state is cached in-memory with a 5-minute TTL
- Cache is automatically invalidated when the state is updated via POST
- Feature gate checks hit the cache (<10ms latency) on most requests
- On cache miss, the service fetches from MongoDB and repopulates the cache

### Fail-Safe Behavior

- If the database is unavailable during a feature gate check, the system defaults to **subscriptions enabled** (fail-safe)
- If audit logging fails, the toggle operation still succeeds (audit is non-blocking)
- Toggle operations that fail do NOT invalidate the cache (maintains consistency)

### Concurrent Requests

- Multiple simultaneous cache misses coordinate a single database query (prevents thundering herd)
- Atomic database writes using MongoDB `findOneAndUpdate` with upsert
- No race conditions or data corruption under high concurrency

---

## Error Codes Summary

| HTTP Status | Meaning | Common Causes |
|-------------|---------|---------------|
| 200 | Success | Request completed successfully |
| 400 | Bad Request | Invalid request body (e.g., `enabled` is not boolean) |
| 401 | Unauthorized | Missing or invalid admin JWT token |
| 403 | Forbidden | User is authenticated but not an admin |
| 500 | Server Error | Database error, service unavailable |

---

## Code Examples

### JavaScript/TypeScript (Fetch API)

```typescript
// Get current global state
async function getGlobalState(adminToken: string) {
  const response = await fetch('/api/admin/subscriptions/global-state', {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });
  const data = await response.json();
  console.log('Global state:', data.globalSubscriptionEnabled);
  return data;
}

// Toggle subscriptions off
async function disableSubscriptions(adminToken: string) {
  const response = await fetch('/api/admin/subscriptions/global-state', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ enabled: false })
  });
  const data = await response.json();
  console.log('Subscriptions disabled:', data.message);
  return data;
}

// Get audit history
async function getAuditHistory(adminToken: string, limit = 100) {
  const response = await fetch(
    `/api/admin/subscriptions/audit-history?limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    }
  );
  const data = await response.json();
  console.log('Audit logs:', data.auditLogs);
  return data;
}
```

### cURL

```bash
# Get global state
curl -X GET https://your-domain.com/api/admin/subscriptions/global-state \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Disable subscriptions
curl -X POST https://your-domain.com/api/admin/subscriptions/global-state \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# Enable subscriptions
curl -X POST https://your-domain.com/api/admin/subscriptions/global-state \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

# Get audit history (last 50 entries)
curl -X GET "https://your-domain.com/api/admin/subscriptions/audit-history?limit=50" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## Related Documentation

- [Requirements Document](./.kiro/specs/admin-subscription-control/requirements.md)
- [Technical Design Document](./.kiro/specs/admin-subscription-control/design.md)
- [Implementation Tasks](./.kiro/specs/admin-subscription-control/tasks.md)
- [Deployment Checklist](./DEPLOYMENT.md)

---

## Changelog

### Version 1.0.0 (Initial Release)

- Added `GET /admin/subscriptions/global-state` endpoint
- Added `POST /admin/subscriptions/global-state` endpoint
- Added `GET /admin/subscriptions/audit-history` endpoint
- Implemented in-memory caching with 5-minute TTL
- Implemented audit logging for all state changes
- Fail-safe defaults to subscriptions enabled on errors
