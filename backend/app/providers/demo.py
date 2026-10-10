from datetime import datetime, timezone
from typing import Any

DEMO_SITES = [
    {"id": "ridge", "name": "Demo Ridge", "lat": 18.548, "lon": 73.781, "rain_1h": 2.4, "rain_3h": 9.1, "rain_24h": 21.8, "forecast_6h": 12.0, "risk": "Low", "score": 0.18, "factors": ["Illustrative elevated-site scenario", "No official flood layer connected"]},
    {"id": "city", "name": "Demo City Centre", "lat": 18.5204, "lon": 73.8567, "rain_1h": 8.2, "rain_3h": 24.6, "rain_24h": 51.3, "forecast_6h": 34.0, "risk": "Moderate", "score": 0.46, "factors": ["Illustrative rainfall scenario", "Drainage capacity unavailable"]},
    {"id": "creek", "name": "Demo Creekside Lowland", "lat": 18.491, "lon": 73.893, "rain_1h": 18.6, "rain_3h": 47.2, "rain_24h": 96.4, "forecast_6h": 58.0, "risk": "High", "score": 0.78, "factors": ["Illustrative low-lying scenario", "Illustrative river proximity", "Not a validated inundation model"]},
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def demo_payload() -> dict[str, Any]:
    now = utc_now()
    hours = ["Now", "+1h", "+2h", "+3h", "+4h", "+5h", "+6h", "+7h", "+8h", "+9h", "+10h", "+11h"]
    rain = [1.2, 2.4, 4.1, 6.8, 7.2, 5.4, 3.1, 1.4, 0.8, 0.3, 0, 0]
    return {
        "mode": "demo", "location": {"name": "Pune demo region", "lat": 18.5204, "lon": 73.8567},
        "source": {"name": "Illustrative demo dataset", "kind": "simulated", "status": "DEMO DATA — NOT LIVE", "at": now},
        "rainfall": {"observed": False, "current_mm_h": 8.2, "accumulation_mm": {"1h": 8.2, "3h": 24.6, "24h": 51.3}, "note": "Illustrative values; not observations for this location."},
        "forecast": {"source": "Illustrative demo dataset", "unit": "mm", "period": "12 illustrative hourly steps", "hours": hours, "precipitation": rain, "note": "Synthetic demonstration series, not a meteorological forecast."},
        "risk": {"category": "Moderate", "score": 0.46, "method": "Rule-based teaching baseline v0.1 (illustrative scenario inputs)", "factors": ["Illustrative rainfall scenario", "Drainage capacity unavailable"], "quality": "SIMULATED", "as_of": now},
        "sites": DEMO_SITES,
        "alerts": [{"id": "demo-1", "location": "Demo Creekside Lowland", "severity": "High", "status": "Active (demo)", "window": "Illustrative next 3–6 hours", "rainfall": "Illustrative 47 mm / 3 h; 58 mm / next 6 h", "risk": "High (illustrative)", "updated_at": now, "precautions": "Demo text only. Follow official local instructions; never treat this prototype as an official warning.", "source": "Simulated demo scenario"}],
        "updated_at": now,
    }
