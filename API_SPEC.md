# API Specification — Gold System v5

## Base URL

```
https://gold-system-api.onrender.com  (Production)
http://localhost:8000                  (Development)
```

---

## Endpoints

### 1. GET `/api/macro`

**Description**: Fetch real-time macro data (DXY, TLT, VIX, SPX, Gold) and compute Long/Short bias.

**Parameters**: None

**Response** (200 OK):

```json
{
  "timestamp": "2025-01-15T14:32:00+00:00",
  "bias": "LONG",
  "long_score": 3,
  "short_score": 1,
  "long_signals": ["DXY", "TLT", "VIX"],
  "short_signals": ["SPX"],
  "instruments": {
    "DXY": {
      "symbol": "DX/USD",
      "name": "Dollar Index",
      "price": 103.45,
      "ma": 102.10,
      "ma_period": 20,
      "above_ma": true,
      "change_pct": 0.85,
      "trend": "bull",
      "last_updated": "2025-01-15T14:32:00+00:00",
      "error": null
    },
    "TLT": { ... },
    "VIX": { ... },
    "SPX": { ... },
    "GOLD": { ... }
  },
  "session": {
    "active": true,
    "name": "OVERLAP",
    "london": true,
    "ny": true,
    "overlap": true,
    "utc_hour": 15
  }
}
```

**Error Responses**:

- **429 Too Many Requests**: Rate limit exceeded (10 req/min per IP)
  ```json
  { "detail": "Too many requests" }
  ```

- **500 Internal Server Error**: Backend error
  ```json
  { "detail": "Internal server error" }
  ```

**Caching**: Response cached for 5 minutes per instrument

**Rate Limit**: 10 requests per minute per IP address

---

### 2. GET `/api/health`

**Description**: Health check endpoint. Confirms API is running and API key is configured.

**Response** (200 OK):

```json
{
  "status": "ok",
  "time": "2025-01-15T14:32:00+00:00",
  "api_key_set": true
}
```

---

### 3. GET `/docs`

**Description**: Interactive OpenAPI/Swagger documentation

**Access**: https://gold-system-api.onrender.com/docs

---

## Data Models

### InstrumentData

```python
{
  "symbol": str,           # e.g., "DX/USD", "TLT", "VIX", "SPX500", "XAU/USD"
  "name": str,             # e.g., "Dollar Index"
  "price": float | null,   # Current price
  "ma": float | null,      # Moving average (20 or 50 period)
  "ma_period": int | null, # 20 or 50
  "above_ma": bool | null, # Price above MA?
  "change_pct": float,     # % change from previous close
  "trend": str,            # "bull", "bear", "unknown"
  "last_updated": str,     # ISO 8601 timestamp
  "error": str | null      # Error message if fetch failed
}
```

### SessionData

```python
{
  "active": bool,      # London OR NY session active?
  "name": str,         # "LONDON", "OVERLAP", "NEW YORK", "CLOSED"
  "london": bool,      # London session (7-16 UTC)
  "ny": bool,          # New York session (13-21 UTC)
  "overlap": bool,     # Overlap (13-16 UTC)
  "utc_hour": int      # Current hour in UTC (0-23)
}
```

### MacroResponse

```python
{
  "timestamp": str,              # ISO 8601 timestamp
  "bias": "LONG" | "SHORT" | "NEUTRAL",  # Computed bias
  "long_score": int,             # 0-4 filters aligned for Long
  "short_score": int,            # 0-4 filters aligned for Short
  "long_signals": list[str],     # e.g., ["DXY", "TLT", "VIX"]
  "short_signals": list[str],    # e.g., ["SPX"]
  "instruments": dict,           # InstrumentData objects
  "session": SessionData          # Trading session info
}
```

---

## Bias Calculation Logic

Bias requires **≥3 out of 4 filters** to be satisfied:

### LONG Bias
- DXY trend = **bear** (dollar weakening) ✓
- TLT trend = **bull** (rates falling) ✓
- VIX price > **20** (fear/risk-off) ✓
- SPX trend = **bear** (stocks weakening) ✓

### SHORT Bias
- DXY trend = **bull** (dollar strengthening) ✓
- TLT trend = **bear** (rates rising) ✓
- VIX price ≤ **20** (complacency/risk-on) ✓
- SPX trend = **bull** (stocks strengthening) ✓

### NEUTRAL
- < 3 filters aligned → **observation day only**

---

## Rate Limiting

**Limit**: 10 requests per minute per IP address

**Headers**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: <unix-timestamp>
```

**Error Response** (429):
```json
{ "detail": "Too many requests" }
```

---

## Timeouts

- **HTTP request timeout**: 12 seconds per instrument
- **Total request time**: ~3-4 seconds (5 instruments, 150ms delay between)
- **Frontend timeout**: 15 seconds (AbortSignal.timeout)

---

## Retry Logic

If an instrument fetch fails:

1. **Retry #1**: Wait 1 second, retry
2. **Retry #2**: Wait 2 seconds, retry
3. **Final**: Return error response with `error` field

**Applies to**:
- HTTP 5xx errors (server errors)
- Timeout exceptions
- Generic exceptions

---

## Logging

All requests/errors are logged to `stdout`:

```
INFO - GET /api/macro from 1.2.3.4
INFO - Fetching DXY (attempt 1)
INFO - Cache HIT: DX/USD_20
INFO - Successfully fetched TLT
INFO - Bias computed: LONG (Long: 3/4, Short: 1/4)
INFO - Response sent: LONG bias (L:3 S:1)
```

---

## CORS Policy

**Allowed Origins**:
- `https://<FRONTEND_URL>` (Vercel domain)
- `http://localhost:3000` (development)
- `http://localhost:5000` (development)

**Allowed Methods**: `GET`, `OPTIONS`

**Allowed Headers**: `*`

---

## Environment Variables

```bash
TWELVE_DATA_KEY=<your-api-key>     # Twelve Data API key (required)
FRONTEND_URL=https://gold-system.vercel.app  # Vercel domain
PORT=8000                           # Server port (default)
```

---

## Example Request

```bash
curl -X GET "https://gold-system-api.onrender.com/api/macro" \
  -H "Accept: application/json"
```

---

## OpenAPI Spec

Full OpenAPI 3.0 spec available at:

```
https://gold-system-api.onrender.com/openapi.json
```

Interactive docs:

```
https://gold-system-api.onrender.com/docs
```
