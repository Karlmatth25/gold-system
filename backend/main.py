from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional, List, Dict
import httpx
import asyncio
import time
import os
import logging
from collections import defaultdict

# ──────────────────────────────────────────────────────
# LOGGING SETUP
# ──────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────
# PYDANTIC MODELS
# ──────────────────────────────────────────────────────
class InstrumentData(BaseModel):
    """Single instrument data point (DXY, TLT, VIX, SPX, GOLD)"""
    symbol: str
    name: str
    price: Optional[float] = None
    ma: Optional[float] = None
    ma_period: Optional[int] = None
    above_ma: Optional[bool] = None
    change_pct: float = 0.0
    trend: str  # "bull", "bear", "unknown"
    last_updated: str
    error: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "symbol": "DX/USD",
                "name": "Dollar Index",
                "price": 103.45,
                "ma": 102.10,
                "ma_period": 20,
                "above_ma": True,
                "change_pct": 0.85,
                "trend": "bull",
                "last_updated": "2025-01-15T14:32:00+00:00"
            }
        }

class SessionData(BaseModel):
    """Trading session info (London/Overlap/New York)"""
    active: bool
    name: str  # "LONDON", "OVERLAP", "NEW YORK", "CLOSED"
    london: bool
    ny: bool
    overlap: bool
    utc_hour: int

class MacroResponse(BaseModel):
    """Complete macro data response"""
    timestamp: str
    bias: str  # "LONG", "SHORT", "NEUTRAL"
    long_score: int = Field(ge=0, le=4)
    short_score: int = Field(ge=0, le=4)
    long_signals: List[str]
    short_signals: List[str]
    instruments: Dict[str, InstrumentData]
    session: SessionData

    class Config:
        json_schema_extra = {
            "example": {
                "timestamp": "2025-01-15T14:32:00+00:00",
                "bias": "LONG",
                "long_score": 3,
                "short_score": 1,
                "long_signals": ["DXY", "TLT", "VIX"],
                "short_signals": ["SPX"],
                "instruments": {},
                "session": {
                    "active": True,
                    "name": "OVERLAP",
                    "london": True,
                    "ny": True,
                    "overlap": True,
                    "utc_hour": 15
                }
            }
        }

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    time: str
    api_key_set: bool

# ──────────────────────────────────────────────────────
# FASTAPI APP SETUP
# ──────────────────────────────────────────────────────
app = FastAPI(
    title="Gold System API v5",
    description="Automated XAU/USD macro trading dashboard",
    version="5.0.0"
)

# CORS: Allow Vercel frontend + localhost for dev
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────
API_KEY = os.getenv("TWELVE_DATA_KEY", "demo")
BASE = "https://api.twelvedata.com"
_cache = {}
CACHE_TTL = 300  # 5 minutes
REQUEST_TIMEOUT = 12  # seconds
MAX_RETRIES = 2
RETRY_BACKOFF = 2  # exponential backoff multiplier

# Rate limiting: 10 req/min per IP (leave margin for Twelve Data 8 req/min)
_rate_limit_tracker = defaultdict(list)
RATE_LIMIT_REQUESTS = 10
RATE_LIMIT_WINDOW = 60  # seconds

INSTR = {
    "DXY": {"symbol": "DX/USD", "ma": 20, "name": "Dollar Index"},
    "TLT": {"symbol": "TLT", "ma": 20, "name": "Taux réels US"},
    "VIX": {"symbol": "VIX", "ma": 20, "name": "Indice de la peur"},
    "SPX": {"symbol": "SPX500", "ma": 50, "name": "S&P 500"},
    "GOLD": {"symbol": "XAU/USD", "ma": 20, "name": "Gold Spot"},
}

# ──────────────────────────────────────────────────────
# CACHE HELPERS
# ──────────────────────────────────────────────────────
def cached(k: str):
    """Get cached value if not expired"""
    if k in _cache:
        data, ts = _cache[k]
        if time.time() - ts < CACHE_TTL:
            logger.debug(f"Cache HIT: {k}")
            return data
    return None

def set_cache(k: str, data: dict):
    """Store value in cache with timestamp"""
    _cache[k] = (data, time.time())
    logger.debug(f"Cache SET: {k}")

