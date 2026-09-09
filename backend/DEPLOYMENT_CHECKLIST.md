# Admin Subscription Control System - Deployment Checklist

This checklist ensures the admin subscription control system is properly deployed and functional in a production or staging environment.

---

## Pre-Deployment Verification

- [ ] **Code Review Completed**
  - All subscription control code has been reviewed
  - Feature gate middleware is integrated into all premium routes
  - No breaking changes to existing subscription system

- [ ] **Tests Pass Locally**
  - Run `npm test` or `yarn test` (in backend directory)
  - All unit tests pass
  - All property-based tests pass
  - All integration tests pass

- [ ] **Build Succeeds**
  - Run `npm run build` (in backend directory)
  - No TypeScript compilation errors
  - No build artifacts missing

---

## Database Preparation

### Step 1: Verify MongoDB Connection

- [ ] **MongoDB Instance Running**
  - MongoDB server is accessible at `MONGODB_URI` environment variable
  - Connection string format: `mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority`
  - Test connection: `npx mongoose-connection-test` (or via MongoDB Compass)

- [ ] **Database User Permissions**
  - User has read/write permissions on target database
  - User can create collections and indexes
  - Test with: `db.serverStatus()` command in MongoDB shell

### Step 2: Create MongoDB Indexes

Before deploying, ensure indexes exist for optimal performance:

- [ ] **SystemSettings Collection Indexes**

  ```javascript
  // Unique index on settingKey (prevents duplicate settings)
  db.systemsettings.createIndex(
    { settingKey: 1 },
    { unique: true }
  )

  // Index on lastUpdatedAt for audit queries
  db.systemsettings.createIndex(
    { lastUpdatedAt: -1 }
  )
  ```

- [ ] **AuditLog Collection Indexes**

  ```javascript
  // Descending index on timestamp (for sorting recent changes first)
  db.auditlogs.createIndex(
    { timestamp: -1 }
  )

  // Index on adminId (for filtering by admin)
  db.auditlogs.createIndex(
    { adminId: 1 }
  )

  // Index on action (for filtering by action type)
  db.auditlogs.createIndex(
    { action: 1 }
  )
  ```

**Automated Option (Recommended):**

Instead of manual index creation, run the migration script:

```bash
# From backend directory
npm run migrate:system-settings
```

This script will:
- Check if indexes exist
- Create missing indexes automatically
- Initialize default system settings
- Log all actions with results
- Be idempotent (safe to run multiple times)

---

## Cache Configuration

### Step 1: Redis Setup (Optional but Recommended)

The system uses a two-tier caching strategy:

**Tier 1: In-Memory Cache (Always Active)**
- Stored in Node.js process memory
- TTL: 5 minutes
- Sub-1ms latency (local memory access)

**Tier 2: Redis Cache (Optional for Distributed Systems)**
- Shared cache across multiple backend instances
- TTL: 5 minutes
- Recommended for multi-instance deployments

- [ ] **Redis Configuration (Optional)**

  If using Redis for distributed caching:

  ```bash
  # Set environment variables in .env
  REDIS_URL=redis://localhost:6379
  # or
  REDIS_URL=redis://:password@host:port
  ```

  - [ ] Redis server is running and accessible
  - [ ] Redis URL is configured in environment variables
  - [ ] Test connection: `redis-cli ping` should return "PONG"

- [ ] **In-Memory Cache Verification**

  The in-memory cache is always active as a fallback:
  - No configuration required
  - Works even if Redis is unavailable
  - Cleared on application restart (expected behavior)

---

## Application Deployment

### Step 1: Deploy Application Code

- [ ] **Environment Variables Set**

  Ensure these are configured before deployment:

  ```bash
  # MongoDB Connection
  MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db

  # (Optional) Redis for distributed cache
  REDIS_URL=redis://localhost:6379

  # JWT Secret (for admin authentication)
  JWT_SECRET=your-secret-key

  # (Optional) Admin role identifier
  ADMIN_ROLE=admin

  # Node Environment
  NODE_ENV=production
  ```

- [ ] **Application Started**

  ```bash
  # Production start
  npm start

  # Or with PM2 (recommended for production)
  pm2 start dist/server.js --name "chiller-api"
  ```

  Expected console output:
  ```
  [SystemSettings] Global subscription setting already initialized
  [GlobalSubscriptionService] Cache initialized
  Server listening on port 3000
  ```

