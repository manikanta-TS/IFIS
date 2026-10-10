from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'


def test_demo_dashboard_is_explicitly_simulated():
    data = client.get('/api/dashboard?mode=demo').json()
    assert data['source']['status'] == 'DEMO DATA — NOT LIVE'
    assert data['rainfall']['observed'] is False
    assert data['risk']['quality'] == 'SIMULATED'
    assert len(data['sites']) >= 3


def test_live_risk_is_unknown_without_geospatial_features():
    response = client.get('/api/risk?mode=live')
    assert response.status_code == 200
    assert response.json()['category'] == 'Unknown / Insufficient Data'
    assert response.json()['score'] is None


def test_invalid_coordinates_are_rejected():
    response = client.get('/api/dashboard?mode=live&lat=95&lon=0')
    assert response.status_code == 422


def test_history_does_not_invent_metrics():
    data = client.get('/api/history').json()
    assert data['available'] is False
    assert 'omitted' in data['message']


def test_data_status_identifies_unconnected_sources():
    data = client.get('/api/data-status').json()
    names = {provider['name']: provider['state'] for provider in data['providers']}
    assert names['IMD'] == 'not connected'
    assert names['Terrain, drainage and flood history'] == 'missing'
