from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.providers.demo import DEMO_SITES, demo_payload
from app.providers.open_meteo import open_meteo

app = FastAPI(title="Rainfall & Flood Risk Prototype", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["*"], allow_headers=["*"])

REGIONS = [
    {"id": "pune", "name": "Pune demo region", "lat": 18.5204, "lon": 73.8567},
    {"id": "mumbai", "name": "Mumbai", "lat": 19.0760, "lon": 72.8777},
    {"id": "chennai", "name": "Chennai", "lat": 13.0827, "lon": 80.2707},
    {"id": "hyderabad", "name": "Hyderabad", "lat": 17.3850, "lon": 78.4867},
    {"id": "delhi", "name": "New Delhi", "lat": 28.6139, "lon": 77.2090},
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def check_mode(mode: str) -> None:
    if mode not in {"demo", "live"}:
        raise HTTPException(status_code=422, detail="mode must be 'demo' or 'live'.")


def check_coordinates(lat: float, lon: float) -> None:
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(status_code=422, detail="Coordinates must be valid WGS84 latitude/longitude values.")


async def get_dashboard(mode: str, lat: float, lon: float, name: str) -> dict[str, Any]:
    check_mode(mode)
    check_coordinates(lat, lon)
    return demo_payload() if mode == "demo" else await open_meteo(lat, lon, name[:100])


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ifis-prototype", "version": "0.1.0"}


@app.get("/api/regions")
def regions() -> list[dict[str, Any]]:
    return REGIONS


@app.get("/api/locations/search")
async def search_locations(q: str = Query(min_length=2, max_length=80)) -> list[dict[str, Any]]:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get("https://geocoding-api.open-meteo.com/v1/search", params={"name": q, "count": 6, "language": "en", "format": "json"}, headers={"User-Agent": "IFIS-student-prototype/0.1"})
            response.raise_for_status()
            results = response.json().get("results", [])
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Location search is temporarily unavailable.") from exc
    return [{"name": ", ".join(filter(None, [item.get("name"), item.get("admin1"), item.get("country")])), "lat": item["latitude"], "lon": item["longitude"], "country": item.get("country")} for item in results]


@app.get("/api/dashboard")
async def dashboard(mode: str = "demo", lat: float = 18.5204, lon: float = 73.8567, name: str = "Pune") -> dict[str, Any]:
    return await get_dashboard(mode, lat, lon, name)


@app.get("/api/rainfall")
async def rainfall(mode: str = "demo", lat: float = 18.5204, lon: float = 73.8567, name: str = "Pune") -> dict[str, Any]:
    data = await get_dashboard(mode, lat, lon, name)
    return {"location": data["location"], "source": data["source"], "rainfall": data["rainfall"]}


@app.get("/api/rainfall/forecast")
async def forecast(mode: str = "demo", lat: float = 18.5204, lon: float = 73.8567, name: str = "Pune") -> dict[str, Any]:
    data = await get_dashboard(mode, lat, lon, name)
    return {"location": data["location"], "source": data["source"], "forecast": data["forecast"], "risk": data["risk"]}


@app.get("/api/risk")
def risk(mode: str = "demo") -> dict[str, Any]:
    check_mode(mode)
    if mode != "demo":
        return {"category": "Unknown / Insufficient Data", "score": None, "method": "No validated vulnerability layers or flood model are connected.", "quality": "INCOMPLETE"}
    return demo_payload()["risk"]


@app.get("/api/risk-map")
def risk_map(mode: str = "demo") -> dict[str, Any]:
    check_mode(mode)
    return {"label": "Illustrative demo risk sites — not inundation boundaries" if mode == "demo" else "No validated live risk layer available", "sites": DEMO_SITES if mode == "demo" else [], "source": "Simulated demo dataset" if mode == "demo" else "Unavailable"}


@app.get("/api/alerts")
def alerts(mode: str = "demo") -> list[dict[str, Any]]:
    check_mode(mode)
    return demo_payload()["alerts"] if mode == "demo" else []


@app.get("/api/history")
def history() -> dict[str, Any]:
    return {"available": False, "message": "No verified historical rainfall/flood archive or model evaluation dataset is connected. Metrics are intentionally omitted."}


@app.get("/api/data-status")
def data_status() -> dict[str, Any]:
    return {"checked_at": utc_now(), "providers": [{"name": "Illustrative demo dataset", "state": "available", "type": "simulated", "freshness": "Values are synthetic; timestamp denotes this response only."}, {"name": "Open-Meteo Forecast API", "state": "optional", "type": "model forecast", "freshness": "Fetched on request; not a rain-gauge observation."}, {"name": "Open-Meteo Geocoding API", "state": "optional", "type": "place search", "freshness": "Fetched on request."}, {"name": "IMD", "state": "not connected", "type": "official rainfall/forecast/warnings", "freshness": "Access and integration pending."}, {"name": "MOSDAC / ISRO", "state": "not connected", "type": "satellite products", "freshness": "Download requires account credentials per official manual."}, {"name": "Terrain, drainage and flood history", "state": "missing", "type": "risk model inputs", "freshness": "No validated dataset loaded."}], "last_prediction": None, "processing_errors": []}
