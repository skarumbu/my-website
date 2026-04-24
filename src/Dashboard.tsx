import React, { useState, useEffect } from 'react';
import NavBar from './components/nav-bar.tsx';
import './styling/dashboard.css';
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { dashboardApiRequest } from "./authConfig.js";

const BASE_URL = process.env.REACT_APP_DASHBOARD_API_BASE_URL;
const DASHBOARD_URL = BASE_URL ? `${BASE_URL}/api/DashboardGetter` : null;
const DISCOVER_URL = BASE_URL ? `${BASE_URL}/api/discover` : null;
const APPS_URL = BASE_URL ? `${BASE_URL}/api/apps` : null;

interface HealthStatus {
  status: 'up' | 'down' | 'unknown';
  latency_ms?: number;
  cold_start?: boolean;
  error?: string;
}

interface MetricRow {
  endpoint: string;
  requests_24h: number;
  avg_latency_ms: number;
  errors_24h: number;
}

interface ErrorRow {
  timestamp: string;
  service: string;
  endpoint: string;
  message: string;
}

interface CostRow {
  service: string;
  cost: number;
}

interface DashboardData {
  health: Record<string, HealthStatus>;
  metrics: Record<string, MetricRow[]>;
  errors: ErrorRow[];
  cost: { currency: string; month_to_date: number; by_service: CostRow[]; error?: string };
  generated_at: string;
  note?: string;
}

interface DiscoveredResource {
  id: string;
  name: string;
  type: string;
  location: string;
  resource_group: string;
  subscription_id: string;
  already_registered: boolean;
}

interface RegisterForm {
  name: string;
  type: string;
  health_url: string;
  log_workspace_id: string;
}

const TYPE_FROM_AZURE: Record<string, string> = {
  'microsoft.web/sites': 'FunctionApp',
  'microsoft.app/containerapps': 'ContainerApp',
  'microsoft.apimanagement/service': 'APIM',
  'microsoft.web/staticsites': 'StaticWebApp',
  'microsoft.app/jobs': 'ContainerAppJob',
};

const VALID_TYPES = ['ContainerApp', 'FunctionApp', 'APIM', 'StaticWebApp', 'ContainerAppJob', 'custom'];

const SERVICE_NAMES: Record<string, string> = {
  'digits': 'Digits',
  'momentum-finder': 'Momentum Finder',
  'trail-finder': 'Trail Finder',
};

function StatusPill({ health }: { health: HealthStatus }) {
  const cls = health.cold_start ? 'cold' : health.status === 'up' ? 'up' : 'down';
  const label = health.cold_start ? 'Cold Start' : health.status === 'up' ? 'Up' : 'Down';
  return <span className={`dash-status-pill ${cls}`}>{label}</span>;
}

