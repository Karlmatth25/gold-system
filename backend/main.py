from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional, Literal
import httpx, asyncio, time, os, uuid

app = FastAPI(title="Gold System API")

# ── CORS ──────────────────────────────────────────────────────
# Restreint aux origines connues. Ajouter l'URL Vercel de prod dans
# la variable d'environnement ALLOWED_ORIGIN (ex: https://gold-system.vercel.app).
# En local, http://localhost:3000 est toujours autorisé.
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
API_KEY  = os.getenv("TWELVE_DATA_KEY", "demo")
BASE     = "https://api.twelvedata.com"
CACHE_TTL = 300  # 5 min

# ATR : on récupère 15 bougies journalières pour Gold afin de calculer l'ATR14.
# SL  = ATR14 × 1.5  (en points XAU/USD, 1 point ≈ 1 pip Gold)
# TP  = SL × 2       (RR 2:1)
ATR_PERIOD       = 14
ATR_SL_MULTIPLIER = 1.5
RR_RATIO          = 2.0
FALLBACK_SL_PIPS  = 150   # utilisé uniquement si le calcul ATR échoue

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

# ── INSTRUMENTS ───────────────────────────────────────────────
INSTR = {
    "DXY":  {"symbol": "DX/USD",  "ma": 20, "name": "Dollar Index"},
    "TLT":  {"symbol": "TLT",     "ma": 20, "name": "Taux réels US"},
    "VIX":  {"symbol": "VIX",     "ma": 20, "name": "Indice de la peur"},
    "SPX":  {"symbol": "SPX500",  "ma": 50, "name": "S&P 500"},
    "GOLD": {"symbol": "XAU/USD", "ma": 20, "name": "Gold Spot"},
}

# ── ATR CALCULATION ───────────────────────────────────────────
def _compute_atr(values: list, period: int = ATR_PERIOD) -> Optional[float]:
    """
    Calcule l'ATR sur `period` bougies à partir des valeurs Twelve Data.
    values[0] = bougie la plus récente (format: {high, low, close}).
    Retourne None si les données sont insuffisantes.
    """
    if len(values) < period + 1:
        return None
    true_ranges = []
    for i in range(period):
        try:
            high  = float(values[i]["high"])
            low   = float(values[i]["low"])
            prev_close = float(values[i + 1]["close"])
            tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
            true_ranges.append(tr)
        except (KeyError, ValueError):
            return None
    return round(sum(true_ranges) / len(true_ranges), 4)

# ── FETCH INSTRUMENT ─────────────────────────────────────────
async def fetch_one(client: httpx.AsyncClient, key: str):
    info      = INSTR[key]
    sym       = info["symbol"]
    ma_period = info["ma"]
    # Pour Gold, on récupère ATR_PERIOD+1 bougies supplémentaires pour le calcul ATR.
    outputsize = ma_period + 1 if key != "GOLD" else max(ma_period, ATR_PERIOD) + 2

    cache_key = f"{sym}_{ma_period}"
    hit = _cached(cache_key)
    if hit:
        return key, hit

    try:
        r = await client.get(
            f"{BASE}/time_series"
            f"?symbol={sym}&interval=1day&outputsize={outputsize}&apikey={API_KEY}",
            timeout=10,
        )
        data = r.json()

        if data.get("status") == "error" or "code" in data:
            return key, {"error": data.get("message", "API error"), "symbol": sym}

        values = data.get("values") or []
        if len(values) < 2:
            return key, {"symbol": sym, "error": "Données insuffisantes"}

        price = float(values[0]["close"])
        prev  = float(values[1]["close"])
        closes = [float(v["close"]) for v in values[:ma_period]]
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

        # ATR uniquement pour Gold (utilisé pour SL/TP dynamiques)
        if key == "GOLD":
            atr = _compute_atr(values)
            result["atr14"] = atr

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

    if dxy.get("trend") == "bear":  L.append("DXY")
    elif dxy.get("trend") == "bull": S.append("DXY")

    if tlt.get("trend") == "bull":  L.append("TLT")
    elif tlt.get("trend") == "bear": S.append("TLT")

    if vix.get("price", 0) > 20:    L.append("VIX")
    elif vix.get("price") and vix["price"] <= 20: S.append("VIX")

    if spx.get("trend") == "bear":  L.append("SPX")
    elif spx.get("trend") == "bull": S.append("SPX")

    b = "LONG" if len(L) >= 3 else "SHORT" if len(S) >= 3 else "NEUTRAL"
    return b, len(L), len(S), L, S

# ── SESSION ───────────────────────────────────────────────────
def get_session() -> dict:
    h = datetime.now(timezone.utc).hour
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

# ── HELPER : SL / TP depuis ATR Gold ─────────────────────────
def _sl_tp_from_cache() -> tuple[int, int]:
    """
    Lit l'ATR14 du Gold depuis le cache et calcule SL/TP.
    Retourne (sl_pips, tp_pips) — en points XAU/USD arrondis à l'entier.
    Fallback sur les valeurs par défaut si le cache est absent ou l'ATR null.
    """
    gold_cache = _cached("XAU/USD_20")
    if gold_cache and gold_cache.get("atr14"):
        atr = gold_cache["atr14"]
        sl = round(atr * ATR_SL_MULTIPLIER)
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
            # Délai minimal pour respecter la limite Twelve Data (8 req/min gratuit)
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

# ── SIGNAL TECHNIQUE ──────────────────────────────────────────

SIGNAL_MAX_AGE_SECONDS = 180
SIGNAL_SECRET = os.getenv("SIGNAL_SECRET")


class TVSignal(BaseModel):
    direction: Literal["LONG", "SHORT"]
    type: str           # "SSL", "BSL", "RSI_DIV", "VOLUME_SPIKE", ...
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

    # 1) Bias macro — lu depuis le cache, sans re-appeler Twelve Data
    #    Si le cache est vide (premier démarrage), on lance get_macro() une fois.
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
        # Cache absent → un seul appel complet, puis lecture du résultat
        await get_macro()
        for k, info in INSTR.items():
            hit = _cached(f"{info['symbol']}_{info['ma']}")
            instruments_cached[k] = hit or {}

    bias, long_score, short_score, _, _ = compute_bias(instruments_cached)
    session      = get_session()
    session_ok   = session["active"]
    session_name = session["name"]
    macro_ok     = bias in ("LONG", "SHORT")
    score        = max(long_score, short_score)

    # 2) Signal technique (lecture thread-safe)
    async with _signal_lock:
        signal = _last_signal

    fresh = (
        signal is not None
        and (now - signal.received_at).total_seconds() <= SIGNAL_MAX_AGE_SECONDS
    )
    signal_valid = fresh and signal.volume_ok and signal.zone_ok

    # 3) Fusion
    if not session_ok:
        return _none(f"Hors session ({session_name})")
    if not macro_ok:
        return _none(f"Macro neutre (long={long_score}/4, short={short_score}/4)")
    if not signal_valid:
        return _none("Pas de signal technique valide ou signal expiré")
    if signal.direction != bias:
        return _none(f"Signal {signal.direction} contredit le bias macro {bias}")

    # 4) SL / TP dynamiques depuis ATR Gold
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
        "status":      "ok",
        "time":        datetime.now(timezone.utc).isoformat(),
        "api_key_set": API_KEY != "demo",
        "cache_keys":  len(_cache),
        "cors_origins": ALLOWED_ORIGINS,
    }