### Step 2: Verify Application Health

- [ ] **Application Responding to Requests**

  ```bash
  curl http://localhost:3000/health
  ```

  Expected: HTTP 200 with health status

- [ ] **Logs Accessible**

  Check application logs for errors:
  ```bash
  npm logs
  # or if using PM2
  pm2 logs "chiller-api"
  ```

---

## Cache Functionality Verification

- [ ] **Cache Working Properly**

  1. Make a GET request to subscription state endpoint:
     ```bash
     curl -X GET http://localhost:3000/api/admin/subscriptions/global-state \
       -H "Authorization: Bearer {admin-token}"
     ```

     Expected: HTTP 200 response (first request may query database)

  2. Make the same request again immediately:
     ```bash
     curl -X GET http://localhost:3000/api/admin/subscriptions/global-state \
       -H "Authorization: Bearer {admin-token}"
     ```

     Expected: HTTP 200 response with <10ms latency (should be cached)

  3. Monitor logs for cache activity:
     - First request: database query logged
     - Second request: no database query (cache hit)

- [ ] **Cache Invalidation Working**

  1. Get current state:
     ```bash
     curl -X GET http://localhost:3000/api/admin/subscriptions/global-state \
       -H "Authorization: Bearer {admin-token}"
     ```

     Note the `globalSubscriptionEnabled` value

  2. Toggle state:
     ```bash
     curl -X POST http://localhost:3000/api/admin/subscriptions/global-state \
       -H "Authorization: Bearer {admin-token}" \
       -H "Content-Type: application/json" \
       -d '{"enabled": false}'
     ```

     Expected: HTTP 200, cache invalidated

  3. Get state again:
     ```bash
     curl -X GET http://localhost:3000/api/admin/subscriptions/global-state \
       -H "Authorization: Bearer {admin-token}"
     ```

     Expected: HTTP 200 with new state (opposite of step 1)

---

## Subscription Toggle Endpoint Testing

### Test 1: Get Current State

- [ ] **Test GET /admin/subscriptions/global-state**

  ```bash
  curl -X GET http://localhost:3000/api/admin/subscriptions/global-state \
    -H "Authorization: Bearer {admin-token}" \
    -H "Accept: application/json"
  ```

  Expected response (HTTP 200):
  ```json
  {
    "success": true,
    "globalSubscriptionEnabled": true,
    "cachedAt": "2024-01-15T10:30:00Z"
  }
  ```

  Verify:
  - [ ] HTTP status is 200
  - [ ] `success` is `true`
  - [ ] `globalSubscriptionEnabled` is a boolean
  - [ ] `cachedAt` is a valid ISO date (optional field)

### Test 2: Toggle to Disabled

- [ ] **Test POST with enabled: false**

  ```bash
  curl -X POST http://localhost:3000/api/admin/subscriptions/global-state \
    -H "Authorization: Bearer {admin-token}" \
    -H "Content-Type: application/json" \
    -d '{"enabled": false}'
  ```

  Expected response (HTTP 200):
  ```json
  {
    "success": true,
    "globalSubscriptionEnabled": false,
    "previousState": true,
    "message": "Subscriptions disabled",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
  ```

  Verify:
  - [ ] HTTP status is 200
  - [ ] `globalSubscriptionEnabled` is `false`
  - [ ] `previousState` is `true` (or previous value)
  - [ ] `updatedAt` is a valid ISO date
  - [ ] Database was updated (check MongoDB directly)
  - [ ] Cache was invalidated

### Test 3: Toggle Back to Enabled

- [ ] **Test POST with enabled: true**

  ```bash
  curl -X POST http://localhost:3000/api/admin/subscriptions/global-state \
    -H "Authorization: Bearer {admin-token}" \
    -H "Content-Type: application/json" \
    -d '{"enabled": true}'
  ```

  Expected response (HTTP 200):
  ```json
  {
    "success": true,
    "globalSubscriptionEnabled": true,
    "previousState": false,
    "message": "Subscriptions enabled",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
  ```

  Verify:
  - [ ] HTTP status is 200
  - [ ] `globalSubscriptionEnabled` is `true`
  - [ ] `previousState` is `false`

