from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import HTTPException


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


async def open_meteo(lat: float, lon: float, name: str) -> dict[str, Any]:
    params = {"latitude": lat, "longitude": lon, "hourly": "precipitation", "current": "precipitation", "past_days": 1, "forecast_days": 2, "timezone": "auto"}
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get("https://api.open-meteo.com/v1/forecast", params=params, headers={"User-Agent": "IFIS-student-prototype/0.1"})
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Live weather provider is temporarily unavailable; switch to demo mode.") from exc

    hourly = data.get("hourly", {})
    times = hourly.get("time", [])
    rain = hourly.get("precipitation", [])
    current_time = data.get("current", {}).get("time")
    now_index = next((i for i, value in enumerate(times) if value == current_time), None)
    if now_index is None:
        now_index = max(0, len(times) // 3)
    recent = [value for value in rain[max(0, now_index - 23):now_index + 1] if isinstance(value, (int, float))]
    last3 = [value for value in rain[max(0, now_index - 2):now_index + 1] if isinstance(value, (int, float))]
    future_times = times[now_index:now_index + 13]
    future_rain = rain[now_index:now_index + 13]
    return {
        "mode": "live-weather", "location": {"name": name, "lat": lat, "lon": lon},
        "source": {"name": "Open-Meteo Forecast API", "kind": "model forecast", "status": "LIVE WEATHER MODEL DATA — FLOOD RISK NOT AVAILABLE", "at": utc_now(), "provider_time": current_time, "elevation_m": data.get("elevation")},
        "rainfall": {"observed": False, "current_mm_h": data.get("current", {}).get("precipitation"), "accumulation_mm": {"1h": rain[now_index] if now_index < len(rain) else None, "3h": round(sum(last3), 1) if len(last3) == 3 else None, "24h": round(sum(recent), 1) if len(recent) >= 20 else None}, "note": "Open-Meteo gridded model output, not a local rain-gauge observation. Past-hour accumulation uses the provider's precipitation series."},
        "forecast": {"source": "Open-Meteo Forecast API", "unit": "mm", "period": "Next 12 hourly model steps", "hours": future_times, "precipitation": future_rain, "note": "Hourly model precipitation. This is not a flood forecast."},
        "risk": {"category": "Unknown / Insufficient Data", "score": None, "method": "Not estimated: no validated terrain, drainage, river-level or historical-flood inputs are connected.", "factors": ["Live model precipitation is available", "Local vulnerability datasets are missing"], "quality": "INCOMPLETE", "as_of": utc_now()},
        "sites": [], "alerts": [], "updated_at": utc_now(),
    }
