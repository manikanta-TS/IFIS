import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from 'react-leaflet';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, Check, ChevronDown, Clock3, CloudRain, Database, Droplets, ExternalLink, Gauge, History, Layers3, LocateFixed, Map as MapIcon, MapPin, Menu, RefreshCw, Search, ShieldCheck, Waves, X } from 'lucide-react';

type Site = { id: string; name: string; lat: number; lon: number; rain_1h: number; rain_3h: number; rain_24h: number; forecast_6h: number; risk: string; score: number; factors: string[] };
type Location = { name: string; lat: number; lon: number };
type Dashboard = { mode: string; location: Location; source: { name: string; kind: string; status: string; at: string; provider_time?: string; elevation_m?: number }; rainfall: { observed: boolean; current_mm_h: number | null; accumulation_mm: Record<string, number | null>; note: string }; forecast: { source: string; unit: string; period: string; hours: string[]; precipitation: number[]; note: string }; risk: { category: string; score: number | null; method: string; factors: string[]; quality: string; as_of: string }; sites: Site[]; alerts: any[]; updated_at: string };
type Page = 'overview' | 'map' | 'forecast' | 'alerts' | 'history' | 'status';
const pages: { id: Page; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: Activity }, { id: 'map', label: 'Rainfall & risk map', icon: MapIcon },
  { id: 'forecast', label: 'Forecast', icon: CloudRain }, { id: 'alerts', label: 'Alerts & safety', icon: Bell },
  { id: 'history', label: 'Historical events', icon: History }, { id: 'status', label: 'Data status', icon: Database },
];
const riskClass = (risk?: string) => risk?.startsWith('Very') ? 'very-high' : risk?.startsWith('High') ? 'high' : risk?.startsWith('Moderate') ? 'moderate' : risk?.startsWith('Low') ? 'low' : 'unknown';
const fmt = (n: number | null | undefined) => typeof n === 'number' ? `${n.toFixed(1)} mm` : '—';
const localTime = (iso?: string) => iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not available';

function MapClick({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click(event) { onPick(event.latlng.lat, event.latlng.lng); } });
  return null;
}

function RiskMap({ center, sites, selectedSite, onSelectSite, onPick, compact = false }: { center: [number, number]; sites: Site[]; selectedSite: string | null; onSelectSite: (site: Site) => void; onPick: (lat: number, lon: number) => void; compact?: boolean }) {
  return <MapContainer center={center} zoom={compact ? 11 : 12} scrollWheelZoom={!compact} className="leaflet-map">
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <MapClick onPick={onPick} />
    {sites.map(site => <CircleMarker key={site.id} center={[site.lat, site.lon]} radius={selectedSite === site.id ? 11 : 8} pathOptions={{ color: '#fff', weight: 2, fillColor: riskClass(site.risk) === 'high' ? '#e35243' : riskClass(site.risk) === 'moderate' ? '#edaa32' : '#3d9a70', fillOpacity: .92 }} eventHandlers={{ click: () => onSelectSite(site) }}>
      <Popup><strong>{site.name}</strong><br />{site.risk} risk · demo scenario<br />1 h rain: {site.rain_1h} mm</Popup>
    </CircleMarker>)}
  </MapContainer>;
}

function RainChart({ data }: { data: Dashboard['forecast'] }) {
  const chartData = data.hours.map((hour, i) => ({ hour: hour.includes('T') ? new Date(hour).toLocaleTimeString([], { hour: 'numeric' }) : hour, rain: data.precipitation[i] ?? 0 }));
  return <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 12, right: 10, left: -18, bottom: 0 }}>
    <defs><linearGradient id="rainFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4b9fe4" stopOpacity={.25} /><stop offset="95%" stopColor="#4b9fe4" stopOpacity={.02} /></linearGradient></defs>
    <CartesianGrid stroke="#eaf0f4" vertical={false} /><XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fill: '#788797', fontSize: 11 }} interval="preserveStartEnd" /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#788797', fontSize: 11 }} unit=" mm" /><Tooltip formatter={(v: number) => [`${Number(v).toFixed(1)} mm`, 'Precipitation']} contentStyle={{ border: '1px solid #e7edf1', borderRadius: 10, fontSize: 12 }} /><Area type="monotone" dataKey="rain" stroke="#4298dc" strokeWidth={2.5} fill="url(#rainFill)" />
  </AreaChart></ResponsiveContainer></div>;
}