### Test 4: Validation Error

- [ ] **Test POST with invalid data type**

  ```bash
  curl -X POST http://localhost:3000/api/admin/subscriptions/global-state \
    -H "Authorization: Bearer {admin-token}" \
    -H "Content-Type: application/json" \
    -d '{"enabled": "true"}'  # String instead of boolean
  ```

  Expected response (HTTP 400):
  ```json
  {
    "success": false,
    "message": "enabled must be a boolean"
  }
  ```

  Verify:
  - [ ] HTTP status is 400
  - [ ] Error message is descriptive
  - [ ] State did NOT change

### Test 5: Authentication Error

- [ ] **Test without admin token**

  ```bash
  curl -X POST http://localhost:3000/api/admin/subscriptions/global-state \
    -H "Content-Type: application/json" \
    -d '{"enabled": false}'  # No Authorization header
  ```

  Expected response (HTTP 401):
  ```json
  {
    "success": false,
    "message": "Non autorisé: Token manquant"
  }
  ```

  Verify:
  - [ ] HTTP status is 401
  - [ ] State did NOT change

---

## Feature Gate Verification

### Test 1: When Global State is OFF

- [ ] **Toggle subscriptions OFF**

  ```bash
  curl -X POST http://localhost:3000/api/admin/subscriptions/global-state \
    -H "Authorization: Bearer {admin-token}" \
    -H "Content-Type: application/json" \
    -d '{"enabled": false}'
  ```

- [ ] **Request premium feature (should be blocked for all users)**

  Test with a premium user (normally has access):
  ```bash
  curl -X GET http://localhost:3000/api/stream/{stream-id}/1080p \
    -H "Authorization: Bearer {premium-user-token}"
  ```

  Expected response (HTTP 403):
  ```json
  {
    "success": false,
    "message": "Premium features are currently disabled"
  }
  ```

  Verify:
  - [ ] HTTP status is 403
  - [ ] All users (including premium) blocked
  - [ ] Premium features inaccessible

### Test 2: When Global State is ON

- [ ] **Toggle subscriptions ON**

  ```bash
  curl -X POST http://localhost:3000/api/admin/subscriptions/global-state \
    -H "Authorization: Bearer {admin-token}" \
    -H "Content-Type: application/json" \
    -d '{"enabled": true}'
  ```

- [ ] **Premium user can access premium features**

  ```bash
  curl -X GET http://localhost:3000/api/stream/{stream-id}/1080p \
    -H "Authorization: Bearer {premium-user-token}"
  ```

  Expected: HTTP 200 (or appropriate response for the endpoint)

  Verify:
  - [ ] Premium features accessible to premium users
  - [ ] Free tier users still blocked (403)

---

## Audit History Testing

- [ ] **Retrieve Audit History**

  ```bash
  curl -X GET "http://localhost:3000/api/admin/subscriptions/audit-history?limit=10" \
    -H "Authorization: Bearer {admin-token}"
  ```

  Expected response (HTTP 200):
  ```json
  {
    "success": true,
    "auditLogs": [
      {
        "id": "log-id-1",
        "adminEmail": "admin@example.com",
        "previousState": false,
        "newState": true,
        "timestamp": "2024-01-15T10:30:00Z",
        "httpStatusCode": 200,
        "requestIpAddress": "192.168.1.1"
      }
    ]
  }
  ```

  Verify:
  - [ ] HTTP status is 200
  - [ ] Logs are in reverse chronological order (most recent first)
  - [ ] Each toggle is recorded with admin email, previous/new state, timestamp
  - [ ] All recent toggles appear in history

---

## Performance Verification (Optional but Recommended)

- [ ] **Measure Cache Performance**

  Use `time` command or monitoring tools:

  ```bash
  time curl -X GET http://localhost:3000/api/admin/subscriptions/global-state \
    -H "Authorization: Bearer {admin-token}"
  ```

  Expected: Response time <10ms (after cache warmup)

- [ ] **Monitor Under Load**

  Use load testing tool (e.g., Apache Bench, wrk, k6):

  ```bash
  # Example with Apache Bench (1000 requests, 10 concurrent)
  ab -n 1000 -c 10 -H "Authorization: Bearer {token}" \
    http://localhost:3000/api/admin/subscriptions/global-state
  ```

  Expected:
  - [ ] No errors or timeouts
  - [ ] Average response time <10ms
  - [ ] 100% success rate (HTTP 200)

