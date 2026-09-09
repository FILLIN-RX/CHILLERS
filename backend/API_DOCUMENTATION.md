# Backend API Documentation

## Admin Subscription Control Endpoints

### Authentication
All admin subscription control endpoints require **admin authentication** via the `adminMiddleware`. Include a valid admin JWT token in the `Authorization` header.

```
Authorization: Bearer {admin-jwt-token}
```

---

## GET /admin/subscriptions/global-state

Retrieve the current global subscription state (whether subscriptions are globally enabled or disabled).

### Request

```http
GET /api/admin/subscriptions/global-state
Authorization: Bearer {admin-jwt-token}
```

### Response - Success (HTTP 200)

```json
{
  "success": true,
  "globalSubscriptionEnabled": true,
  "cachedAt": "2024-01-15T10:30:00Z"
}
```

**Fields:**
- `success` (boolean): Indicates successful request
- `globalSubscriptionEnabled` (boolean): Current global subscription state (true = enabled, false = disabled)
- `cachedAt` (Date, optional): When this state was last loaded from cache

### Response - Unauthorized (HTTP 401)

```json
{
  "success": false,
  "message": "Non autorisé: Token manquant"
}
```

**Reasons for 401:**
- Missing or invalid JWT token
- Non-admin user attempting access
- Expired token

### Response - Server Error (HTTP 500)

```json
{
  "success": false,
  "message": "Service error"
}
```

**Reasons for 500:**
- Database connectivity issue
- Internal server error during state retrieval

---

## POST /admin/subscriptions/global-state

Update the global subscription state. This endpoint toggles whether the subscription system is enabled or disabled globally.

### Request

```http
POST /api/admin/subscriptions/global-state
Authorization: Bearer {admin-jwt-token}
Content-Type: application/json

{
  "enabled": false
}
```

**Request Body:**
- `enabled` (boolean, required): The new subscription state (true = subscriptions enabled, false = subscriptions disabled)
  - Must be a boolean type (not a string like `"true"` or `"false"`)

### Response - Success (HTTP 200)

```json
{
  "success": true,
  "globalSubscriptionEnabled": false,
  "previousState": true,
  "message": "Subscriptions disabled",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

**Fields:**
- `success` (boolean): Indicates successful update
- `globalSubscriptionEnabled` (boolean): The new global subscription state
- `previousState` (boolean): The state before this update
- `message` (string): Human-readable status message
- `updatedAt` (Date): Timestamp of the update

### Response - Bad Request (HTTP 400)

Validation error - typically due to incorrect request body format.

```json
{
  "success": false,
  "message": "enabled must be a boolean"
}
```

**Common validation errors:**
- `enabled` field is missing
- `enabled` is not a boolean (e.g., string, number, object)
- Request body is malformed JSON

### Response - Unauthorized (HTTP 401)

```json
{
  "success": false,
  "message": "Non autorisé: Token invalide"
}
```

**Reasons for 401:**
- Missing or invalid JWT token
- Non-admin user attempting access
- Expired token

### Response - Server Error (HTTP 500)

```json
{
  "success": false,
  "message": "Database error - state update failed"
}
```

**Reasons for 500:**
- Database connectivity issue
- Failed to write to MongoDB
- Internal server error during state update

### Side Effects

When this endpoint succeeds:
1. **Database updated:** SystemSettings collection updated with new state
2. **Cache invalidated:** In-memory cache and Redis (if configured) are cleared
3. **Audit log created:** Entry logged in AuditLog collection with:
   - Admin ID and email
   - Previous and new state
   - Timestamp and request IP address
   - HTTP status code
4. **Feature gate changes apply immediately:** Subsequent premium feature requests use new state

---

## GET /admin/subscriptions/audit-history

Retrieve the audit history of subscription state changes. Returns the most recent state change events.

### Request

```http
GET /api/admin/subscriptions/audit-history?limit=50
Authorization: Bearer {admin-jwt-token}
```

**Query Parameters:**
- `limit` (number, optional, default: 100, max: 500): Maximum number of recent audit log entries to return

### Response - Success (HTTP 200)

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

**Fields:**
- `success` (boolean): Indicates successful retrieval
- `auditLogs` (array): List of audit log entries in reverse chronological order (most recent first)

**Audit Log Entry Fields:**
- `id` (string): Unique identifier for the audit log entry
- `adminEmail` (string): Email address of the admin who made the change
- `previousState` (boolean): Subscription state before the change
- `newState` (boolean): Subscription state after the change
- `timestamp` (Date): When the change occurred
- `httpStatusCode` (number): HTTP response status code (200 for success, 500 for errors)
- `requestIpAddress` (string): IP address of the request (for security tracking)

### Response - Unauthorized (HTTP 401)

```json
{
  "success": false,
  "message": "Non autorisé"
}
```

### Response - Server Error (HTTP 500)

```json
{
  "success": false,
  "message": "Service error"
}
```

---

## Feature Gate Integration

Premium features (1080p streaming, downloads, continue watching, etc.) are protected by a feature gate that checks:

1. **Global subscription state:** If global state is OFF, all users are denied premium features
2. **User subscription status:** If global state is ON, individual user subscription is checked

### Feature Gate Behavior

**When Global State is OFF:**
- All users treated as free tier
- All premium features return HTTP 403 Forbidden
- User subscription data is preserved but not used

**When Global State is ON:**
- Users with active premium subscriptions can access premium features
- Free tier users denied with HTTP 403 Forbidden
- Feature access determined by user.subscription status

### Premium Feature Routes Protected

Examples of routes using the feature gate:
- `GET /api/stream/:id/1080p` - High-definition streaming
- `GET /api/stream/:id/download` - Download functionality
- `GET /api/movies/:id` - Premium content (may have restrictions)
- `GET /api/series/:id` - Premium content (may have restrictions)

---

## Error Handling

### Generic Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error description"
}
```

