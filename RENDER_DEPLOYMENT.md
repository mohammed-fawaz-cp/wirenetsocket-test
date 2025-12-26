# Render Deployment Guide

## Quick Answer to Your Question

**Q: What will happen when hosted on Render? Will it listen to all ports?**

**A:** No, it won't listen to "all ports" - it will listen to **one specific port** that Render assigns via the `PORT` environment variable. However, it will now bind to **all network interfaces** (`0.0.0.0`) instead of just `localhost`, which allows external connections.

---

## What Changed

### Before (Local Development Only)
```javascript
server.listen(PORT, () => { ... });
```
- Binds to `localhost` (127.0.0.1) by default
- ❌ Only accessible from within the same machine
- ❌ Won't work on Render

### After (Cloud-Ready)
```javascript
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => { ... });
```
- Binds to `0.0.0.0` (all network interfaces)
- ✅ Accessible from external networks
- ✅ Works on Render, Heroku, Railway, etc.

---

## Understanding Network Binding

### `0.0.0.0` Explained

**What it means:**
- Listen on **all available network interfaces**
- Accept connections from **any IP address**
- Required for cloud deployments

**What it does NOT mean:**
- ❌ Does NOT listen on multiple ports
- ❌ Does NOT open all ports
- ❌ Does NOT bypass firewalls

**Analogy:**
Think of it like a phone number:
- `127.0.0.1` (localhost) = Internal extension (only works inside the building)
- `0.0.0.0` = Public phone number (anyone can call)

You still have **one phone** (one port), but now it accepts **external calls**.

---

## Render Deployment Steps

### 1. Create `render.yaml` (Optional but Recommended)

This file tells Render how to deploy your service:

```yaml
services:
  - type: web
    name: wirenet-socket-service
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: FIREBASE_SERVICE_ACCOUNT_PATH
        value: /etc/secrets/firebase-service-account.json
```

### 2. Add Firebase Service Account as Secret

**Option A: Environment Variable (Recommended)**

1. Go to Render Dashboard → Your Service → Environment
2. Add secret file:
   - **Key:** `FIREBASE_SERVICE_ACCOUNT_JSON`
   - **Value:** Paste entire JSON content
3. Update server to read from env var:

```javascript
// In server.js, replace the Firebase initialization:
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} else {
  serviceAccount = require(FIREBASE_SERVICE_ACCOUNT_PATH);
}
```

**Option B: Secret Files (Alternative)**

1. Render Dashboard → Environment → Secret Files
2. Add file: `firebase-service-account.json`
3. Paste JSON content

### 3. Configure Environment Variables

In Render Dashboard → Environment, add:

| Key | Value | Notes |
|-----|-------|-------|
| `PORT` | (auto-set by Render) | Don't set manually |
| `NODE_ENV` | `production` | Optional |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `{...}` | Paste JSON content |

### 4. Deploy

**From GitHub:**
1. Connect your GitHub repository
2. Render auto-deploys on push to main branch

**Manual Deploy:**
```bash
git push origin main
```

Render will:
1. Run `npm install`
2. Run `npm start`
3. Assign a port (e.g., 10000)
4. Provide a URL: `https://your-service.onrender.com`

---

## How Render Handles Ports

### Port Assignment

Render **automatically assigns** a port via environment variable:
```bash
PORT=10000  # Example - Render chooses this
```

Your server reads it:
```javascript
const PORT = process.env.PORT || 3000;
// On Render: PORT = 10000
// Locally: PORT = 3000
```

### Network Flow

```
Internet
  ↓
Render Load Balancer (HTTPS on port 443)
  ↓
Your Service (HTTP on PORT, bound to 0.0.0.0)
  ↓
Your Socket.IO server
```

**Key Points:**
- Render handles HTTPS termination
- Your service receives HTTP traffic
- Port is dynamic (assigned by Render)
- Binding to `0.0.0.0` allows Render's load balancer to reach your service

---

## Socket.IO on Render

### Client Connection

**Production URL:**
```javascript
const socket = io('https://your-service.onrender.com');
```

**Important:** Use `https://` not `http://` - Render provides SSL automatically.

### CORS Configuration

Your current CORS config is already correct:
```javascript
const io = new Server(server, {
  cors: {
    origin: '*',  // ✅ Allows all origins
    methods: ['GET', 'POST']
  }
});
```