# ──────────────────────────────────────────────────────
# RATE LIMITING
# ──────────────────────────────────────────────────────
def check_rate_limit(client_ip: str) -> bool:
    """Check if client exceeds rate limit"""
    now = time.time()
    # Remove old requests outside window
    _rate_limit_tracker[client_ip] = [
        ts for ts in _rate_limit_tracker[client_ip]
        if now - ts < RATE_LIMIT_WINDOW
    ]
    # Check limit
    if len(_rate_limit_tracker[client_ip]) >= RATE_LIMIT_REQUESTS:
        return False
    # Add new request
    _rate_limit_tracker[client_ip].append(now)
    return True

# ──────────────────────────────────────────────────────
# API FETCHING WITH RETRY
# ──────────────────────────────────────────────────────
async def fetch_one(client: httpx.AsyncClient, key: str) -> tuple:
    """Fetch instrument data with retry logic"""
    info = INSTR[key]
    sym = info["symbol"]
    ma_period = info["ma"]
    cache_key = f"{sym}_{ma_period}"
    
    # Try cache first
    hit = cached(cache_key)
    if hit:
        return key, hit
    
    # Retry loop
    for attempt in range(MAX_RETRIES + 1):
        try:
            url = f"{BASE}/time_series?symbol={sym}&interval=1day&outputsize={ma_period + 1}&apikey={API_KEY}"
            logger.info(f"Fetching {key} (attempt {attempt + 1})")
            
            r = await client.get(url, timeout=REQUEST_TIMEOUT)
            r.raise_for_status()  # Raise on HTTP errors
            
            data = r.json()
            
            # Check for API errors
            if data.get("status") == "error" or "code" in data:
                error_msg = data.get("message", "API error")
                logger.warning(f"API error for {key}: {error_msg}")
                return key, {
                    "symbol": sym,
                    "name": info["name"],
                    "error": error_msg,
                    "last_updated": datetime.now(timezone.utc).isoformat()
                }
            
            # Parse response
            values = data.get("values") or []
            if len(values) < 2:
                logger.warning(f"Insufficient data for {key}: {len(values)} values")
                return key, {
                    "symbol": sym,
                    "name": info["name"],
                    "error": "Données insuffisantes",
                    "last_updated": datetime.now(timezone.utc).isoformat()
                }
            
            # Calculate metrics
            price = float(values[0]["close"])
            prev = float(values[1]["close"])
            closes = [float(v["close"]) for v in values[:ma_period]]
            ma_val = sum(closes) / len(closes) if closes else None
            
            result = {
                "symbol": sym,
                "name": info["name"],
                "price": round(price, 4),
                "ma": round(ma_val, 4) if ma_val else None,
                "ma_period": ma_period,
                "above_ma": (price > ma_val) if ma_val else None,
                "change_pct": round((price - prev) / prev * 100, 2) if prev else 0,
                "trend": ("bull" if price > ma_val else "bear") if ma_val else "unknown",
                "last_updated": datetime.now(timezone.utc).isoformat(),
            }
            
            set_cache(cache_key, result)
            logger.info(f"Successfully fetched {key}")
            return key, result
            
        except httpx.TimeoutException:
            logger.warning(f"Timeout for {key} (attempt {attempt + 1})")
            if attempt < MAX_RETRIES:
                wait_time = RETRY_BACKOFF ** attempt
                logger.info(f"Retrying {key} in {wait_time}s...")
                await asyncio.sleep(wait_time)
            continue
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP {e.response.status_code} for {key}")
            if attempt < MAX_RETRIES and e.response.status_code >= 500:
                wait_time = RETRY_BACKOFF ** attempt
                await asyncio.sleep(wait_time)
                continue
            break
        except Exception as e:
            logger.error(f"Error fetching {key}: {str(e)}")
            if attempt < MAX_RETRIES:
                wait_time = RETRY_BACKOFF ** attempt
                await asyncio.sleep(wait_time)
                continue
            break
    
    # Final fallback
    logger.error(f"Failed to fetch {key} after {MAX_RETRIES + 1} attempts")
    return key, {
        "symbol": sym,
        "name": info["name"],
        "error": "Impossible de récupérer les données",
        "last_updated": datetime.now(timezone.utc).isoformat()
    }

