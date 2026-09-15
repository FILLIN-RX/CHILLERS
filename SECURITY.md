# Security Guidelines for CHILLERS

## Critical Security Checklist for Production

### 1. Environment Variables & Secrets Management

**NEVER commit secrets to git.** Follow this pattern:

#### Frontend (.env vs .env.local)
- `.env` - Default development values (NOT real credentials)
- `.env.local` - Local development overrides (in .gitignore)
- `.env.production` - Template for production (values managed by Vercel)

#### Backend (backend/.env)
- `.env` - Template with placeholder values
- `.env.local` - Your local overrides (in .gitignore)
- Production: Secrets managed by Render/deployment platform

#### Secrets to Rotate Immediately
1. Google OAuth credentials (ID & Secret)
2. TMDB API token
3. MongoDB connection string and password
4. JWT_SECRET
5. ADMIN_USERNAME & ADMIN_PASSWORD
6. Streaming provider API keys (Doodstream, Uqload, Streamtape)
7. NextAuth secret keys

**How to securely set production secrets:**

**On Vercel (Frontend):**
```bash
# CLI: vercel env add VARIABLE_NAME
vercel env add AUTH_GOOGLE_ID
vercel env add AUTH_GOOGLE_SECRET
# Or use Vercel dashboard: Project Settings → Environment Variables
```

**On Render (Backend):**
```bash
# Use Render dashboard: Environment → Environment Variables
# Add each secret, then redeploy
```

### 2. JWT & Admin Authentication

#### JWT Secret Requirements
- Minimum 32 characters
- Random, cryptographically secure
- Unique for each environment

Generate strong JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Admin Credentials
- Use bcrypt for password hashing
- Do NOT store plaintext passwords
- Change default admin credentials

Hash admin password (one-time setup):
```bash
npm install -g bcryptjs
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('your_password', 10))"
```

Then set in `.env`:
```
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=$2a$10$... (bcrypt hashed value)
```

### 3. CSRF Protection

CSRF middleware is enabled on `/api/admin` and `/api/user` routes.

**For API clients:**
1. GET `/api/csrf-token` to obtain token
2. Include token in `X-CSRF-Token` header on all state-changing requests
3. Include `X-Session-ID` header from previous response

**Example:**
```javascript
// Get CSRF token
const csrfResponse = await fetch('/api/csrf-token', { 
  headers: { 'X-Session-ID': sessionId } 
});
const token = csrfResponse.headers.get('X-CSRF-Token');

// Use in request
fetch('/api/admin/subscriptions/global-state', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': token,
    'X-Session-ID': sessionId,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ enabled: true })
});
```

### 4. Rate Limiting

Applied to protect against brute force and DoS attacks:

- **Login/Registration**: 5 attempts per 15 minutes
- **General API**: 60 requests per minute
- **Streaming**: 300 requests per minute
- **Sensitive endpoints** (/admin): 10 requests per 15 minutes

**Headers returned:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1735689420
```

### 5. Database Security

#### MongoDB Atlas Setup
1. Enable IP Whitelist: Add only your production IPs
2. Use strong passwords (20+ characters, mixed case + numbers + symbols)
3. Enable encryption at rest and in transit (TLS/SSL)
4. Regular automated backups (MongoDB Atlas handles this)

#### Connection Security
```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/chillers?
  retryWrites=true&
  w=majority&
  tls=true&
  authSource=admin
```

### 6. API Security Headers

The following headers are automatically set:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: no-referrer
Content-Security-Policy: directives with frame-src allowlist
```

### 7. Authentication & Authorization

#### User Roles
- `user`: Regular user with subscription-based access
- `admin`: Full system access, restricted endpoints

#### Auth Flow
1. User logs in → JWT token issued (valid 24 hours)
2. Token sent in `Authorization: Bearer <token>` header
3. `requireAuth` middleware validates token on protected routes
4. `adminMiddleware` validates admin role on `/api/admin` routes

#### Token Storage (Frontend)
- Store in memory or session storage (NOT localStorage to prevent XSS)
- Never expose token in logs or error messages
- Clear on logout

### 8. Input Validation

**Always validate incoming data:**

```typescript
// Example: Subscription toggle endpoint validates boolean
if (typeof enabled !== 'boolean') {
  return res.status(400).json({ success: false, message: 'Invalid input' });
}
```

**Avoid:**
- Direct use of user input in queries (injection attacks)
- Exposing internal error messages
- Trusting client-side validation alone

### 9. CORS Configuration

Set to specific origins:

```
CORS_ORIGIN=https://your-production-domain.com
```

**NOT:** `*` (allow-all) in production

### 10. Error Handling

**Do:**
- Log full error details server-side
- Return generic error messages to clients
- Use HTTP status codes correctly

**Don't:**
- Expose database error messages to users
- Include stack traces in API responses
- Log sensitive data (passwords, tokens)

**Example:**
```typescript
catch (error: any) {
  console.error('[Admin] Full error:', error); // Server log
  res.status(500).json({
    success: false,
    message: 'Server error' // Generic for client
  });
}
```

### 11. Regular Security Practices

- [ ] **Dependency Updates**: Run `npm audit` weekly, update packages
- [ ] **Monitoring**: Set up alerts for suspicious activity
- [ ] **Backups**: Verify MongoDB backups working
- [ ] **Access Logs**: Monitor `/admin` endpoint access
- [ ] **Credential Rotation**: Rotate API keys every 90 days
- [ ] **Penetration Testing**: Consider security audit before major launch

### 12. Deployment Checklist

Before going to production:

- [ ] All secrets moved to environment variables (NOT in code)
- [ ] JWT_SECRET is strong (32+ chars, random)
- [ ] Admin credentials hashed with bcrypt
- [ ] CORS_ORIGIN set to production domain
- [ ] MONGO_URI uses production MongoDB Atlas cluster
- [ ] NODE_ENV=production
- [ ] CSRF protection enabled
- [ ] Rate limiting configured
- [ ] HTTPS enforced (Vercel & Render default)
- [ ] Security headers configured (helmet.js)
- [ ] Error logging configured
- [ ] Database backups enabled

### 13. Incident Response

If credentials are leaked:

1. **Immediately rotate** affected credential
2. **Review logs** for unauthorized access
3. **Reset user sessions** if user passwords exposed
4. **Update documentation** with new values
5. **Notify stakeholders**

## Reporting Security Issues

Found a security vulnerability? **Do NOT** post publicly.

Contact: [your-security-contact@example.com]

---

**Last Updated:** 2026-09-15
**Status:** Ready for Production Review
