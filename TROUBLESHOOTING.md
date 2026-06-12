# Troubleshooting — Gold System v5

## Common Issues & Solutions

### Backend Issues

#### Issue 1: "502 Bad Gateway" or "Service Unavailable"

**Symptoms**:
- Frontend shows "Impossible de récupérer les données"
- Curl to `/api/health` fails

**Causes & Solutions**:

1. **Backend crashed**
   - Check Render logs: Dashboard → Logs tab
   - Look for error messages (API key, import errors, etc.)
   - Solution: Fix error and manually deploy

2. **Twelve Data API key invalid**
   - Check Render Environment → `TWELVE_DATA_KEY`
   - Verify key is not `demo` (default fallback)
   - Solution: Generate new key at https://twelvedata.com, update env var, redeploy

3. **Port binding error**
   - Render tries to use `$PORT` env var
   - Check start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Solution: Render automatically sets $PORT, so this shouldn't happen

4. **Memory/CPU exhausted**
   - Check Render metrics: Dashboard → Metrics tab
   - Free tier has limited resources
   - Solution: Reduce request frequency, or upgrade to Starter plan

---

#### Issue 2: "CORS Error" in Browser Console

**Symptoms**:
```
Access to XMLHttpRequest at 'https://gold-system-api.onrender.com/api/macro'
from origin 'https://gold-system.vercel.app' has been blocked by CORS policy
```

**Cause**: `FRONTEND_URL` env var doesn't match Vercel domain

**Solution**:
1. Render → `gold-system-api` service → Settings → Environment
2. Find `FRONTEND_URL` variable
3. Verify it matches your Vercel URL exactly:
   - ✓ `https://gold-system.vercel.app`
   - ✗ `https://gold-system.vercel.app/`  (trailing slash)
   - ✗ `http://gold-system.vercel.app`   (missing https)
4. Update and manually deploy

---

#### Issue 3: Rate Limiting (429 Too Many Requests)

**Symptoms**:
- Error message: "HTTP 429"
- Frontend shows "Impossible de récupérer les données"

**Cause**: Sent >10 requests in 60 seconds

**Solution**:
- Default frontend refresh is 5 minutes (safe)
- If manually testing, wait 60 seconds between requests
- Rate limiter resets after 60s

**Check rate limit status**:
```bash
# In browser console
fetch('https://gold-system-api.onrender.com/api/macro')
  .then(r => {
    console.log('Status:', r.status);
    console.log('Headers:', r.headers);
  });
```

---

#### Issue 4: Twelve Data API Error

**Symptoms**:
```json
{
  "instruments": {
    "DXY": { "error": "Invalid API key", "symbol": "DX/USD" }
  }
}
```

**Causes**:

1. **Invalid API key**
   - Go to https://twelvedata.com → login
   - Check your API key format
   - Keys look like: `abc123def456ghi789jkl012mno345`
   - Free tier `demo` key only works for demo data

2. **API key expired**
   - Free tier keys don't expire, but credentials might be reset
   - Solution: Generate new key at twelvedata.com

3. **Rate limit exceeded (Twelve Data)**
   - Free tier: 800 requests/day
   - Current usage: 5 instruments × 288 requests/day = 1,440 req/day
   - ⚠️ **Problem**: We exceed free tier limit!
   - Solution: Increase refresh interval (frontend → line 4), or upgrade Twelve Data plan

4. **Market closed (symbol not trading)**
   - Some symbols only trade during certain hours
   - Solution: None needed, API returns last close price

---

#### Issue 5: Timeout (request hangs >15s)

**Symptoms**:
- Frontend shows loading spinner forever
- Browser dev tools shows network request hanging

**Causes**:

1. **Twelve Data slow response**
   - Each instrument has 12s timeout
   - 5 instruments = up to 60s theoretical (but usually 3-4s)
   - Solution: Frontend timeout is 15s, if exceeded → error

2. **Render backend sleeping**
   - Free tier sleeps after 15 min inactivity
   - First request wakes backend (30-60s delay)
   - Solution: Expected behavior, user sees delay once per session

3. **Network connectivity**
   - Check internet connection
   - Solution: Reconnect and retry

---

### Frontend Issues

#### Issue 6: Dashboard Doesn't Load

**Symptoms**:
- Blank page, or infinite spinner
- No data displayed

**Causes & Solutions**:

1. **API URL wrong**
   - Check Vercel Environment → `REACT_APP_API_URL`
   - Should match your Render domain: `https://gold-system-api.onrender.com`
   - Solution: Update and redeploy

2. **JavaScript error**
   - Open browser DevTools → Console tab
   - Look for red error messages
   - Common: "Cannot read property 'bias' of null"
   - Solution: Check API response, backend might have crashed

3. **Browser caching**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Clear browser cache: DevTools → Application → Clear storage

4. **Old Vercel deployment**
   - Vercel → Deployments → Check latest is "Ready"
   - If not, manually redeploy: Vercel → Deployments → Redeploy

---

#### Issue 7: Mobile Layout Broken