---

## Monitoring and Logging

- [ ] **Application Logs Configured**

  Verify logs are being written to:
  - [ ] Console output (viewable with `npm logs` or `pm2 logs`)
  - [ ] File (if file logging is configured)
  - [ ] Log aggregation service (if configured)

- [ ] **Monitor for Errors**

  Check logs for errors during initial period:
  ```bash
  npm logs | grep -i "error\|subscription"
  ```

  Look for:
  - [ ] No "subscription initialization failed" errors
  - [ ] No "database connection" errors
  - [ ] Normal startup messages present

---

## Post-Deployment Handoff

- [ ] **Documentation Updated**

  - [ ] API documentation available to teams (see API_DOCUMENTATION.md)
  - [ ] Deployment checklist shared with ops/infrastructure teams
  - [ ] Troubleshooting guide created
  - [ ] Admin instructions for toggling subscriptions created

- [ ] **Rollback Plan**

  In case of issues:

  - [ ] Procedure to disable feature gate (temporary workaround)
  - [ ] Process to rollback to previous version
  - [ ] Contact for emergency support
  - [ ] Incident response procedures

- [ ] **Monitoring Dashboard Configured**

  - [ ] Database operations monitored (connection pool, query performance)
  - [ ] Cache hit/miss ratio tracked
  - [ ] API response time percentiles tracked (p50, p95, p99)
  - [ ] Error rate monitored
  - [ ] Audit log volume monitored

---

## Rollback Instructions (If Needed)

If the subscription control system needs to be rolled back:

1. **Stop Application**
   ```bash
   npm stop
   # or
   pm2 stop "chiller-api"
   ```

2. **Revert Code**
   ```bash
   git checkout {previous-commit}
   npm run build
   ```

3. **Restart Application**
   ```bash
   npm start
   ```

4. **Verify System**
   - Premium features should work normally (subscription system enabled)
   - No 403 responses from feature gate
   - Application logs show normal startup

**Note:** User subscription data in MongoDB will NOT be affected by rollback. The SystemSettings and AuditLog collections will remain (no data loss).

---

## Requirements Validation

This deployment checklist ensures the following requirements are met:

- **1.5**: Global subscription state persists through deployment
- **7.1**: MongoDB indexes created (systemSettings.settingKey unique, auditLogs.timestamp, auditLogs.adminId, auditLogs.action)
- **7.1**: Migration script ran and validated
- **7.2**: Cache functionality verified (Redis optional, in-memory default)
- **8.1**: Feature gate blocking premium features appropriately (403 when OFF)
- **8.2**: Feature gate allowing premium features when appropriate (ON with valid subscription)

---

## Troubleshooting

### Issue: Migration Script Fails

**Symptom:** `npm run migrate:system-settings` exits with error

**Solution:**
1. Check MongoDB connection: `mongosh {MONGODB_URI}`
2. Verify user permissions: `db.serverStatus()`
3. Check logs for specific error message
4. If indexes issue: try running migrations again (idempotent)

### Issue: Cache Not Working

**Symptom:** Every GET request takes 5-10ms (seems to hit database)

**Solution:**
1. Verify memory is available: `free -h` (Linux) or `memory` (macOS)
2. Check Node.js process memory: `ps aux | grep node`
3. If Redis configured, verify Redis is running: `redis-cli ping`
4. Restart application to reset cache

### Issue: Feature Gate Always Denies Access

**Symptom:** Even premium users get 403 response

**Solution:**
1. Check global state: GET /admin/subscriptions/global-state
2. If OFF, toggle back ON: POST with `{"enabled": true}`
3. Verify user has premium subscription: Check User model in database
4. Check feature gate middleware is applied to the route

### Issue: Audit History Empty

**Symptom:** GET /admin/subscriptions/audit-history returns empty array

**Solution:**
1. Verify toggles are actually happening (check global state changes)
2. Check AuditLog collection exists: `db.auditlogs.countDocuments()`
3. Verify admin email is correct in AuditLog entries
4. Check for database errors in application logs

