"""Unit tests for backend logic"""
import pytest
from main import compute_bias, get_session
from datetime import datetime, timezone

# ──────────────────────────────────────────────────────
# BIAS COMPUTATION TESTS
# ──────────────────────────────────────────────────────

def test_compute_bias_long():
    """Test LONG bias with ≥3/4 filters"""
    instr = {
        "DXY": {"trend": "bear"},  # Long
        "TLT": {"trend": "bull"},  # Long
        "VIX": {"price": 25},       # Long (>20)
        "SPX": {"trend": "bull"},   # Short
    }
    bias, ls, ss, lsig, ssig = compute_bias(instr)
    assert bias == "LONG"
    assert ls == 3
    assert ss == 1
    assert "DXY" in lsig and "TLT" in lsig and "VIX" in lsig

def test_compute_bias_short():
    """Test SHORT bias with ≥3/4 filters"""
    instr = {
        "DXY": {"trend": "bull"},   # Short
        "TLT": {"trend": "bear"},   # Short
        "VIX": {"price": 15},       # Short (≤20)
        "SPX": {"trend": "bull"},   # Short
    }
    bias, ls, ss, lsig, ssig = compute_bias(instr)
    assert bias == "SHORT"
    assert ls == 0
    assert ss == 4
    assert "DXY" in ssig and "TLT" in ssig and "VIX" in ssig and "SPX" in ssig

def test_compute_bias_neutral():
    """Test NEUTRAL bias with <3/4 filters"""
    instr = {
        "DXY": {"trend": "bear"},   # Long
        "TLT": {"trend": "bull"},   # Long
        "VIX": {"price": 15},       # Short
        "SPX": {"trend": "bull"},   # Short
    }
    bias, ls, ss, lsig, ssig = compute_bias(instr)
    assert bias == "NEUTRAL"
    assert ls == 2
    assert ss == 2

def test_compute_bias_missing_data():
    """Test bias calculation with missing instruments"""
    instr = {
        "DXY": {"trend": "bear"},
        "TLT": {"trend": "bull"},
        "VIX": {},  # No price
        "SPX": {"trend": "bear"},
    }
    bias, ls, ss, lsig, ssig = compute_bias(instr)
    assert bias == "LONG"  # 3/3 working filters = LONG
    assert ls == 3

def test_compute_bias_vix_boundary():
    """Test VIX at exactly 20 threshold"""
    instr = {
        "DXY": {"trend": "bear"},
        "TLT": {"trend": "bull"},
        "VIX": {"price": 20},  # Exactly 20 = Short
        "SPX": {"trend": "bear"},
    }
    bias, ls, ss, lsig, ssig = compute_bias(instr)
    assert bias == "LONG"  # DXY + TLT + SPX = 3
    assert "VIX" in ssig  # VIX counts as Short at 20

# ──────────────────────────────────────────────────────
# SESSION CALCULATION TESTS
# ──────────────────────────────────────────────────────

def test_session_london():
    """London session is 7-16 UTC"""
    # Mock: We'll test the logic, not actual time
    # This is a basic validation test
    session = get_session()
    h = session["utc_hour"]
    expected_london = 7 <= h < 16
    assert session["london"] == expected_london

def test_session_ny():
    """NY session is 13-21 UTC"""
    session = get_session()
    h = session["utc_hour"]
    expected_ny = 13 <= h < 21
    assert session["ny"] == expected_ny

def test_session_overlap():
    """Overlap is 13-16 UTC (both London and NY)"""
    session = get_session()
    h = session["utc_hour"]
    expected_overlap = 13 <= h < 16
    assert session["overlap"] == expected_overlap
    if expected_overlap:
        assert session["london"] and session["ny"]

def test_session_active():
    """Session is active if London OR NY"""
    session = get_session()
    assert session["active"] == (session["london"] or session["ny"])

# ──────────────────────────────────────────────────────
# INTEGRATION TESTS
# ──────────────────────────────────────────────────────

def test_complete_scenario():
    """Test realistic scenario with all data points"""
    instr = {
        "DXY": {"symbol": "DX/USD", "price": 103.5, "ma": 102.0, "trend": "bear"},
        "TLT": {"symbol": "TLT", "price": 92.3, "ma": 91.0, "trend": "bull"},
        "VIX": {"symbol": "VIX", "price": 22.5},
        "SPX": {"symbol": "SPX500", "price": 4900, "ma": 5000, "trend": "bear"},
        "GOLD": {"symbol": "XAU/USD", "price": 2070.5},
    }
    bias, ls, ss, lsig, ssig = compute_bias(instr)
    assert bias == "LONG"
    assert ls == 4  # All 4 filters point to Long
    assert ss == 0

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
