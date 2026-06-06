from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
import httpx, asyncio, time, os

app = FastAPI(title="Gold System API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

API_KEY = os.getenv("TWELVE_DATA_KEY", "demo")
BASE = "https://api.twelvedata.com"
_cache = {}
CACHE_TTL = 300

def cached(k):
    if k in _cache:
        d, ts = _cache[k]
        if time.time() - ts < CACHE_TTL:
            return d
    return None

def set_cache(k, d):
    _cache[k] = (d, time.time())

INSTR = {
    "DXY":  {"symbol": "DX/USD",  "ma": 20, "name": "Dollar Index"},
    "TLT":  {"symbol": "TLT",     "ma": 20, "name": "Taux réels US"},
    "VIX":  {"symbol": "VIX",     "ma": 20, "name": "Indice de la peur"},
    "SPX":  {"symbol": "SPX500",  "ma": 50, "name": "S&P 500"},
    "GOLD": {"symbol": "XAU/USD", "ma": 20, "name": "Gold Spot"},
}

async def fetch_one(client, key):
    info = INSTR[key]
    sym = info["symbol"]
    ma_period = info["ma"]
    cache_key = f"{sym}_{ma_period}"
    hit = cached(cache_key)
    if hit:
        return key, hit
    try:
        # 1 seul appel / instrument (time_series) → respecte la limite gratuite 8 req/min
        r = await client.get(
            f"{BASE}/time_series?symbol={sym}&interval=1day&outputsize={ma_period + 1}&apikey={API_KEY}",
            timeout=10,
        )
        data = r.json()
        if data.get("status") == "error" or "code" in data:
            return key, {"error": data.get("message", "API error"), "symbol": sym}
        values = data.get("values") or []
        if len(values) < 2:
            return key, {"symbol": sym, "error": "Données insuffisantes"}
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
        return key, result
    except Exception as e:
        return key, {"symbol": sym, "error": str(e)}

def compute_bias(instr):
    L, S = [], []
    dxy = instr.get("DXY", {})
    tlt = instr.get("TLT", {})
    vix = instr.get("VIX", {})
    spx = instr.get("SPX", {})
    if dxy.get("trend") == "bear": L.append("DXY")
    elif dxy.get("trend") == "bull": S.append("DXY")
    if tlt.get("trend") == "bull": L.append("TLT")
    elif tlt.get("trend") == "bear": S.append("TLT")
    if vix.get("price", 0) > 20: L.append("VIX")
    elif vix.get("price") and vix["price"] <= 20: S.append("VIX")
    if spx.get("trend") == "bear": L.append("SPX")
    elif spx.get("trend") == "bull": S.append("SPX")
    b = "LONG" if len(L) >= 3 else "SHORT" if len(S) >= 3 else "NEUTRAL"
    return b, len(L), len(S), L, S

def get_session():
    h = datetime.now(timezone.utc).hour
    l = 7 <= h < 16
    n = 13 <= h < 21
    o = 13 <= h < 16
    return {
        "active": l or n,
        "name": "OVERLAP" if o else "LONDON" if l else "NEW YORK" if n else "CLOSED",
        "london": l, "ny": n, "overlap": o, "utc_hour": h
    }

@app.get("/api/macro")
async def get_macro():
    instruments = {}
    async with httpx.AsyncClient() as c:
        for k in INSTR:
            key, val = await fetch_one(c, k)
            instruments[key] = val
            await asyncio.sleep(0.15)
    b, ls, ss, lsig, ssig = compute_bias(instruments)
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "bias": b,
        "long_score": ls,
        "short_score": ss,
        "long_signals": lsig,
        "short_signals": ssig,
        "instruments": instruments,
        "session": get_session(),
    }

@app.get("/api/health")
async def health():
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat(), "api_key_set": API_KEY != "demo"}
