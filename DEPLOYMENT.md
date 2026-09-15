# CHILLERS Deployment Guide

## Pre-Deployment Checklist

### 1. Local Testing
```bash
# Frontend
npm install
npm run build
npm run lint
npm run test

# Backend
cd backend
npm install
npm run build
npm run lint
npm run test
```

### 2. Environment Variables
All production secrets must be set on the deployment platform, NOT in code.

**Frontend (Vercel):**
- Project Settings → Environment Variables
- Add all variables from `.env.production`

**Backend (Render):**
- Dashboard → Environment → Environment Variables
- Add all variables from `backend/.env` template

#### Required Secrets
```
FRONTEND:
- AUTH_SECRET (32+ chars)
- NEXTAUTH_SECRET (32+ chars)
- AUTH_GOOGLE_ID
- AUTH_GOOGLE_SECRET
- NEXT_PUBLIC_TMDB_TOKEN

BACKEND:
- MONGO_URI (production MongoDB Atlas)
- JWT_SECRET (32+ chars)
- ADMIN_USERNAME
- ADMIN_PASSWORD (bcrypt hashed)
- DOODSTREAM_API_KEY
- UQLOAD_API_KEY
- STREAMTAPE_API_KEY
- SMTP credentials (if email enabled)
```

### 3. Database Setup

#### MongoDB Atlas
1. Create cluster in production region
2. Enable IP Whitelist - add only:
   - Render server IP (get from Render dashboard)
   - Your office/home IP (for admin access)
3. Create database user (strong password, 20+ chars)
4. Enable encryption at rest
5. Configure automated backups (daily, keep 30 days)

#### Initialize Collections
```bash
# Run locally or on Render SSH
cd backend
npm run migrate:system-settings
```

This creates the SystemSettings collection with default global subscription state.

### 4. Deployment Process

#### Frontend (Next.js on Vercel)

**Option 1: GitHub Integration**
1. Push code to GitHub
2. Vercel automatically detects push
3. Runs build and deployment
4. Access at `https://your-domain.vercel.app`

**Option 2: Manual Deploy**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

#### Backend (Express on Render)

**Option 1: GitHub Integration**
1. Connect Render to GitHub repository
2. Create New → Web Service
3. Select repository and branch
4. Configure:
   - **Name**: chillers-backend
   - **Runtime**: Node
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Start Command**: `cd backend && npm run start`
   - **Region**: Same as database
5. Add all environment variables
6. Deploy

**Option 2: Docker Deploy**
```bash
# Create Dockerfile in backend/
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
CMD ["npm", "start"]

# Deploy to Render
vercel deploy
```

### 5. Post-Deployment Verification

#### Frontend
```bash
# Test health endpoint
curl https://your-domain.com/api/health

# Test CSRF token
curl https://your-domain.com/api/csrf-token
```

#### Backend
```bash
# Test health check
curl https://your-api.com/api/health

# Verify admin authentication
curl -X POST https://your-api.com/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'

# Check global subscription state
curl https://your-api.com/api/admin/subscriptions/global-state \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Database
```bash
# Connect to MongoDB Atlas
mongosh "mongodb+srv://username:password@cluster.mongodb.net/chillers"

# Verify collections
db.systemsettings.findOne()
db.auditlogs.findOne()
db.users.countDocuments()
```

### 6. Monitoring & Alerts

#### Vercel
- Dashboard monitors build and deployment
- Email alerts on deployment failures
- Analytics for performance metrics

#### Render
- Logs available in dashboard
- Set up alerts for:
  - Deployment failures
  - Memory/CPU usage spikes
  - API errors (5xx responses)

#### Recommended: Set Up Error Tracking
```bash
# Option 1: Sentry
npm install @sentry/node

# Option 2: LogRocket
npm install logrocket