For production, you might want to restrict origins:
```javascript
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST']
  }
});
```

Then set environment variable:
```
ALLOWED_ORIGINS=https://yourapp.com,https://www.yourapp.com
```

---

## Testing After Deployment

### 1. Health Check
```bash
curl https://your-service.onrender.com/health
```

Expected:
```json
{
  "status": "ok",
  "firebase": true,
  "timestamp": 1735189092680
}
```

### 2. API Endpoints
```bash
curl -X POST https://your-service.onrender.com/setToken \
  -H "Content-Type: application/json" \
  -d '{"userId":"test_user","deviceId":"test_device","fcmToken":"test_token"}'
```

### 3. Socket.IO Connection

Update `test-client.html`:
```javascript
const socket = io('https://your-service.onrender.com');
```

Open in browser and verify "Connected" status.

---

## Common Issues & Solutions

### Issue: "Application failed to respond"

**Cause:** Server not binding to `0.0.0.0`

**Solution:** ✅ Already fixed! Your server now binds to `0.0.0.0`

### Issue: "Firebase not initialized"

**Cause:** Missing service account JSON

**Solution:** Add as environment variable or secret file (see Step 2 above)

### Issue: "CORS error"

**Cause:** Restrictive CORS policy

**Solution:** Your current `origin: '*'` allows all origins (already correct)

### Issue: "Socket.IO connection timeout"

**Cause:** Client using wrong protocol or URL

**Solution:** 
- Use `https://` not `http://`
- Use Render-provided URL, not `localhost`

---

## Database Persistence

### Current Setup (In-Memory)

⚠️ **Warning:** SQLite database (`tokens.db`) is stored in-memory on Render's ephemeral filesystem.

**What this means:**
- Database resets on every deploy
- Database resets if service restarts
- Not suitable for production

### Production Solution

**Option 1: Render PostgreSQL (Recommended)**

1. Add PostgreSQL database in Render
2. Replace `better-sqlite3` with `pg` (PostgreSQL client)
3. Update schema and queries

**Option 2: External Database**

- Supabase (PostgreSQL)
- PlanetScale (MySQL)
- MongoDB Atlas

**Option 3: Persistent Disk (Render)**

- Render offers persistent disks
- Mount at `/data`
- Store `tokens.db` there

---

## Environment Variables Summary

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `PORT` | Auto-set | 3000 | Server port (Render assigns) |
| `HOST` | No | `0.0.0.0` | Network binding |
| `NODE_ENV` | No | - | Environment (production/development) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes* | - | FCM credentials |
| `ALLOWED_ORIGINS` | No | `*` | CORS allowed origins |

*Required for FCM functionality

---

## Performance Considerations

### Free Tier Limitations

Render Free Tier:
- ⚠️ Service spins down after 15 minutes of inactivity
- ⚠️ Cold start takes 30-60 seconds
- ✅ Sufficient for testing and low-traffic apps

### Scaling

For production:
- Use **Starter** plan or higher ($7/month)
- No cold starts
- Better performance
- Persistent connections

---

## Final Checklist

Before deploying to Render:

- [x] Server binds to `0.0.0.0` ✅ (Already done!)
- [x] `PORT` read from environment variable ✅ (Already done!)
- [ ] Add Firebase service account as environment variable
- [ ] Test health endpoint after deployment
- [ ] Update client code to use production URL
- [ ] Consider database persistence strategy
- [ ] Set up monitoring/logging

---

## Quick Deploy Command

```bash
# 1. Initialize git (if not already)
git init
git add .
git commit -m "Initial commit"

# 2. Push to GitHub
git remote add origin https://github.com/yourusername/wirenet-socket-test.git
git push -u origin main

# 3. Connect to Render
# Go to https://dashboard.render.com
# Click "New +" → "Web Service"
# Connect your GitHub repo
# Render auto-deploys!
```

---

## Summary

**Your Question Answered:**

> "Will it listen to all ports?"

**No.** It listens to **one port** (assigned by Render via `PORT` env var), but binds to **all network interfaces** (`0.0.0.0`) so external clients can connect.

**What Changed:**
- ✅ Server now binds to `0.0.0.0` instead of `localhost`
- ✅ Ready for Render deployment
- ✅ No other changes needed for basic deployment

**Next Steps:**
1. Add Firebase service account to Render environment
2. Push to GitHub
3. Connect to Render
4. Deploy! 🚀
