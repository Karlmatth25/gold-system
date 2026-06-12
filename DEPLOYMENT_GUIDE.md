# Deployment Guide — Gold System v5

## Prerequisites

- GitHub account with this repo forked
- Twelve Data API key (https://twelvedata.com/register)
- Render.com account (free tier)
- Vercel.com account (free tier)

---

## Step 1: Configure Twelve Data API Key

1. Go to https://twelvedata.com/register
2. Create free account (email only)
3. Copy your API key (starts with `demo_` or similar)
4. Save it securely — you'll need it in Step 3

**Free Plan**: 800 requests/day (enough for 5 min refresh = 288 req/day)

---

## Step 2: Deploy Backend (Render)

### 2.1 Connect GitHub

1. Go to https://render.com → Create account
2. Connect GitHub (Render → Dashboard → New → Web Service → GitHub)
3. Select this repository

### 2.2 Configure Backend

1. **Name**: `gold-system-api`
2. **Root Directory**: `backend`
3. **Environment**: Python 3
4. **Build Command**:
   ```bash
   pip install -r requirements.txt
   ```
5. **Start Command**:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
6. **Plan**: Free

### 2.3 Add Environment Variables

Click "Environment" → Add:

| Key | Value | Example |
|-----|-------|----------|
| `TWELVE_DATA_KEY` | Your API key | `abc123def456...` |
| `FRONTEND_URL` | Vercel domain | `https://gold-system.vercel.app` |

### 2.4 Deploy

1. Click "Create Web Service"
2. Wait 2-3 minutes for deployment
3. Copy the URL (e.g., `https://gold-system-api.onrender.com`)
4. Test: `curl https://gold-system-api.onrender.com/api/health`

**⚠️ Note**: Free tier sleeps after 15 min inactivity → first request takes 30-60s (wake-up)

---

## Step 3: Deploy Frontend (Vercel)

### 3.1 Connect GitHub

1. Go to https://vercel.com → Create account
2. Import project (Vercel → New Project → Import Git Repo)
3. Select this repository

### 3.2 Configure Frontend

1. **Project Name**: `gold-system`
2. **Root Directory**: `frontend`
3. **Framework**: Create React App (auto-detected)
4. **Build Command**: `npm run build` (default)
5. **Output Directory**: `build` (default)

### 3.3 Add Environment Variables

1. Go to Settings → Environment Variables
2. Add:

| Key | Value | Example |
|-----|-------|----------|
| `REACT_APP_API_URL` | Your Render URL | `https://gold-system-api.onrender.com` |

### 3.4 Deploy

1. Click "Deploy"
2. Wait 2-3 minutes
3. Vercel gives you a URL (e.g., `https://gold-system.vercel.app`)
4. Visit it!

**Important**: Update Render's `FRONTEND_URL` to match your Vercel URL:

1. Go to Render dashboard
2. Select `gold-system-api` service
3. Settings → Environment
4. Update `FRONTEND_URL` = your Vercel URL
5. Manual deploy (Render will redeploy automatically)

---

## Step 4: Verify Everything Works

### 4.1 Test Backend

```bash
# Health check
curl https://gold-system-api.onrender.com/api/health

# Macro data
curl https://gold-system-api.onrender.com/api/macro

# Swagger docs
open https://gold-system-api.onrender.com/docs
```

### 4.2 Test Frontend

1. Open your Vercel URL in browser
2. Check "Dashboard" tab loads data
3. Verify bias (LONG/SHORT/NEUTRAL)
4. Verify session (LONDON/OVERLAP/NEW YORK/CLOSED)
5. Verify all 5 instruments display

### 4.3 Test Rate Limiting

```bash
# Send 11 requests in 60s — 11th should fail with 429
for i in {1..11}; do
  curl https://gold-system-api.onrender.com/api/macro
  sleep 5  # 5-second delay between requests
done
```

---

## Step 5: Configuration

### Optional: Custom Domain

#### Vercel
1. Settings → Domains
2. Add your domain
3. Add DNS records (Vercel shows them)

#### Render
1. Settings → Custom Domain
2. Add your domain
3. Update Render's nameservers at your DNS provider

---

## Monitoring

### Render Dashboard

- View logs: Logs tab (error messages, API key issues)
- Monitor metrics: Memory, CPU, requests
- Set up alerts: Email on deployment failures

### Vercel Dashboard

- View logs: Deployments tab
- Monitor analytics: Requests, errors, performance
- Real User Monitoring: Browser performance metrics

### Health Check

Set up periodic pings to avoid sleep:

```bash
# Add to cron job (every 14 minutes)
curl https://gold-system-api.onrender.com/api/health
```

Alternatively, use Render's native uptime monitoring.

---

## Troubleshooting

### Issue: "502 Bad Gateway"

**Cause**: Backend crashed or not starting

**Solution**:
1. Check Render logs for error messages
2. Verify `TWELVE_DATA_KEY` is set
3. Check `requirements.txt` has all dependencies
4. Restart service: Render dashboard → Manual deploy

### Issue: "CORS Error" in Frontend

**Cause**: `FRONTEND_URL` env var mismatch

**Solution**:
1. Render → Environment Variables
2. Update `FRONTEND_URL` to exactly match your Vercel URL
3. Manual deploy

### Issue: "Impossible de récupérer les données"

**Cause 1**: Backend is sleeping (free tier)

**Solution**: Wait 30-60s for wake-up, then retry

**Cause 2**: Invalid `TWELVE_DATA_KEY`

**Solution**:
1. Generate new key at twelvedata.com
2. Update Render environment variable
3. Manual deploy

### Issue: Rate Limit (429 Error)

**Cause**: Too many requests in 60 seconds

**Solution**: Wait 1 minute, retry. (Frontend auto-retries every 5 min, so this shouldn't happen in normal use)

---

## Production Checklist

- [ ] Twelve Data API key is valid (test on twelvedata.com)
- [ ] Render backend deployed and `/api/health` responds
- [ ] Vercel frontend deployed and loads
- [ ] `FRONTEND_URL` in Render matches Vercel domain
- [ ] `REACT_APP_API_URL` in Vercel matches Render domain
- [ ] Data displays on dashboard (DXY, TLT, VIX, SPX, GOLD)
- [ ] Bias calculates (LONG/SHORT/NEUTRAL)
- [ ] Session shows current trading session
- [ ] Rate limiting works (send 11 requests → 429 error)
- [ ] Logs show no errors

---

## Post-Deployment

### Day 1: Monitor
- Check Render logs for crashes
- Verify data refreshes every 5 minutes
- Test on mobile device

### Week 1: Optimize
- Add custom domain (optional)
- Set up error tracking (Sentry, etc.)
- Monitor cache hit rate

### Month 1: Enhance
- Add database for trade history
- Implement email/Telegram notifications
- Add backtesting module

---

## Scaling (Future)

When free tier becomes insufficient:

1. **Render**: Upgrade to Starter ($7/mo) → no sleep, more memory
2. **Vercel**: Automatically scales (use Pro if needed for analytics)
3. **Database**: Add PostgreSQL ($7/mo) for trade history
4. **Cache**: Consider Redis ($5/mo) for faster lookups

**Estimated cost at scale**: $20/mo (all services combined)

---

## Support

- **Render Support**: https://render.com/docs
- **Vercel Support**: https://vercel.com/docs
- **Twelve Data Support**: https://twelvedata.com/docs
- **This Repo**: Check GitHub Issues