# Option 3: Custom logging to MongoDB
# Already configured in backend
```

### 7. SSL/TLS Certificates

**Automatically handled by:**
- Vercel (free Let's Encrypt)
- Render (free Let's Encrypt)

No additional configuration needed.

### 8. Custom Domain Setup

#### Frontend (Vercel)
1. Project Settings → Domains
2. Add your domain (e.g., `chillers.com`)
3. Follow DNS instructions

#### Backend (Render)
1. Settings → Custom Domain
2. Add your domain (e.g., `api.chillers.com`)
3. Follow DNS instructions

#### DNS Configuration
```
Frontend: chillers.com → Vercel nameservers
Backend: api.chillers.com → Render nameservers
CNAME records created automatically
```

### 9. CDN Setup (Optional)

For faster content delivery:

```bash
# Use Cloudflare
1. Add site to Cloudflare
2. Update nameservers at domain registrar
3. Set SSL/TLS to "Strict"
4. Enable Page Rules for streaming optimization
```

### 10. Backup Strategy

#### Database Backups
- MongoDB Atlas: Automated daily snapshots (30-day retention)
- Test restores monthly
- Keep one manual backup per major release

#### Application Code
- Git repository is your primary backup
- Tag releases: `git tag -a v1.0.0 -m "Production release"`

#### User Data Backups
```bash
# Monthly backup of user subscription data
mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/chillers" \
  --out=./backups/$(date +%Y-%m-%d)
```

### 11. Scaling Considerations

#### When to Scale

**Frontend (Vercel):**
- Automatically scales (serverless)
- Monitor build times (>5 min = optimize code)

**Backend (Render):**
- Add more instances when:
  - CPU consistently >70%
  - Memory consistently >80%
  - Response time >1000ms

```bash
# Upgrade in Render dashboard
Plan → Add another instance
```

#### Database Scaling
- Add read replicas when:
  - Read load is bottleneck
  - >1000 concurrent connections

```bash
# MongoDB Atlas
Cluster → Edit Configuration → Add Read-Only Replica
```

### 12. Troubleshooting Deployments

#### Frontend won't build
```bash
# Check build logs in Vercel
# Common issues:
- Incorrect env variable names
- TypeScript compilation errors
- Missing dependencies

# Fix:
1. npm install
2. npm run build (locally first)
3. Commit and redeploy
```

#### Backend crashes after deploy
```bash
# Check Render logs
# Common issues:
- Database connection failed
- Missing environment variables
- Port binding issue

# Fix:
1. Verify MONGO_URI is correct
2. Check all env variables set in Render
3. Check port (default 4000) is available
```

#### API calls timing out
```bash
# Check response time in logs
# Common issues:
- Database query too slow
- Streaming provider API slow
- Rate limiting triggered

# Fix:
1. Optimize MongoDB queries (add indexes)
2. Increase rate limits if needed
3. Check streaming provider status
```

### 13. Rollback Procedure

If deployment causes issues:

**Frontend (Vercel)**
```bash
# Vercel automatically keeps previous deployments
# Settings → Deployments → Click previous version → Promote to Production
```

**Backend (Render)**
```bash
# Manual rollback
git revert <commit-hash>
git push
# Render redeploys automatically
```

**Database (MongoDB)**
```bash
# Restore from automated backup
Atlas Dashboard → Backups → Restore
Select snapshot and target time
```

### 14. Performance Optimization

#### Frontend
```bash
# Analyze bundle size
npm run build
npm install -g webpack-bundle-analyzer
```

#### Backend
```bash
# Enable compression (already configured)
# Monitor query performance
db.systemsettings.find().explain("executionStats")
```

#### Images
- Vercel optimizes images automatically
- CDN caches for 1 day (configurable)

### 15. Security After Deployment

- [ ] Test HTTPS enforcement (all traffic redirected)
- [ ] Verify CSRF protection working
- [ ] Check rate limiting headers
- [ ] Review security headers with curl

```bash
curl -I https://your-api.com/api/health | grep -i "strict\|x-content\|security"
```

---

## Need Help?

**Render Support:** https://render.com/docs
**Vercel Support:** https://vercel.com/docs
**MongoDB Atlas:** https://docs.atlas.mongodb.com

**Last Updated:** 2026-09-15
**Version:** 1.0.0
