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
    hit = cached(f"{sym}_{info['ma']}")
    if hit:
        return key, hit
    try:
        price_r, quote_r, ma_r = await asyncio.gather(
            client.get(f"{BASE}/price?symbol={sym}&apikey={API_KEY}", timeout=8),
            client.get(f"{BASE}/quote?symbol={sym}&apikey={API_KEY}", timeout=8),
            client.get(f"{BASE}/ma?symbol={sym}&interval=1day&time_period={info['ma']}&series_type=close&outputsize=1&apikey={API_KEY}", timeout=8),
        )
        p = price_r.json()
        q = quote_r.json()
        m = ma_r.json()
        if "code" in p:
            return key, {"error": p.get("message", "API error"), "symbol": sym}
        price = float(p.get("price", 0))
        prev = float(q.get("previous_close", price))
        ma_val = float(m["values"][0]["ma"]) if "values" in m and m["values"] else None
        result = {
            "symbol": sym,
            "name": info["name"],
            "price": round(price, 4),
            "ma": round(ma_val, 4) if ma_val else None,
            "ma_period": info["ma"],
            "above_ma": (price > ma_val) if ma_val else None,
            "change_pct": round((price - prev) / prev * 100, 2) if prev else 0,
            "trend": ("bull" if price > ma_val else "bear") if ma_val else "unknown",
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }
        set_cache(f"{sym}_{info['ma']}", result)
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
    async with httpx.AsyncClient() as c:
        res = await asyncio.gather(*[fetch_one(c, k) for k in INSTR])
    instruments = {k: v for k, v in res}
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
