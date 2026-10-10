# RainWatch — regional rainfall and flood-risk prototype

A small SIH PS 26071 prototype showing one end-to-end path from rainfall data to a transparent flood-risk status and integrated alert view. It intentionally distinguishes rainfall from flood risk and avoids claiming inundation prediction.

## Quick start

Requirements: Python 3.10+ and Node.js 20+.

```bash
# Terminal 1: API
cd backend
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: web UI
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The demo starts without accounts or API keys. The frontend proxies `/api` to FastAPI on port 8000. API docs are at <http://localhost:8000/docs>.

Run backend tests:

```bash
cd backend
pip install -r requirements.txt
pytest -q
```

Build-check the frontend:

```bash
cd frontend
npm run build
```

## Evaluator walkthrough

1. Open Overview and note the **DEMO DATA — NOT LIVE** banner.
2. Inspect the regional point scenarios on the map; choose a marker to view a different illustrative risk case.
3. Open Forecast, Alerts & Safety, Historical Events, and Data Status.
4. Use the top-right mode control to switch to Live weather, or search for a place. Open-Meteo hourly precipitation and a short-range model series are fetched on request. It is model output, not a rain-gauge observation.
5. Click any point on the map to inspect model precipitation at that coordinate. Risk intentionally changes to **Unknown / Insufficient Data**.
6. Return to Demo for the synthetic alert and local-only operator acknowledgement demonstration.

Browser geolocation is optional. If permission is denied, place search and map-click selection remain available. Search requires the Open-Meteo geocoding endpoint; if unavailable, users can still inspect demo scenarios or choose a map point.

## Architecture

- `frontend/`: React + TypeScript + Vite; React-Leaflet map and Recharts hourly visualization.
- `backend/app/main.py`: FastAPI endpoints, input validation, source status, and modular provider selection.
- `backend/app/providers/`: deterministic illustrative demo fixture and optional Open-Meteo forecast adapter.
- The demo and live weather response paths are kept separate. Live rainfall never inherits a synthetic risk score.
- Current storage is in-memory; no user accounts or persistent operator changes are implemented.

Core endpoints include `/api/health`, `/api/regions`, `/api/locations/search`, `/api/dashboard`, `/api/rainfall`, `/api/rainfall/forecast`, `/api/risk`, `/api/risk-map`, `/api/alerts`, `/api/history`, and `/api/data-status`.

## Data-source inventory

| Source | Prototype status | What it provides / caveat |
|---|---|---|
| Open-Meteo Forecast API | Integrated, optional live mode | Coordinate-based hourly precipitation model output. The API responded successfully during development. Not an observed local gauge value, official IMD warning, or flood-risk product. Use for a student demonstration; review the provider's current terms before public/commercial operation. |
| Open-Meteo Geocoding API | Integrated, optional place search | Geocoding for place-name lookup; fetched on demand. It is a separate endpoint from forecast. |
| Illustrative demo scenario fixture | Integrated, default mode | Synthetic rainfall values, risk factors, point markers and warning. Clearly labelled demo, not linked to actual events at the displayed coordinates. |
| India Meteorological Department (IMD) | Not integrated; access/integration verification pending | Official public API reference lists rainfall, forecasts, nowcasts, and warnings. The public reference page was accessible; operational access, authentication, permissible reuse, rate limits, and reliability still require a dedicated check before integration. |
| MOSDAC / ISRO | Not integrated; account required for downloads | Official download manual says dataset search/preview can be unauthenticated, but downloading requires MOSDAC account credentials. |
| Terrain, drainage, river levels, historical flood records | Missing | No validated layer is bundled. Live-weather risk therefore stays Unknown. No inundation polygon or depth is estimated. |
| OSM basemap | Integrated for map display | Map tile attribution is displayed. Standard OSM tile service is suitable for low-volume interactive preview subject to its usage policy; production/high-volume use should select a contracted or self-hosted tile service. |

## Baseline assumptions and limitations

The demo risk categories are fixed teaching scenarios, not a trained machine-learning model and not a scientific estimate for Pune or any user-selected location. The score is illustrative only. The live path displays hourly precipitation from a gridded forecast provider and deliberately returns Unknown risk because no validated elevation, slope, drainage, river proximity, historical flood, or gauge observations are integrated.

The application does not estimate actual inundation extent, water depth, street-level risk, or official warnings. Alert text is synthetic and exists only in demo mode. The operator toggle is a UI mockup with no authentication and no persisted acknowledgement. Historical performance metrics are omitted because evaluation data is unavailable.

Before operational use, replace the demo provider with authorized, verified datasets; establish spatial resolution, update cadence, quality control, licensing, and model validation; and integrate an approved notification channel only after end-to-end testing.

## Verified documentation

- Open-Meteo forecast API docs: <https://open-meteo.com/en/docs>
- Open-Meteo pricing/terms: <https://open-meteo.com/en/pricing>
- Open-Meteo geocoding API docs: <https://open-meteo.com/en/docs/geocoding-api>
- IMD API reference: <https://api.imd.gov.in/public/api_reference.html>
- MOSDAC download API manual: <https://mosdac.gov.in/downloadapi-manual>
- OpenStreetMap tile usage policy: <https://operations.osmfoundation.org/policies/tiles/>
- OpenStreetMap copyright and attribution: <https://www.openstreetmap.org/copyright>
- NDMA public information: <https://ndma.gov.in/>