function Dashboard() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [discoverData, setDiscoverData] = useState<DiscoveredResource[] | null>(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [registerForm, setRegisterForm] = useState<RegisterForm>({ name: '', type: '', health_url: '', log_workspace_id: '' });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const getToken = async (): Promise<string> => {
    const response = await instance
      .acquireTokenSilent({ ...dashboardApiRequest, account: accounts[0] })
      .catch(() => instance.acquireTokenRedirect(dashboardApiRequest));
    return response.accessToken;
  };

  const fetchData = async () => {
    if (!DASHBOARD_URL) {
      setError('REACT_APP_DASHBOARD_API_BASE_URL is not configured');
      setLoading(false);
      return;
    }
    try {
      const token = await getToken();
      const resp = await fetch(DASHBOARD_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
      const json = await resp.json();
      setData(json);
      setLastUpdated(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscover = async () => {
    if (!DISCOVER_URL) return;
    setDiscoverLoading(true);
    setDiscoverError(null);
    try {
      const token = await getToken();
      const resp = await fetch(DISCOVER_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail ?? body.error ?? `${resp.status} ${resp.statusText}`);
      }
      const json = await resp.json();
      setDiscoverData(json.resources);
    } catch (e: any) {
      setDiscoverError(e.message);
    } finally {
      setDiscoverLoading(false);
    }
  };

  const openRegisterForm = (resource: DiscoveredResource) => {
    setRegisteringId(resource.id);
    setRegisterForm({
      name: resource.name,
      type: TYPE_FROM_AZURE[resource.type] ?? 'custom',
      health_url: '',
      log_workspace_id: '',
    });
    setRegisterError(null);
  };

  const submitRegister = async () => {
    if (!APPS_URL || !registeringId) return;
    setRegisterLoading(true);
    setRegisterError(null);
    try {
      const token = await getToken();
      const resource = discoverData?.find(r => r.id === registeringId);
      const body = {
        resource_id: registeringId,
        name: registerForm.name,
        type: registerForm.type,
        health_url: registerForm.health_url,
        log_workspace_id: registerForm.log_workspace_id,
      };
      const resp = await fetch(APPS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error ?? `${resp.status}`);
      }
      setRegisteringId(null);
      setDiscoverData(prev => prev?.map(r => r.id === registeringId ? { ...r, already_registered: true } : r) ?? null);
      fetchData();
    } catch (e: any) {
      setRegisterError(e.message);
    } finally {
      setRegisterLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="main dash-page">
        <header className="Main-text"><NavBar /></header>
        <div className="dash-content" style={{ textAlign: 'center', paddingTop: '4rem' }}>
          <h1 className="dash-title">Operations Dashboard</h1>
          <p className="dash-subtitle">Sign in with your Microsoft account to continue</p>
          <button
            className="dash-login-btn"
            onClick={() => instance.loginRedirect(dashboardApiRequest)}
          >
            Sign in with Microsoft
          </button>
        </div>
      </div>
    );
  }

  const unregistered = discoverData?.filter(r => !r.already_registered) ?? [];
  const registered = discoverData?.filter(r => r.already_registered) ?? [];

  return (
    <div className="main dash-page">
      <header className="Main-text">
        <NavBar />
      </header>
      <div className="dash-content">
        <h1 className="dash-title">Operations Dashboard</h1>
        <p className="dash-subtitle">Internal · refreshes every 60s</p>

        {lastUpdated && (
          <p className="dash-last-updated">Last updated: {lastUpdated.toLocaleTimeString()}</p>
        )}

        {loading && <p className="dash-note">Loading...</p>}
        {error && <p className="dash-note" style={{color: '#f85149'}}>Error: {error}</p>}

        {data && (
          <>
            {/* Health */}
            <div className="dash-section">
              <h2>Health</h2>
              <div className="dash-service-grid">
                {Object.entries(data.health).map(([svc, h]) => (
                  <div key={svc} className="dash-health-card">
                    <span className="dash-service-name">{SERVICE_NAMES[svc] ?? svc}</span>
                    <StatusPill health={h} />
                    {h.latency_ms !== undefined && (
                      <span className="dash-latency">{h.latency_ms}ms</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Metrics */}
            <div className="dash-section">
              <h2>Request Volume & Latency (24h)</h2>
              {data.note && <p className="dash-note">{data.note}</p>}
              {Object.entries(data.metrics).map(([svc, rows]) => (
                <div key={svc}>
                  <h3>{SERVICE_NAMES[svc] ?? svc}</h3>
                  {rows.length === 0 ? (
                    <p className="dash-note">No data yet</p>
                  ) : (
                    <table className="dash-table">
                      <thead>
                        <tr><th>Endpoint</th><th>Requests</th><th>Avg Latency</th><th>Errors</th></tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i}>
                            <td>{r.endpoint}</td>
                            <td>{r.requests_24h}</td>
                            <td>{r.avg_latency_ms}ms</td>
                            <td style={{color: r.errors_24h > 0 ? '#f85149' : 'inherit'}}>{r.errors_24h}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>

            {/* Errors */}
            <div className="dash-section">
              <h2>Recent Errors (24h)</h2>
              {data.errors.length === 0 ? (
                <p className="dash-note">No errors in the last 24 hours</p>
              ) : (
                <ul className="dash-error-list">
                  {data.errors.map((e, i) => (
                    <li key={i} className="dash-error-item">
                      <span className="dash-error-time">{new Date(e.timestamp).toLocaleString()}</span>
                      <span className={`dash-service-badge dash-service-badge--${e.service}`}>{SERVICE_NAMES[e.service] ?? e.service}</span>
                      <span className="dash-error-endpoint">{e.endpoint}</span>
                      <span className="dash-error-message">{e.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Cost */}
            <div className="dash-section">
              <h2>Cost (Month to Date)</h2>
              {'error' in data.cost ? (
                <p className="dash-note">{data.cost.error}</p>
              ) : (
                <>
                  <p className="dash-cost-total">{data.cost.currency} {data.cost.month_to_date.toFixed(2)}</p>
                  <table className="dash-table">
                    <thead><tr><th>Azure Service</th><th>Cost</th></tr></thead>
                    <tbody>
                      {data.cost.by_service.map((r, i) => (
                        <tr key={i}><td>{r.service}</td><td>{data.cost.currency} {r.cost.toFixed(4)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </>
        )}

        {/* Register Services */}
        <div className="dash-section">
          <h2>Register Services</h2>
          {!discoverData && (
            <button className="dash-action-btn" onClick={fetchDiscover} disabled={discoverLoading}>
              {discoverLoading ? 'Discovering...' : 'Discover Azure Resources'}
            </button>
          )}
          {discoverError && <p className="dash-note" style={{color: '#f85149'}}>Error: {discoverError}</p>}

          {discoverData && (
            <>
              <button className="dash-action-btn dash-action-btn--secondary" onClick={fetchDiscover} disabled={discoverLoading}>
                {discoverLoading ? 'Refreshing...' : 'Refresh'}
              </button>

              {unregistered.length === 0 && (
                <p className="dash-note" style={{ marginTop: '1rem' }}>All discovered resources are already registered.</p>
              )}

              {unregistered.length > 0 && (
                <div className="dash-resource-list">
                  <p className="dash-note" style={{ marginBottom: '0.75rem' }}>
                    {unregistered.length} resource{unregistered.length !== 1 ? 's' : ''} available to register:
                  </p>
                  {unregistered.map(resource => (
                    <div key={resource.id} className="dash-resource-item">
                      <div className="dash-resource-header">
                        <div className="dash-resource-meta">
                          <span className="dash-resource-name">{resource.name}</span>
                          <span className="dash-tag">{TYPE_FROM_AZURE[resource.type] ?? resource.type}</span>
                          <span className="dash-tag dash-tag--muted">{resource.resource_group}</span>
                        </div>
                        {registeringId === resource.id ? (
                          <button className="dash-action-btn dash-action-btn--ghost" onClick={() => setRegisteringId(null)}>
                            Cancel
                          </button>
                        ) : (
                          <button className="dash-action-btn" onClick={() => openRegisterForm(resource)}>
                            Register
                          </button>
                        )}
                      </div>

                      {registeringId === resource.id && (
                        <div className="dash-register-form">
                          <div className="dash-form-row">
                            <label className="dash-form-label">Name</label>
                            <input
                              className="dash-input"
                              value={registerForm.name}
                              onChange={e => setRegisterForm(f => ({ ...f, name: e.target.value }))}
                            />
                          </div>
                          <div className="dash-form-row">
                            <label className="dash-form-label">Type</label>
                            <select
                              className="dash-input"
                              value={registerForm.type}
                              onChange={e => setRegisterForm(f => ({ ...f, type: e.target.value }))}
                            >
                              {VALID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div className="dash-form-row">
                            <label className="dash-form-label">Health URL <span className="dash-form-optional">(optional)</span></label>
                            <input
                              className="dash-input"
                              placeholder="https://my-api.example.com"
                              value={registerForm.health_url}
                              onChange={e => setRegisterForm(f => ({ ...f, health_url: e.target.value }))}
                            />
                          </div>
                          <div className="dash-form-row">
                            <label className="dash-form-label">Log Workspace ID <span className="dash-form-optional">(optional)</span></label>
                            <input
                              className="dash-input"
                              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                              value={registerForm.log_workspace_id}
                              onChange={e => setRegisterForm(f => ({ ...f, log_workspace_id: e.target.value }))}
                            />
                          </div>
                          {registerError && <p className="dash-note" style={{ color: '#f85149' }}>{registerError}</p>}
                          <button className="dash-action-btn" onClick={submitRegister} disabled={registerLoading || !registerForm.name || !registerForm.type}>
                            {registerLoading ? 'Registering...' : 'Confirm Registration'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {registered.length > 0 && (
                <details className="dash-already-registered">
                  <summary className="dash-note" style={{ cursor: 'pointer' }}>
                    {registered.length} already registered
                  </summary>
                  <div className="dash-resource-list" style={{ marginTop: '0.5rem' }}>
                    {registered.map(resource => (
                      <div key={resource.id} className="dash-resource-item dash-resource-item--registered">
                        <span className="dash-resource-name">{resource.name}</span>
                        <span className="dash-tag">{TYPE_FROM_AZURE[resource.type] ?? resource.type}</span>
                        <span className="dash-status-pill up" style={{ fontSize: '0.65rem' }}>Registered</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