**Symptoms**:
- Cards overflow horizontally
- Text too small
- Tabs not clickable

**Causes & Solutions**:

1. **Viewport not set**
   - Check `frontend/public/index.html`:
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1" />
   ```
   - Should be present

2. **Grid columns too wide**
   - Check `frontend/src/index.css` for responsive media queries
   - Should have `@media (max-width: 768px)` breakpoint
   - Solution: Update CSS grid columns to `1fr` on mobile

3. **Font sizes too large**
   - Check App.jsx styling
   - Font sizes should reduce on mobile
   - Solution: Use media queries to adjust fontSize

---

#### Issue 8: Data Doesn't Refresh

**Symptoms**:
- Countdown timer shows, but data never updates
- Manual REFRESH button doesn't work

**Causes & Solutions**:

1. **API is down**
   - Check `/api/health` endpoint
   - `curl https://gold-system-api.onrender.com/api/health`
   - If 503/502, backend has issue (see Issue #1)

2. **Refresh interval too long**
   - Default is 5 minutes
   - Check `frontend/src/App.jsx` line 4
   - If you changed it to longer, wait longer

3. **Browser tab backgrounded**
   - Some browsers pause intervals when tab not focused
   - Solution: Click on tab to focus it

4. **JavaScript error in fetch**
   - Check browser console for errors
   - Common: "SyntaxError: Unexpected token < in JSON"
   - Cause: API returned HTML error page instead of JSON
   - Solution: Check backend logs

---

### Deployment Issues

#### Issue 9: Vercel Deploy Fails

**Symptoms**:
- Vercel shows red "Failed" status on deployment

**Causes & Solutions**:

1. **Missing dependencies**
   - Check `frontend/package.json`
   - Run locally: `npm install`
   - Solution: Add missing packages and commit

2. **Build error**
   - Vercel logs show build error
   - Common: "Cannot find module 'react'"
   - Solution: Verify `package.json` and run `npm install` locally

3. **Environment variable missing**
   - Check Vercel → Environment Variables
   - `REACT_APP_*` variables must be set before build
   - Solution: Add variable, trigger redeploy

---

#### Issue 10: Render Deploy Fails

**Symptoms**:
- Render shows red "Deploy failed" status

**Causes & Solutions**:

1. **Python version mismatch**
   - Check `runtime.txt` (if present)
   - Should be `python-3.9` or `python-3.11`
   - Solution: Match your local Python version

2. **Missing dependencies**
   - Check `backend/requirements.txt`
   - If you added new packages, commit and push
   - Solution: Render auto-detects changes

3. **Build script fails**
   - Render logs show `pip install` error
   - Common: "Package XYZ not found"
   - Solution: Check package name spelling in requirements.txt

4. **Startup command wrong**
   - Check Render → Settings → Start Command
   - Should be: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Solution: Verify exact syntax (case-sensitive)

---

## Debug Mode

### Enable Verbose Logging

**Backend**:
```bash
# Render: Set LOG_LEVEL in Environment
LOG_LEVEL=DEBUG

# Local: Run with debug flag
python -m uvicorn main:app --reload --log-level debug
```

**Frontend**:
```javascript
// In browser console
window.DEBUG = true;  // Enable verbose logging

// Check all fetch calls
window.fetch = ((fn) => (url, opts) => {
  console.log('[FETCH]', url, opts);
  return fn(url, opts).then(r => {
    console.log('[RESPONSE]', r.status, r.headers);
    return r;
  });
})(window.fetch);
```

---

## Performance Checklist

If system is slow:

- [ ] Backend response time: <4 seconds (`/api/macro`)
- [ ] Frontend load time: <3 seconds (JavaScript parse + render)
- [ ] Cache hit rate: >95% (5-min TTL)
- [ ] Rate limit: No 429 errors (unless manually stress-testing)
- [ ] Database: Not yet implemented (add if needed)

---

## Getting Help

1. **Check logs first**
   - Render: Dashboard → Logs
   - Vercel: Deployments → View Build Logs
   - Browser: DevTools → Console

2. **Search similar issues**
   - GitHub Issues in this repo
   - Render docs: https://render.com/docs
   - Vercel docs: https://vercel.com/docs

3. **Create GitHub Issue**
   - Include: Error message, steps to reproduce, logs
   - Attach: Screenshots of error

4. **Contact Support**
   - Render: https://render.com/support
   - Vercel: https://vercel.com/support
   - Twelve Data: https://twelvedata.com/support

---

## Known Limitations

| Limitation | Details | Workaround |
|-----------|---------|------------|
| **Free tier sleep** | Render sleeps after 15 min inactivity | First request is slow (30-60s) |
| **API rate limit** | Twelve Data free = 800 req/day | Currently ~1,400 req/day needed, so upgrade plan or reduce frequency |
| **No database** | Only in-memory cache | Add PostgreSQL if persistence needed |
| **No auth** | Endpoints public | Add API key validation if needed |
| **No SSL** | HTTPS only (safe) | Render/Vercel handle automatically |

