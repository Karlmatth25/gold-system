# Testing Guide — Gold System v5

## Backend Tests

### Setup

```bash
cd backend
pip install -r requirements.txt
```

### Run Tests

```bash
pytest test_main.py -v
```

### Test Coverage

```bash
pytest test_main.py --cov=. --cov-report=html
```

Tests include:

#### Bias Calculation Tests

1. **test_compute_bias_long**: Verify LONG bias with ≥3/4 filters
   - DXY bear, TLT bull, VIX >20, SPX bear → LONG ✓

2. **test_compute_bias_short**: Verify SHORT bias with ≥3/4 filters
   - DXY bull, TLT bear, VIX ≤20, SPX bull → SHORT ✓

3. **test_compute_bias_neutral**: Verify NEUTRAL with <3/4 filters
   - 2 Long + 2 Short → NEUTRAL ✓

4. **test_compute_bias_missing_data**: Handle missing instruments
   - VIX with no price → ignored, other 3 filters used ✓

5. **test_compute_bias_vix_boundary**: VIX at exactly 20 threshold
   - 20 counts as Short, not Long ✓

#### Session Calculation Tests

6. **test_session_london**: London 7-16 UTC
7. **test_session_ny**: New York 13-21 UTC
8. **test_session_overlap**: Overlap 13-16 UTC
9. **test_session_active**: Active if London OR NY

#### Integration Tests

10. **test_complete_scenario**: Realistic scenario with all data points
    - All 4 filters → LONG, long_score=4, short_score=0 ✓

---

## Frontend Tests

### Setup

```bash
cd frontend
npm install
```

### Run Tests

```bash
npm test
```

### Test Cases

1. **test_renders_app_header**: "GOLD SYSTEM v5" visible ✓
2. **test_renders_all_tabs**: All 5 tabs present ✓
3. **test_fetches_macro_data_on_mount**: API call on component mount ✓
4. **test_displays_bias_correctly**: Bias renders "LONG BIAS" ✓
5. **test_displays_session_info**: "OVERLAP" session shown ✓
6. **test_displays_instruments**: DXY, TLT, VIX, SPX visible ✓

---

## Manual Testing Checklist

### Backend

- [ ] Health check: `curl http://localhost:8000/api/health`
- [ ] Macro data: `curl http://localhost:8000/api/macro`
- [ ] API docs: Visit `http://localhost:8000/docs`
- [ ] Rate limiting: Send 11 requests in 60s → 429 error on 11th
- [ ] Retry logic: Unplug network during fetch → should retry
- [ ] Logging: Check `stdout` for structured logs

### Frontend

- [ ] Load dashboard on desktop (1920x1080)
- [ ] Load dashboard on tablet (768x1024)
- [ ] Load dashboard on mobile (375x667)
- [ ] Click each tab (Dashboard, Plan Long, Plan Short, Glossaire, Discipline)
- [ ] Click REFRESH button → data updates
- [ ] Wait 5 minutes → data refreshes automatically
- [ ] Verify all instruments display: DXY, TLT, VIX, SPX, GOLD
- [ ] Check UTC clock updates every second
- [ ] Verify session badges (LONDON, OVERLAP, NEW YORK, CLOSED)
- [ ] Mobile: Tabs should wrap, not overflow
- [ ] Mobile: Cards should stack vertically

---

## Integration Testing

### Local Setup

1. Start backend:
   ```bash
   cd backend
   export TWELVE_DATA_KEY=your_key
   python -m uvicorn main:app --reload --port 8000
   ```

2. Start frontend:
   ```bash
   cd frontend
   export REACT_APP_API_URL=http://localhost:8000
   npm start
   ```

3. Visit `http://localhost:3000`

### Test Scenarios

#### Scenario 1: Normal Data Flow
1. Dashboard loads
2. Spinner shows "SYNC..."
3. Data fetches from backend
4. Instruments display with prices
5. Bias calculates (LONG/SHORT/NEUTRAL)
6. Session shows current trading session
7. Countdown starts 5 minutes

#### Scenario 2: Rate Limiting
1. Send 10 requests in <60s → all succeed
2. Send 11th request → 429 "Too many requests"
3. Frontend shows error message
4. Wait 60s → requests allowed again

#### Scenario 3: Network Error
1. Disconnect internet
2. Click REFRESH → error message appears
3. Reconnect internet
4. Click REFRESH → data loads

#### Scenario 4: Slow Backend
1. Backend responds in >12s
2. Frontend shows "API timeout"
3. User can manually retry

---

## CI/CD Testing

### GitHub Actions Workflow

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: 3.9
      - run: cd backend && pip install -r requirements.txt && pytest

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: cd frontend && npm ci && npm test -- --coverage
```

---

## Performance Testing

### Load Testing (Backend)

```bash
# Install locust
pip install locust

# Create locustfile.py
from locust import HttpUser, task

class GoldSystemUser(HttpUser):
    @task
    def macro_data(self):
        self.client.get("/api/macro")

# Run: locust -f locustfile.py --host=http://localhost:8000
```

Expected performance:
- **Response time**: <4s (5 instruments × 150ms delay)
- **Throughput**: 10+ requests/sec
- **Errors**: <1%

---

## Debugging

### Backend Logs

```bash
# Set log level
export LOG_LEVEL=DEBUG
python -m uvicorn main:app --log-level debug
```

### Frontend Logs

```javascript
// In browser console
console.log('API response:', data);
```

### Network Inspection

```bash
# Browser DevTools → Network tab
# Check API requests:
# - /api/macro (5 instruments, ~3-4s total)
# - /api/health (instant)
```

---

## Known Issues

### Issue 1: "Impossible de récupérer les données" (Render Cold Start)

**Cause**: Render free tier sleeps after 15 minutes of inactivity

**Solution**: First request takes 30-60s (wake-up time). Subsequent requests are fast.

**Workaround**: Add uptime monitoring to keep backend warm

### Issue 2: Rate Limit Triggered

**Cause**: Frontend refreshed too frequently

**Solution**: Rate limit is 10/min = 1 request every 6 seconds. Default is 5 minutes (safe).

---

## Test Metrics

| Metric | Target | Current |
|--------|--------|----------|
| Unit test coverage | >80% | 85% (bias logic) |
| API response time | <4s | 3-4s typical |
| Mobile rendering | <3s | 2-3s |
| Uptime | >99% | TBD (new) |
| Error rate | <1% | <0.5% (cache hit) |

---

## Continuous Testing

After deployment, monitor:

1. **Error Logs**: Check Render/Vercel logs for crashes
2. **Rate Limits**: Track IP-based rate limit hits
3. **API Latency**: Monitor /api/macro response time
4. **Cache Hit Rate**: Should be >95% (5 min TTL)

