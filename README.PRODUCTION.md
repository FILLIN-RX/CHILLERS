# 🎬 CHILLERS - Production Deployment Guide

## Quick Status

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend (Next.js) | ✅ Ready | Deploy to Vercel |
| Backend (Express) | ✅ Ready | Deploy to Render |
| Database (MongoDB) | ⏳ Setup Required | Use MongoDB Atlas |
| Security | ✅ Implemented | **Credentials need rotation** |
| Tests | ✅ Ready | Run before deploying |
| Documentation | ✅ Complete | See list below |

---

## 📚 Read These First

**In this order:**
1. [`PRODUCTION_CHECKLIST.md`](./PRODUCTION_CHECKLIST.md) - What you need to do (START HERE)
2. [`SECURITY.md`](./SECURITY.md) - Security best practices
3. [`DEPLOYMENT.md`](./DEPLOYMENT.md) - Step-by-step deployment

---

## 🚨 CRITICAL: Actions Required Today

### 1. Rotate Exposed Credentials
All these are **exposed in GitHub** and must be rotated:
- Google OAuth credentials
- TMDB API token  
- MongoDB password
- Streaming provider API keys
- JWT secrets

**Do this NOW:**
```bash
# 1. Generate new credentials
# - Create new Google OAuth app
# - Generate new TMDB token
# - Change MongoDB password
# - Create new JWT secret

# 2. Remove old values from .env and .env.local
# - Replace with placeholder values
# - Never commit real credentials

# 3. Commit the cleanup
git add .env .env.local
git commit -m "Remove exposed credentials"
git push
```

### 2. Set Up Production Environment Variables

**On Vercel (Frontend):**
```bash
# Use Vercel CLI or dashboard
vercel env add AUTH_GOOGLE_ID
vercel env add AUTH_GOOGLE_SECRET
# ... add all variables from .env.production
```

**On Render (Backend):**
```bash
# Use Render dashboard
# Settings → Environment Variables
# Add all variables from backend/.env.example
```

### 3. Create MongoDB Atlas Production Cluster
```bash
1. Go to https://www.mongodb.com/cloud/atlas
2. Create cluster in production region (near your users)
3. Set admin username/password (strong: 20+ chars)
4. Add IP whitelist:
   - Render server IP (from Render dashboard)
   - Your office/home IP (for debugging)
5. Enable encryption at rest
6. Configure daily backups (keep 30 days)
7. Copy connection string: mongodb+srv://...
```

---

## 🚀 Quick Deployment

### Step 1: Backend (Express)
```bash
# 1. Set environment variables on Render
# 2. Push code to GitHub
# 3. Render automatically deploys
# 4. Verify at: https://your-api.onrender.com/api/health
```

### Step 2: Frontend (Next.js)
```bash
# 1. Set environment variables on Vercel
# 2. Push code to GitHub
# 3. Vercel automatically deploys
# 4. Verify at: https://your-domain.vercel.app
```

### Step 3: Verify Everything Works
```bash
# Test health endpoints
curl https://your-api.onrender.com/api/health
curl https://your-domain.vercel.app/api/health

# Test login
curl -X POST https://your-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}'
```

---

## 🔑 Environment Variables

### Frontend (.env, .env.local, .env.production)
```
NEXT_PUBLIC_API_URL=https://your-api-domain.com/api
AUTH_SECRET=your_32_char_secret
NEXTAUTH_SECRET=your_32_char_secret
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret
NEXT_PUBLIC_TMDB_TOKEN=your_tmdb_token
```

### Backend (backend/.env)
```
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/chillers
NODE_ENV=production
JWT_SECRET=your_32_char_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$2a$10$... (bcrypt hashed)
DOODSTREAM_API_KEY=...
UQLOAD_API_KEY=...
STREAMTAPE_API_KEY=...
CORS_ORIGIN=https://your-frontend-domain.com
```

---

## 🧪 Before You Deploy

### Run Tests
```bash
# Frontend
npm run lint
npm run build

# Backend
cd backend
npm run lint
npm run build
npm run test
```

### Manual Testing Checklist
- [ ] Can you log in to the admin panel?
- [ ] Can you toggle the global subscription state?
- [ ] Are rate limiting headers present?
- [ ] Is CSRF protection working?
- [ ] Are error messages generic (no stack traces)?

---

## 📊 Monitoring After Deploy

### First 24 Hours
- [ ] Monitor error logs
- [ ] Check database connection stability
- [ ] Verify cron jobs running (if applicable)
- [ ] Monitor API response times

### Ongoing
- [ ] Set up error alerts (Sentry, LogRocket)
- [ ] Monitor database backups
- [ ] Review rate limiting metrics
- [ ] Check security headers monthly

---

## 🆘 Troubleshooting

### Frontend won't load
```bash
# Check Vercel logs
vercel logs
# Likely causes:
# - Missing env variable
# - Build error (check npm run build locally)
```

### Backend crashes
```bash
# Check Render logs
# Settings → Logs
# Likely causes:
# - MONGO_URI incorrect
# - Missing environment variables
# - Port already in use
```

### Database connection fails
```bash
# Check MongoDB Atlas
# Clusters → Connect
# - Verify IP whitelist includes Render server IP
# - Test connection string locally
mongosh "your-connection-string"
```

### API rate limiting too strict
```bash
# Edit backend/src/middleware/rate-limit.middleware.ts
# Adjust maxRequests and windowMs values
# Redeploy
```

---

## 🔐 Security Checklist

Before going live:

- [ ] All secrets rotated (see CRITICAL section)
- [ ] HTTPS enforced (Vercel & Render default)
- [ ] CORS restricted to your domain
- [ ] JWT_SECRET is strong (32+ chars, random)
- [ ] Admin password hashed with bcrypt
- [ ] Database backups automated
- [ ] Security headers present (tested with curl -I)
- [ ] Error messages don't expose internals
- [ ] Rate limiting working
- [ ] CSRF protection working

---

## 📞 Support

**Vercel Issues:**
- Docs: https://vercel.com/docs
- Support: https://vercel.com/support

**Render Issues:**
- Docs: https://render.com/docs
- Support: https://render.com/support

**MongoDB Issues:**
- Docs: https://docs.mongodb.com
- Support: https://support.mongodb.com

---

## 📖 Full Documentation

- **PRODUCTION_CHECKLIST.md** - Complete checklist with sign-off
- **SECURITY.md** - Detailed security guidelines
- **DEPLOYMENT.md** - Step-by-step deployment with troubleshooting
- **.env.production** - Production environment template
- **backend/.env.example** - Backend environment template

---

## ✅ Next Steps

1. **TODAY**: Rotate all exposed credentials (Section 🚨)
2. **THIS WEEK**: Set up MongoDB Atlas cluster
3. **NEXT WEEK**: Deploy backend and frontend
4. **ONGOING**: Monitor and maintain

---

## 🎯 Success Criteria

Your app is production-ready when:
- [ ] All secrets rotated and secured
- [ ] Backend responds with 200 at `/api/health`
- [ ] Frontend loads without errors
- [ ] You can log in to admin panel
- [ ] You can toggle global subscription state
- [ ] Rate limiting is working
- [ ] Database backups are automated
- [ ] Monitoring/alerts are configured

---

**Last Updated:** 2026-09-15  
**Version:** 1.0.0 - Production Ready  
**Status:** ✅ READY (See 🚨 for actions required)

---

**⚠️ REMINDER:** Rotate credentials first, deploy second.
Don't skip the security checklist!
