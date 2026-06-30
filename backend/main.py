from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional, Literal
import asyncio, time, os, uuid
import yfinance as yf

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
CACHE_TTL         = 300   # 5 min
ATR_PERIOD        = 14
ATR_SL_MULTIPLIER = 1.5
RR_RATIO          = 2.0
FALLBACK_SL_PIPS  = 150

# ── INSTRUMENTS Yahoo Finance ─────────────────────────────────
# Symboles 100% disponibles sans clé API sur Yahoo Finance
INSTR = {
    "DXY":  {"symbol": "DX-Y.NYB", "ma": 20, "name": "Dollar Index"},
    "TLT":  {"symbol": "TLT",      "ma": 20, "name": "Taux réels US"},
    "VIX":  {"symbol": "^VIX",     "ma": 20, "name": "Indice de la peur"},
    "SPX":  {"symbol": "^GSPC",    "ma": 50, "name": "S&P 500"},
    "GOLD": {"symbol": "GC=F",     "ma": 20, "name": "Gold Spot"},
}

# ── CACHE IN-MEMORY ───────────────────────────────────────────
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
def _compute_atr(df, period: int = ATR_PERIOD) -> Optional[float]:
    """Calcule ATR14 depuis un DataFrame yfinance (colonnes High/Low/Close)."""
    if df is None or len(df) < period + 1:
        return None
    try:
        true_ranges = []
        for i in range(period):
            high       = float(df["High"].iloc[i])
            low        = float(df["Low"].iloc[i])
            prev_close = float(df["Close"].iloc[i + 1])
            tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
            true_ranges.append(tr)
        return round(sum(true_ranges) / len(true_ranges), 4)
    except Exception:
        return None

# ── FETCH INSTRUMENT ─────────────────────────────────────────
def _fetch_one_sync(key: str) -> dict:
    """Fetch synchrone via yfinance (appelé dans un thread séparé)."""
    info      = INSTR[key]
    sym       = info["symbol"]
    ma_period = info["ma"]
    cache_key = f"{sym}_{ma_period}"

    hit = _cached(cache_key)
    if hit:
        return hit

    try:
        # On récupère max(ma_period, ATR_PERIOD) + 5 bougies journalières
        nb = max(ma_period, ATR_PERIOD) + 5
        ticker = yf.Ticker(sym)
        df = ticker.history(period=f"{nb}d", interval="1d", auto_adjust=True)

        if df is None or len(df) < 2:
            return {"symbol": sym, "error": "Données insuffisantes"}

        # Trier du plus récent au plus ancien
        df = df.sort_index(ascending=False).reset_index()

        price = float(df["Close"].iloc[0])
        prev  = float(df["Close"].iloc[1])
        closes = [float(df["Close"].iloc[i]) for i in range(min(ma_period, len(df)))]
        ma_val = sum(closes) / len(closes) if closes else None

        result: dict = {
            "symbol":       sym,
            "name":         info["name"],
            "price":        round(price, 4),
            "ma":           round(ma_val, 4) if ma_val else None,
            "ma_period":    ma_period,
            "above_ma":     (price > ma_val) if ma_val else None,
            "change_pct":   round((price - prev) / prev * 100, 2) if prev else 0,
            "trend":        ("bull" if price > ma_val else "bear") if ma_val else "unknown",
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }

        # ATR uniquement pour Gold
        if key == "GOLD":
            atr = _compute_atr(df)
            result["atr14"] = atr

        _set_cache(cache_key, result)
        return result

    except Exception as e:
        return {"symbol": sym, "error": str(e)}

async def fetch_one(key: str) -> tuple[str, dict]:
    """Wrapper async : exécute yfinance dans un thread pour ne pas bloquer."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _fetch_one_sync, key)
    return key, result

# ── BIAS ──────────────────────────────────────────────────────
def compute_bias(instr: dict):
    L, S = [], []
    dxy = instr.get("DXY", {})
    tlt = instr.get("TLT", {})
    vix = instr.get("VIX", {})
    spx = instr.get("SPX", {})

    if dxy.get("trend") == "bear":   L.append("DXY")
    elif dxy.get("trend") == "bull": S.append("DXY")

    if tlt.get("trend") == "bull":   L.append("TLT")
    elif tlt.get("trend") == "bear": S.append("TLT")

    if vix.get("price", 0) > 20:     L.append("VIX")
    elif vix.get("price") and vix["price"] <= 20: S.append("VIX")

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
        "london":   london,
        "ny":       ny,
        "overlap":  overlap,
        "utc_hour": h,
    }

# ── SL / TP depuis ATR Gold ───────────────────────────────────
def _sl_tp_from_cache() -> tuple[int, int]:
    gold_cache = _cached("GC=F_20")
    if gold_cache and gold_cache.get("atr14"):
        atr = gold_cache["atr14"]
        sl  = round(atr * ATR_SL_MULTIPLIER)
        tp  = round(sl * RR_RATIO)
        return sl, tp
    return FALLBACK_SL_PIPS, FALLBACK_SL_PIPS * int(RR_RATIO)

# ── ENDPOINTS ─────────────────────────────────────────────────

@app.get("/api/macro")
async def get_macro():
    # Fetch tous les instruments en parallèle (yfinance dans des threads)
    tasks = [fetch_one(k) for k in INSTR]
    results = await asyncio.gather(*tasks)
    instruments = {k: v for k, v in results}

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

# ── SIGNAL TECHNIQUE ──────────────────────────────────────────

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

    # Bias depuis cache (ou appel complet si cache vide)
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
    session      = get_session()
    session_ok   = session["active"]
    session_name = session["name"]
    macro_ok     = bias in ("LONG", "SHORT")
    score        = max(long_score, short_score)

    async with _signal_lock:
        signal = _last_signal

    fresh = (
        signal is not None
        and (now - signal.received_at).total_seconds() <= SIGNAL_MAX_AGE_SECONDS
    )
    signal_valid = fresh and signal.volume_ok and signal.zone_ok

    if not session_ok:
        return _none(f"Hors session ({session_name})")
    if not macro_ok:
        return _none(f"Macro neutre (long={long_score}/4, short={short_score}/4)")
    if not signal_valid:
        return _none("Pas de signal technique valide ou signal expiré")
    if signal.direction != bias:
        return _none(f"Signal {signal.direction} contredit le bias macro {bias}")

    sl_pips, tp_pips = _sl_tp_from_cache()

    return {
        "action":    "BUY" if signal.direction == "LONG" else "SELL",
        "signal_id": signal.signal_id,
        "sl_pips":   sl_pips,
        "tp_pips":   tp_pips,
        "reason":    f"Macro {bias} ({score}/4) + signal {signal.type} aligné",
        "timestamp": now.isoformat(),
    }


def _none(reason: str) -> dict:
    return {"action": "NONE", "signal_id": None, "sl_pips": 0, "tp_pips": 0, "reason": reason}


@app.get("/api/health")
async def health():
    return {
        "status":       "ok",
        "time":         datetime.now(timezone.utc).isoformat(),
        "data_source":  "Yahoo Finance (yfinance)",
        "cache_keys":   len(_cache),
        "cors_origins": ALLOWED_ORIGINS,
    }