# ──────────────────────────────────────────────────────
# BIAS CALCULATION
# ──────────────────────────────────────────────────────
def compute_bias(instr: dict) -> tuple:
    """Calculate Long/Short bias based on 4 filters"""
    L, S = [], []
    
    dxy = instr.get("DXY", {})
    tlt = instr.get("TLT", {})
    vix = instr.get("VIX", {})
    spx = instr.get("SPX", {})
    
    # DXY: Bear = Long, Bull = Short
    if dxy.get("trend") == "bear":
        L.append("DXY")
    elif dxy.get("trend") == "bull":
        S.append("DXY")
    
    # TLT: Bull = Long, Bear = Short
    if tlt.get("trend") == "bull":
        L.append("TLT")
    elif tlt.get("trend") == "bear":
        S.append("TLT")
    
    # VIX: >20 = Long (fear), ≤20 = Short (complacency)
    vix_price = vix.get("price")
    if vix_price and vix_price > 20:
        L.append("VIX")
    elif vix_price and vix_price <= 20:
        S.append("VIX")
    
    # SPX: Bear = Long (risk-off), Bull = Short (risk-on)
    if spx.get("trend") == "bear":
        L.append("SPX")
    elif spx.get("trend") == "bull":
        S.append("SPX")
    
    # Determine bias: need ≥3/4 filters
    bias = "LONG" if len(L) >= 3 else "SHORT" if len(S) >= 3 else "NEUTRAL"
    
    logger.info(f"Bias computed: {bias} (Long: {len(L)}/4, Short: {len(S)}/4)")
    return bias, len(L), len(S), L, S

# ──────────────────────────────────────────────────────
# SESSION CALCULATION
# ──────────────────────────────────────────────────────
def get_session() -> dict:
    """Determine current trading session (UTC-based)"""
    h = datetime.now(timezone.utc).hour
    london = 7 <= h < 16
    ny = 13 <= h < 21
    overlap = 13 <= h < 16
    
    return {
        "active": london or ny,
        "name": "OVERLAP" if overlap else "LONDON" if london else "NEW YORK" if ny else "CLOSED",
        "london": london,
        "ny": ny,
        "overlap": overlap,
        "utc_hour": h
    }

# ──────────────────────────────────────────────────────
# ENDPOINTS
# ──────────────────────────────────────────────────────

@app.get(
    "/api/macro",
    response_model=MacroResponse,
    summary="Get macro data and trading bias",
    description="Fetch real-time macro data (DXY, TLT, VIX, SPX, Gold) and compute Long/Short bias. Data cached 5 minutes."
)
async def get_macro(request=None):
    """Main endpoint: Fetch macro data and compute bias"""
    # Rate limiting (if request object available)
    client_ip = "unknown"
    if hasattr(request, "client"):
        client_ip = request.client.host
        if not check_rate_limit(client_ip):
            logger.warning(f"Rate limit exceeded for {client_ip}")
            raise HTTPException(status_code=429, detail="Too many requests")
    
    try:
        logger.info(f"GET /api/macro from {client_ip}")
        
        # Fetch all instruments in parallel
        instruments = {}
        async with httpx.AsyncClient() as client:
            for k in INSTR:
                key, val = await fetch_one(client, k)
                instruments[key] = val
                # Respectful delay between requests (Twelve Data allows 8 req/min)
                await asyncio.sleep(0.15)
        
        # Compute bias
        bias, ls, ss, lsig, ssig = compute_bias(instruments)
        
        # Get session
        session = get_session()
        
        # Build response
        response = MacroResponse(
            timestamp=datetime.now(timezone.utc).isoformat(),
            bias=bias,
            long_score=ls,
            short_score=ss,
            long_signals=lsig,
            short_signals=ssig,
            instruments=instruments,
            session=session
        )
        
        logger.info(f"Response sent: {bias} bias (L:{ls} S:{ss})")
        return response
    
    except Exception as e:
        logger.error(f"Error in /api/macro: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get(
    "/api/health",
    response_model=HealthResponse,
    summary="Health check",
    description="Check if API is running and if Twelve Data API key is configured."
)
async def health():
    """Health check endpoint"""
    logger.info("GET /api/health")
    return HealthResponse(
        status="ok",
        time=datetime.now(timezone.utc).isoformat(),
        api_key_set=API_KEY != "demo"
    )

# Swagger/OpenAPI documentation at /docs
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