export default function App() {
  const [page, setPage] = useState<Page>('overview');
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [location, setLocation] = useState<Location>({ name: 'Pune demo region', lat: 18.5204, lon: 73.8567 });
  const [data, setData] = useState<Dashboard | null>(null);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [operator, setOperator] = useState(false);
  const [resolved, setResolved] = useState<string[]>([]);
  const [mobileNav, setMobileNav] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const requestSequence = useRef(0);

  const load = useCallback(async (nextMode = mode, nextLocation = location) => {
    const requestId = ++requestSequence.current;
    if (nextMode !== mode || nextLocation.lat !== location.lat || nextLocation.lon !== location.lon) setData(null);
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams({ mode: nextMode, lat: String(nextLocation.lat), lon: String(nextLocation.lon), name: nextLocation.name });
      const response = await fetch(`/api/dashboard?${query}`);
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.detail || 'Unable to load this data. Please try again.'); }
      const result: Dashboard = await response.json();
      if (requestId === requestSequence.current) { setData(result); setLastRefresh(Date.now()); }
    } catch (e) {
      if (requestId === requestSequence.current) setError(e instanceof Error ? e.message : 'Could not reach the data service.');
    } finally { if (requestId === requestSequence.current) setLoading(false); }
  }, [mode, location]);

  useEffect(() => { void load(); }, []); // initial request only; intentional
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (search.trim().length < 2) { setSuggestions([]); return; }
      try { const response = await fetch(`/api/locations/search?q=${encodeURIComponent(search.trim())}`); if (response.ok) setSuggestions(await response.json()); else setSuggestions([]); }
      catch { setSuggestions([]); }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const activeSite = selectedSite ?? data?.sites.find(site => site.id === 'city') ?? null;
  const risk = mode === 'demo' && activeSite ? { category: activeSite.risk, score: activeSite.score, method: 'Rule-based teaching baseline v0.1 (illustrative scenario inputs)', factors: activeSite.factors, quality: 'SIMULATED', as_of: data?.risk.as_of ?? '' } : data?.risk;
  const center = useMemo<[number, number]>(() => activeSite && mode === 'demo' ? [activeSite.lat, activeSite.lon] : [location.lat, location.lon], [activeSite, mode, location]);

  const pickLocation = (lat: number, lon: number) => {
    const next = { name: `Selected map point (${lat.toFixed(3)}, ${lon.toFixed(3)})`, lat, lon };
    setMode('live'); setLocation(next); setSelectedSite(null); void load('live', next);
  };
  const chooseLocation = (item: Location) => { setLocation(item); setMode('live'); setSelectedSite(null); setSearch(''); setSuggestions([]); void load('live', item); };
  const useMyLocation = () => {
    if (!navigator.geolocation) { setError('Geolocation is not supported by this browser. Search or select a point on the map instead.'); return; }
    navigator.geolocation.getCurrentPosition(position => chooseLocation({ name: 'Your selected location', lat: position.coords.latitude, lon: position.coords.longitude }), () => setError('Location permission was unavailable. You can search for a place or select a point on the map.'), { timeout: 8000 });
  };
  const switchMode = (next: 'demo' | 'live') => { setMode(next); setSelectedSite(null); void load(next, location); };

  const renderMap = (compact = false) => data ? <RiskMap center={center} sites={mode === 'demo' ? data.sites : []} selectedSite={activeSite?.id ?? null} onSelectSite={site => setSelectedSite(site)} onPick={pickLocation} compact={compact} /> : <div className="map-loading">Map loading…</div>;
  const selectedRain = mode === 'demo' && activeSite ? { '1h': activeSite.rain_1h, '3h': activeSite.rain_3h, '24h': activeSite.rain_24h } : data?.rainfall.accumulation_mm;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Waves size={21} /></div><div><strong>RainWatch</strong><span>REGIONAL RISK MONITOR</span></div><button className="icon-btn close-nav" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="region-label">MONITORING REGION</div><button className="region-switch" onClick={() => { setPage('overview'); setMobileNav(false); }}><MapPin size={16} /><span>{mode === 'demo' ? 'Pune demo region' : location.name}</span><ChevronDown size={15} /></button>
      <nav>{pages.map(item => { const Icon = item.icon; return <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => { setPage(item.id); setMobileNav(false); }}><Icon size={17} /><span>{item.label}</span>{item.id === 'alerts' && data?.alerts.length ? <b className="nav-count">{data.alerts.length}</b> : null}</button>; })}</nav>
      <div className="sidebar-bottom"><div className="provider-mini"><span className={`pulse ${mode}`} /><div><b>{mode === 'demo' ? 'Demo mode' : 'Live weather mode'}</b><small>{mode === 'demo' ? 'Illustrative values only' : 'Model output · no flood layer'}</small></div></div><div className="sidebar-footer">Prototype · SIH PS 26071<br />Not an official warning service</div></div>
    </aside>
    {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><div className="top-left"><button className="icon-btn menu-btn" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={19} /></button><div className="breadcrumb">Monitoring <span>/</span> <b>{pages.find(p => p.id === page)?.label}</b></div></div><div className="top-actions"><div className="search-box"><Search size={16} /><input value={search} placeholder="Search city or place" onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && suggestions[0]) chooseLocation(suggestions[0]); if (e.key === 'Escape') setSuggestions([]); }} /><button title="Use my location" onClick={useMyLocation}><LocateFixed size={16} /></button>{suggestions.length > 0 && <div className="suggestions">{suggestions.map((item, i) => <button key={`${item.lat}-${i}`} onClick={() => chooseLocation(item)}><MapPin size={14} /><span>{item.name}</span></button>)}</div>}</div><div className="mode-control"><button className={mode === 'demo' ? 'selected' : ''} onClick={() => switchMode('demo')}>Demo</button><button className={mode === 'live' ? 'selected' : ''} onClick={() => switchMode('live')}>Live weather</button></div><button className="icon-btn refresh-btn" title="Refresh data" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} /></button></div></header>
      <div className="content">
        <div className="page-heading"><div><div className="eyebrow">REGIONAL WEATHER INTELLIGENCE</div><h1>{page === 'overview' ? 'Rainfall & flood-risk overview' : pages.find(p => p.id === page)?.label}</h1><p>{page === 'overview' ? `Monitoring ${mode === 'demo' ? 'an illustrative Pune-area scenario' : location.name}.` : 'Localized conditions, data provenance, and model limitations in one place.'}</p></div><div className="updated-pill"><Clock3 size={14} /><span>Updated {new Date(lastRefresh).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div></div>
        {mode === 'demo' && <div className="demo-banner"><div className="demo-icon"><Activity size={16} /></div><div><b>DEMO DATA — NOT LIVE</b><span>Rainfall values, map markers, risk scenarios and alert text are illustrative. They are not observations, predictions, or official warnings for your selected location.</span></div></div>}
        {mode === 'live' && <div className="live-banner"><CloudRain size={17} /><div><b>Live weather model data · flood risk unavailable</b><span>Open-Meteo precipitation output is modelled, not a local gauge reading. No validated terrain or flood-history layer is connected.</span></div></div>}
        {error && <div className="error-banner"><AlertTriangle size={16} /><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={15} /></button></div>}
        {!data && !error ? <div className="loading-state"><div className="loader" />Loading regional data…</div> : null}

        {page === 'overview' && data && <>
          <section className="metric-grid">
            <Metric icon={<Droplets size={17} />} label="Rainfall · last hour" value={fmt(selectedRain?.['1h'])} note={mode === 'demo' ? 'Illustrative scenario' : 'Modelled precipitation'} tone="blue" />
            <Metric icon={<Waves size={17} />} label="Accumulation · 24 h" value={fmt(selectedRain?.['24h'])} note={mode === 'demo' ? 'Synthetic demo total' : 'Past model accumulation'} tone="blue" />
            <Metric icon={<CloudRain size={17} />} label="Forecast · next 6 h" value={mode === 'demo' && activeSite ? fmt(activeSite.forecast_6h) : fmt(data.forecast.precipitation.slice(0, 6).reduce((a, b) => a + (b || 0), 0))} note={mode === 'demo' ? 'Synthetic forecast scenario' : 'Model precipitation total'} tone="blue" />
            <Metric icon={<ShieldCheck size={17} />} label="Estimated flood risk" value={risk?.category ?? 'Unknown'} note={risk?.quality === 'SIMULATED' ? 'Illustrative baseline' : 'No validated model inputs'} tone={riskClass(risk?.category)} />
          </section>
          <section className="overview-grid"><div className="card map-card"><div className="card-head"><div><h2>Regional risk map</h2><p>{mode === 'demo' ? 'Illustrative scenario markers · select a marker for details' : 'Click the map to inspect model rainfall at a point'}</p></div><button className="text-button" onClick={() => setPage('map')}>Open full map <ArrowUpRight size={14} /></button></div><div className="map-frame">{renderMap(true)}<div className="map-tag"><span className="map-dot" />{mode === 'demo' ? 'Illustrative point scenarios' : 'Weather grid point'}</div></div>{mode === 'demo' ? <div className="map-legend"><span><i className="legend-dot low" />Low</span><span><i className="legend-dot moderate" />Moderate</span><span><i className="legend-dot high" />High</span><small>Illustrative point scenarios, not inundation boundaries.</small></div> : <div className="map-legend"><span><i className="legend-dot unknown" />Flood-risk layer unavailable</span><small>Base geography only.</small></div>}</div>
            <div className="card risk-card"><div className="card-head"><div><h2>Risk assessment</h2><p>Transparent baseline · not an ML model</p></div><Gauge size={19} className="muted-icon" /></div><div className={`risk-status ${riskClass(risk?.category)}`}><span className="risk-status-dot" /><div><small>ESTIMATED CATEGORY</small><strong>{risk?.category ?? 'Unknown'}</strong></div>{typeof risk?.score === 'number' && <span className="score">{Math.round(risk.score * 100)}<small>/100</small></span>}</div><div className="factor-heading">Contributing information</div><ul className="factor-list">{risk?.factors?.map(factor => <li key={factor}><span className="factor-check"><Check size={11} /></span>{factor}</li>)}</ul><div className="method-note"><b>Method</b><p>{risk?.method}</p></div><button className="outline-button" onClick={() => setPage('status')}>View data quality <ArrowUpRight size={14} /></button></div></section>
          <section className="bottom-grid"><div className="card chart-card"><div className="card-head"><div><h2>Rainfall timeline</h2><p>{mode === 'demo' ? 'Illustrative hourly series' : 'Open-Meteo model precipitation · hourly'}</p></div><span className="unit-chip">mm / hour</span></div><RainChart data={data.forecast} /></div><div className="card alert-summary"><div className="card-head"><div><h2>Regional alerts</h2><p>Integrated risk-based warnings</p></div><button className="text-button" onClick={() => setPage('alerts')}>View all <ArrowUpRight size={14} /></button></div>{data.alerts.length ? data.alerts.map(alert => <div className="alert-preview" key={alert.id}><span className="alert-severity-dot" /><div><b>{alert.location}</b><p>{alert.severity} estimated risk · {alert.window}</p><small>{alert.status} · demo scenario</small></div><ArrowDownRight size={16} /></div>) : <div className="empty-inline"><ShieldCheck size={20} /><span>No active risk-based alerts for this live location. This does not indicate zero flood risk.</span></div>}</div></section>
        </>}

        {page === 'map' && data && <section className="card full-map-card"><div className="card-head"><div><h2>{mode === 'demo' ? 'Illustrative regional scenarios' : 'Live weather location map'}</h2><p>{mode === 'demo' ? 'Markers represent fictional teaching scenarios, not measured flood zones.' : 'Select any point to request model precipitation. Flood-risk estimate remains unavailable.'}</p></div><div className="layer-toggle"><Layers3 size={15} />{mode === 'demo' ? 'Scenario markers on' : 'Weather points only'}</div></div><div className="full-map-frame">{renderMap(false)}</div><div className="full-map-bottom">{mode === 'demo' ? <div className="map-legend"><span><i className="legend-dot low" />Low</span><span><i className="legend-dot moderate" />Moderate</span><span><i className="legend-dot high" />High</span><span><i className="legend-dot unknown" />Unknown</span></div> : <div className="map-legend"><span><i className="legend-dot unknown" />Flood-risk layer unavailable</span></div>}<span className="map-timestamp"><Clock3 size={13} /> Data response: {localTime(data.updated_at)}</span></div><div className="map-disclaimer"><AlertTriangle size={15} /><span>Risk markers are illustrative points only. This prototype does not calculate water depth or inundation extent, and does not replace official warnings.</span></div></section>}

        {page === 'forecast' && data && <><div className="forecast-info-grid"><div className="card forecast-main"><div className="card-head"><div><h2>Precipitation outlook</h2><p>{data.forecast.period} · {data.forecast.source}</p></div><span className="unit-chip">mm / hour</span></div><RainChart data={data.forecast} /><div className="chart-explainer"><span className="chart-key" />{mode === 'demo' ? 'Synthetic demonstration values' : 'Forecast model precipitation'}<span className="chart-separator" />Hourly intervals</div></div><div className="card forecast-side"><div className="card-head"><div><h2>Risk over time</h2><p>Only shown when model inputs support it</p></div></div><div className={`risk-large ${riskClass(risk?.category)}`}><div className="risk-ring"><ShieldCheck size={23} /></div><b>{risk?.category}</b><span>{mode === 'demo' ? 'Illustrative baseline category' : 'Not estimated for live weather'}</span></div><div className="forecast-split"><div><small>RECENT 3 H</small><b>{fmt(selectedRain?.['3h'])}</b></div><div><small>NEXT 6 H</small><b>{mode === 'demo' && activeSite ? fmt(activeSite.forecast_6h) : fmt(data.forecast.precipitation.slice(0, 6).reduce((a, b) => a + (b || 0), 0))}</b></div></div><p className="small-note">{data.forecast.note}</p></div></div><div className="info-callout"><CloudRain size={18} /><div><b>Rainfall and flood risk are separate outputs</b><p>Heavy rain can increase concern, but flood occurrence also depends on terrain, drainage, river levels and other local conditions. Missing inputs are reported rather than guessed.</p></div></div></>}

        {page === 'alerts' && data && <div className="alert-page-grid"><div className="card alerts-list-card"><div className="card-head"><div><h2>Current alerts</h2><p>Created from combined risk scenarios, not rainfall thresholds alone</p></div><span className="count-chip">{data.alerts.filter((a: any) => !resolved.includes(a.id)).length} active</span></div>{data.alerts.length ? data.alerts.map((alert: any) => <article className={`alert-row ${resolved.includes(alert.id) ? 'resolved' : ''}`} key={alert.id}><div className="alert-row-icon"><AlertTriangle size={18} /></div><div className="alert-row-content"><div className="alert-row-top"><b>{alert.location}</b><span className={`severity-pill ${riskClass(alert.severity)}`}>{alert.severity}</span></div><p>{alert.precautions}</p><div className="alert-details"><span><Clock3 size={13} />{alert.window}</span><span><Droplets size={13} />{alert.rainfall}</span><span><ShieldCheck size={13} />{alert.risk}</span></div><small>Updated {localTime(alert.updated_at)} · {alert.source}</small></div>{operator && <button className="outline-button ack-button" onClick={() => setResolved(prev => prev.includes(alert.id) ? prev.filter(id => id !== alert.id) : [...prev, alert.id])}>{resolved.includes(alert.id) ? 'Reopen' : 'Acknowledge'}</button>}</article>) : <div className="empty-state"><ShieldCheck size={30} /><b>No active alerts for this location</b><p>No live flood-risk model is connected; absence of an alert is not a guarantee of safety. Check official local channels.</p></div>}</div><div className="card operator-card"><div className="card-head"><div><h2>Operator demo</h2><p>Local-only acknowledgement controls</p></div><Activity size={18} className="muted-icon" /></div><div className="operator-toggle"><div><b>Enable demo operator view</b><span>No authentication; do not use for operational decisions.</span></div><button role="switch" aria-checked={operator} className={`switch ${operator ? 'on' : ''}`} onClick={() => setOperator(!operator)}><i /></button></div><div className="operator-note"><AlertTriangle size={15} />This toggle is a UI demonstration, not a secure operator login.</div><div className="safety-card"><b>Public safety</b><p>During flooding, avoid walking or driving through floodwater. Follow instructions from official emergency services and local authorities.</p><a href="https://ndma.gov.in/" target="_blank" rel="noreferrer">Visit NDMA <ExternalLink size={13} /></a></div></div></div>}

        {page === 'history' && <div className="card empty-history"><div className="history-icon"><History size={24} /></div><h2>Historical evaluation data is not connected</h2><p>This prototype does not have a verified historical flood archive or labelled prediction dataset. Historical events, MAE/RMSE, precision, recall and F1 scores are therefore not displayed.</p><div className="empty-divider" /><div className="history-checks"><span><Check size={14} />No invented accuracy metrics</span><span><Check size={14} />No unsupported event records</span><span><Check size={14} />Ready for a validated dataset later</span></div></div>}

        {page === 'status' && <StatusPage />}
        <footer className="page-footer"><span>RainWatch prototype · SIH PS 26071</span><span>For demonstration only · use official local warnings for safety decisions</span></footer>
      </div>
    </main>
  </div>;
}