### Common HTTP Status Codes

| Status | Meaning | Cause |
|--------|---------|-------|
| 200 | OK | Request succeeded |
| 400 | Bad Request | Validation error (invalid request body) |
| 401 | Unauthorized | Missing/invalid auth token, non-admin user |
| 403 | Forbidden | Premium feature access denied |
| 500 | Internal Server Error | Database or server error |

---

## Example Workflow

### Step 1: Check Current State

```bash
curl -X GET http://localhost:3000/api/admin/subscriptions/global-state \
  -H "Authorization: Bearer {admin-token}"
```

Response:
```json
{
  "success": true,
  "globalSubscriptionEnabled": true,
  "cachedAt": "2024-01-15T10:30:00Z"
}
```

### Step 2: Disable Subscriptions

```bash
curl -X POST http://localhost:3000/api/admin/subscriptions/global-state \
  -H "Authorization: Bearer {admin-token}" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

Response:
```json
{
  "success": true,
  "globalSubscriptionEnabled": false,
  "previousState": true,
  "message": "Subscriptions disabled",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Step 3: View Audit Trail

```bash
curl -X GET "http://localhost:3000/api/admin/subscriptions/audit-history?limit=10" \
  -H "Authorization: Bearer {admin-token}"
```

Response:
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
    }
  ]
}
```

---

## Performance Considerations

- **GET /admin/subscriptions/global-state:** Typically <10ms (uses cached state)
- **POST /admin/subscriptions/global-state:** Typically <500ms (includes database write and cache invalidation)
- **GET /admin/subscriptions/audit-history:** Typically <100ms for 100 records

---

## Caching Behavior

The global subscription state is cached for performance:
- **Cache TTL:** 5 minutes
- **Cache invalidation:** Automatic on state change
- **Fallback:** If cache fails, database is queried (no stale data served)
- **Feature gate latency:** <10ms (reads from cache)

---

## Requirements Validation

This API documentation fulfills the following requirements:
- **1.2**: Admin can toggle subscriptions via API
- **4.1**: GET endpoint returns current state with HTTP 200
- **4.2**: Response format includes required fields (success, globalSubscriptionEnabled, cachedAt)
- **4.2**: POST endpoint accepts boolean enabled field
- **4.2**: POST response includes success, globalSubscriptionEnabled, previousState, message, updatedAt
- **4.2**: Audit history endpoint returns audit logs with required fields
- All endpoints require adminMiddleware authentication
