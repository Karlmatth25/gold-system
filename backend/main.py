from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional, Literal
import httpx, asyncio, time, os, uuid

app = FastAPI(title="Gold System API")

# ── CORS ──────────────────────────────────────────────────────
_ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "")
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if _ALLOWED_ORIGIN:
    ALLOWED_ORIGINS.append(_ALLOWED_ORIGIN.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# ── CONFIG ────────────────────────────────────────────────────
AV_KEY            = os.getenv("ALPHA_VANTAGE_KEY", "demo")
BASE              = "https://www.alphavantage.co/query"
CACHE_TTL         = 300
ATR_PERIOD        = 14
ATR_SL_MULTIPLIER = 1.5
RR_RATIO          = 2.0
FALLBACK_SL_PIPS  = 150

# ── INSTRUMENTS Alpha Vantage ─────────────────────────────────
# Symboles vérifiés disponibles sur le plan gratuit Alpha Vantage
INSTR = {
    "DXY":  {"symbol": "EUR/USD", "from": "EUR", "to": "USD",  "ma": 20, "name": "Dollar Index (EUR/USD inv.)", "type": "fx"},
    "TLT":  {"symbol": "TLT",                                  "ma": 20, "name": "Taux réels US",               "type": "stock"},
    "VIX":  {"symbol": "SPY",                                  "ma": 20, "name": "Volatilité (SPY proxy)",       "type": "stock"},
    "SPX":  {"symbol": "SPY",                                  "ma": 50, "name": "S&P 500 (SPY ETF)",           "type": "stock"},
    "GOLD": {"symbol": "GLD",                                  "ma": 20, "name": "Gold (GLD ETF ×10≈XAU)",      "type": "stock"},
}

# ── CACHE ─────────────────────────────────────────────────────
_cache: dict = {}
_signal_lock = asyncio.Lock()

def _cached(k: str):
    if k in _cache:
        d, ts = _cache[k]
        if time.time() - ts < CACHE_TTL:
            return d
    return None

def _set_cache(k: str, d):
    _cache[k] = (d, time.time())

# ── ATR ───────────────────────────────────────────────────────
def _compute_atr(bars: list, period: int = ATR_PERIOD) -> Optional[float]:
    """bars = liste de dicts {high, low, close} du plus récent au plus ancien."""
    if len(bars) < period + 1:
        return None
    try:
        trs = []
        for i in range(period):
            h  = float(bars[i]["high"])
            l  = float(bars[i]["low"])
            pc = float(bars[i + 1]["close"])
            trs.append(max(h - l, abs(h - pc), abs(l - pc)))
        return round(sum(trs) / len(trs), 4)
    except Exception:
        return None

# ── FETCH ─────────────────────────────────────────────────────
async def fetch_one(client: httpx.AsyncClient, key: str):
    info      = INSTR[key]
    sym       = info["symbol"]
    ma_period = info["ma"]
    cache_key = f"{sym}_{ma_period}"

    hit = _cached(cache_key)
    if hit:
        return key, hit

    try:
        # Alpha Vantage : TIME_SERIES_DAILY pour stocks/ETF, FX_DAILY pour forex
        if info["type"] == "fx":
            params = {
                "function":    "FX_DAILY",
                "from_symbol": info["from"],
                "to_symbol":   info["to"],
                "outputsize":  "compact",
                "apikey":      AV_KEY,
            }
            ts_key = "Time Series FX (Daily)"
        else:
            params = {
                "function":   "TIME_SERIES_DAILY",
                "symbol":     sym,
                "outputsize": "compact",
                "apikey":     AV_KEY,
            }
            ts_key = "Time Series (Daily)"

        r    = await client.get(BASE, params=params, timeout=15)
        data = r.json()

        if "Error Message" in data or "Note" in data or "Information" in data:
            msg = data.get("Error Message") or data.get("Note") or data.get("Information", "API error")
            return key, {"error": msg[:80], "symbol": sym}

        ts = data.get(ts_key, {})
        if not ts:
            return key, {"symbol": sym, "error": "Pas de données"}

        # Trier les dates du plus récent au plus ancien
        dates = sorted(ts.keys(), reverse=True)
        nb    = max(ma_period, ATR_PERIOD) + 2
        dates = dates[:nb]

        if len(dates) < 2:
            return key, {"symbol": sym, "error": "Données insuffisantes"}

        def bar(d):
            row = ts[d]
            # Alpha Vantage : clés toujours sous forme "1. open", "2. high", etc.
            return {
                "open":  float(row.get("1. open",  0)),
                "high":  float(row.get("2. high",  0)),
                "low":   float(row.get("3. low",   0)),
                "close": float(row.get("4. close", 0)),
            }

        bars   = [bar(d) for d in dates]
        price  = bars[0]["close"]
        prev   = bars[1]["close"]
        closes = [b["close"] for b in bars[:ma_period]]
        ma_val = sum(closes) / len(closes) if closes else None

        # VIX : SPY sous MA20 = risk-off = VIX haut = Long Gold
        if key == "VIX":
            trend = "bull" if price < ma_val else "bear"  # SPY sous MA = peur = VIX bull
        # DXY : EUR/USD inversé (EUR bull = DXY bear)
        elif key == "DXY":
            raw = ("bull" if price > ma_val else "bear") if ma_val else "unknown"
            trend = "bear" if raw == "bull" else "bull" if raw == "bear" else "unknown"
        else:
            trend = ("bull" if price > ma_val else "bear") if ma_val else "unknown"

        result: dict = {
            "symbol":       sym,
            "name":         info["name"],
            "price":        round(price, 4),
            "ma":           round(ma_val, 4) if ma_val else None,
            "ma_period":    ma_period,
            "above_ma":     (price > ma_val) if ma_val else None,
            "change_pct":   round((price - prev) / prev * 100, 2) if prev else 0,
            "trend":        trend,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }

        if key == "GOLD":
            result["atr14"] = _compute_atr(bars)

        _set_cache(cache_key, result)
        return key, result

    except Exception as e:
        return key, {"symbol": sym, "error": str(e)}

# ── BIAS ──────────────────────────────────────────────────────
def compute_bias(instr: dict):
    L, S = [], []
    dxy = instr.get("DXY", {})
    tlt = instr.get("TLT", {})
    vix = instr.get("VIX", {})
    spx = instr.get("SPX", {})

    # DXY bear = dollar faible = Gold Long
    if dxy.get("trend") == "bear":   L.append("DXY")
    elif dxy.get("trend") == "bull": S.append("DXY")

    if tlt.get("trend") == "bull":   L.append("TLT")
    elif tlt.get("trend") == "bear": S.append("TLT")

    # VIX proxy : SPY sous MA = risk-off = Long Gold
    if vix.get("trend") == "bull":   L.append("VIX")  # SPY sous MA = peur
    elif vix.get("trend") == "bear": S.append("VIX")  # SPY dessus MA = confiance

    if spx.get("trend") == "bear":   L.append("SPX")
    elif spx.get("trend") == "bull": S.append("SPX")

    b = "LONG" if len(L) >= 3 else "SHORT" if len(S) >= 3 else "NEUTRAL"
    return b, len(L), len(S), L, S

# ── SESSION ───────────────────────────────────────────────────
def get_session() -> dict:
    h       = datetime.now(timezone.utc).hour
    london  = 7 <= h < 16
    ny      = 13 <= h < 21
    overlap = 13 <= h < 16
    return {
        "active":   london or ny,
        "name":     "OVERLAP" if overlap else "LONDON" if london else "NEW YORK" if ny else "CLOSED",
        "london":   london, "ny": ny, "overlap": overlap, "utc_hour": h,
    }

# ── SL/TP ─────────────────────────────────────────────────────
def _sl_tp_from_cache() -> tuple[int, int]:
    gold_cache = _cached("GLD_20")
    if gold_cache and gold_cache.get("atr14"):
        # GLD ≈ XAU/10 → on multiplie par 10 pour avoir des pips Gold cohérents
        sl = round(gold_cache["atr14"] * ATR_SL_MULTIPLIER * 10)
        tp = round(sl * RR_RATIO)
        return sl, tp
    return FALLBACK_SL_PIPS, FALLBACK_SL_PIPS * int(RR_RATIO)

# ── ENDPOINTS ─────────────────────────────────────────────────

@app.get("/api/macro")
async def get_macro():
    instruments: dict = {}
    async with httpx.AsyncClient() as c:
        for k in INSTR:
            key, val = await fetch_one(c, k)
            instruments[key] = val
            await asyncio.sleep(0.15)

    b, ls, ss, lsig, ssig = compute_bias(instruments)
    return {
        "timestamp":     datetime.now(timezone.utc).isoformat(),
        "bias":          b,
        "long_score":    ls,
        "short_score":   ss,
        "long_signals":  lsig,
        "short_signals": ssig,
        "instruments":   instruments,
        "session":       get_session(),
    }

# ── SIGNAL ────────────────────────────────────────────────────
SIGNAL_MAX_AGE_SECONDS = 180
SIGNAL_SECRET = os.getenv("SIGNAL_SECRET")

class TVSignal(BaseModel):
    direction: Literal["LONG", "SHORT"]
    type: str
    volume_ok: bool = False
    zone_ok:   bool = False

class StoredSignal(TVSignal):
    signal_id:   str
    received_at: datetime

_last_signal: Optional[StoredSignal] = None

@app.post("/api/signal")
async def post_signal(signal: TVSignal, secret: Optional[str] = None):
    if SIGNAL_SECRET and secret != SIGNAL_SECRET:
        raise HTTPException(status_code=401, detail="secret invalide")
    global _last_signal
    async with _signal_lock:
        _last_signal = StoredSignal(
            **signal.model_dump(),
            signal_id=str(uuid.uuid4()),
            received_at=datetime.now(timezone.utc),
        )
        sid = _last_signal.signal_id
    return {"status": "received", "signal_id": sid}

@app.get("/api/decision")
async def get_decision():
    now = datetime.now(timezone.utc)
    instruments_cached: dict = {}
    all_cached = True
    for k, info in INSTR.items():
        hit = _cached(f"{info['symbol']}_{info['ma']}")
        if hit:
            instruments_cached[k] = hit
        else:
            all_cached = False
            break
    if not all_cached:
        await get_macro()
        for k, info in INSTR.items():
            instruments_cached[k] = _cached(f"{info['symbol']}_{info['ma']}") or {}

    bias, long_score, short_score, _, _ = compute_bias(instruments_cached)
    session    = get_session()
    session_ok = session["active"]
    macro_ok   = bias in ("LONG", "SHORT")
    score      = max(long_score, short_score)

    async with _signal_lock:
        signal = _last_signal

    fresh        = signal is not None and (now - signal.received_at).total_seconds() <= SIGNAL_MAX_AGE_SECONDS
    signal_valid = fresh and signal.volume_ok and signal.zone_ok

    if not session_ok:   return _none(f"Hors session ({session['name']})")
    if not macro_ok:     return _none(f"Macro neutre (long={long_score}/4, short={short_score}/4)")
    if not signal_valid: return _none("Pas de signal technique valide ou signal expiré")
    if signal.direction != bias: return _none(f"Signal {signal.direction} contredit le bias {bias}")

    sl, tp = _sl_tp_from_cache()
    return {
        "action": "BUY" if signal.direction == "LONG" else "SELL",
        "signal_id": signal.signal_id,
        "sl_pips": sl, "tp_pips": tp,
        "reason": f"Macro {bias} ({score}/4) + signal {signal.type} aligné",
        "timestamp": now.isoformat(),
    }

def _none(reason: str) -> dict:
    return {"action": "NONE", "signal_id": None, "sl_pips": 0, "tp_pips": 0, "reason": reason}

@app.get("/api/health")
async def health():
    return {
        "status":      "ok",
        "time":        datetime.now(timezone.utc).isoformat(),
        "data_source": "Alpha Vantage (vrais symboles DXY/VIX/SPY/TLT/XAU)",
        "av_key_set":  AV_KEY != "demo",
        "cache_keys":  len(_cache),
        "cors_origins": ALLOWED_ORIGINS,
    }