function Metric({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string; note: string; tone: string }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div className="metric-content"><span>{label}</span><strong className={tone === 'unknown' ? 'metric-unknown' : ''}>{value}</strong><small>{note}</small></div></div>;
}

function StatusPage() {
  const [status, setStatus] = useState<any>(null);
  const [problem, setProblem] = useState('');
  useEffect(() => { fetch('/api/data-status').then(r => r.json()).then(setStatus).catch(() => setProblem('Backend data-status endpoint is unavailable.')); }, []);
  return <div className="status-grid"><div className="card status-card"><div className="card-head"><div><h2>Provider health</h2><p>Connection state and data provenance</p></div><Database size={18} className="muted-icon" /></div>{problem && <div className="error-banner">{problem}</div>}{status?.providers?.map((provider: any) => <div className="provider-row" key={provider.name}><span className={`provider-state ${provider.state === 'available' ? 'good' : provider.state === 'optional' ? 'optional' : 'off'}`} /><div className="provider-info"><b>{provider.name}</b><span>{provider.type}</span><small>{provider.freshness}</small></div><span className={`state-label ${provider.state.replaceAll(' ', '-')}`}>{provider.state}</span></div>)}</div><div className="card status-card"><div className="card-head"><div><h2>Processing status</h2><p>When this prototype last processed data</p></div><Activity size={18} className="muted-icon" /></div><div className="status-kv"><span>Last status check</span><b>{localTime(status?.checked_at)}</b></div><div className="status-kv"><span>Last successful prediction</span><b>{status?.last_prediction ?? 'Not available'}</b></div><div className="status-kv"><span>Processing errors</span><b>{status?.processing_errors?.length ?? '—'}</b></div><div className="status-note"><AlertTriangle size={15} /><span>The baseline risk score in demo mode is synthetic. Live-weather mode currently returns Unknown risk.</span></div><div className="operator-note source-note"><ExternalLink size={14} />Public source inventory and access notes are in the project README.</div></div></div>;
}
