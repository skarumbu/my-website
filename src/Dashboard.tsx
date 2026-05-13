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
  last_run?: string;
  last_run_status?: string;
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

interface GitHubRun {
  repo: string;
  run_id: number;
  workflow_name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  branch: string;
  created_at: string;
  html_url: string;
  failed_jobs?: string[];
}

interface DashboardData {
  health: Record<string, HealthStatus>;
  metrics: Record<string, MetricRow[]>;
  errors: ErrorRow[];
  cost: { currency: string; month_to_date: number; by_service: CostRow[]; error?: string };
  github_actions?: Record<string, GitHubRun>;
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
  health_url: string;
  log_workspace_id: string;
  already_registered: boolean;
}

interface RegisterForm {
  name: string;
  type: string;
  health_url: string;
  log_workspace_id: string;
  github_repo: string;
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

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}

function fmt(n: number): string { return n.toLocaleString(); }

function hClass(h: HealthStatus): string {
  if (h.status === 'down') return 'dn';
  if (h.cold_start) return 'cold';
  if (h.status === 'up') return 'up';
  return 'unk';
}


function Dashboard() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [regOpen, setRegOpen] = useState(false);

  const [discoverData, setDiscoverData] = useState<DiscoveredResource[] | null>(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [registerForm, setRegisterForm] = useState<RegisterForm>({ name: '', type: '', health_url: '', log_workspace_id: '', github_repo: '' });
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [editingApp, setEditingApp] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ github_repo: string; health_url: string; log_workspace_id: string; type: string }>({ github_repo: '', health_url: '', log_workspace_id: '', type: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
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
      health_url: resource.health_url ?? '',
      log_workspace_id: resource.log_workspace_id ?? '',
      github_repo: '',
    });
    setRegisterError(null);
  };

  const submitRegister = async () => {
    if (!APPS_URL || !registeringId) return;
    setRegisterLoading(true);
    setRegisterError(null);
    try {
      const token = await getToken();
      const body: Record<string, string> = {
        resource_id: registeringId,
        name: registerForm.name,
        type: registerForm.type,
        health_url: registerForm.health_url,
        log_workspace_id: registerForm.log_workspace_id,
      };
      if (registerForm.github_repo.trim()) body.github_repo = registerForm.github_repo.trim();
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

  const openEditApp = async (name: string) => {
    setEditingApp(name);
    setEditError(null);
    setEditForm({ github_repo: '', health_url: '', log_workspace_id: '', type: '' });
    if (!APPS_URL) return;
    setEditLoading(true);
    try {
      const token = await getToken();
      const resp = await fetch(APPS_URL, { headers: { Authorization: `Bearer ${token}` } });
      if (resp.ok) {
        const json = await resp.json();
        const app = (json.apps ?? []).find((a: any) => a.name === name);
        if (app) {
          setEditingApp(app.name);
          setEditForm({ github_repo: app.github_repo ?? '', health_url: app.health_url ?? '', log_workspace_id: app.log_workspace_id ?? '', type: app.type ?? '' });
        }
      }
    } catch {} finally {
      setEditLoading(false);
    }
  };

  const saveEditApp = async () => {
    if (!APPS_URL || !editingApp) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const token = await getToken();
      const resp = await fetch(`${APPS_URL}/${editingApp}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error ?? `${resp.status}`);
      }
      setEditingApp(null);
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditSaving(false);
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
        <main className="dash-content dash-login-view">
          <p className="dash-slabel">Operations Dashboard</p>
          <h1 className="dash-login-heading">API Ops</h1>
          <p className="dash-login-sub">Sign in with your Microsoft account to continue</p>
          <button className="dash-login-btn" onClick={() => instance.loginRedirect(dashboardApiRequest)}>
            Sign in with Microsoft →
          </button>
        </main>
      </div>
    );
  }

  const hasDown = data ? Object.values(data.health).some(h => h.status === 'down') : false;
  const hasCold = data ? Object.values(data.health).some(h => h.cold_start) : false;
  const allStatusCls = hasDown ? 'sys-dn' : hasCold ? 'sys-cold' : 'sys-up';
  const allStatusText = hasDown ? 'Incident detected' : hasCold ? 'Cold start detected' : 'All systems operational';

  const unregistered = discoverData?.filter(r => !r.already_registered) ?? [];
  const registered   = discoverData?.filter(r => r.already_registered) ?? [];

  return (
    <div className="main dash-page">
      <header className="Main-text"><NavBar /></header>

      <div className="dash-infobar">
        <span className="dash-infobar-ts">
          {lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
            : '—'}
        </span>
        <div className="dash-infobar-right">
          {data && <span className={`dash-allstatus ${allStatusCls}`}>{allStatusText}</span>}
          <button className="dash-hdr-btn" onClick={fetchData} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <main className="dash-content">
        {error && <div className="dash-error-banner">Error: {error}</div>}
        {loading && !data && <div className="dash-loader">Loading…</div>}

        {data && (
          <>
            {/* Health */}
            <p className="dash-slabel">Health</p>
            <div className="dash-health-row">
              {Object.entries(data.health).map(([svc, h]) => {
                const cls = hClass(h);
                const isJob = h.last_run !== undefined;
                const isExpanded = expandedCard === svc;
                const gh = data.github_actions?.[svc];
                const svcMetrics = data.metrics[svc] ?? [];
                const svcErrors = data.errors.filter(e => e.service === svc);

                const ghConclusion = gh?.status !== 'completed' ? gh?.status ?? null : gh.conclusion;
                const ghChipCls = ghConclusion === 'success' ? 'success'
                  : ghConclusion === 'failure' ? 'failure'
                  : (ghConclusion === 'in_progress' || ghConclusion === 'queued') ? 'running'
                  : 'muted';
                const ghChipLabel = ghConclusion === 'success' ? '✓'
                  : ghConclusion === 'failure' ? '✗'
                  : ghConclusion === 'in_progress' ? '⟳'
                  : ghConclusion === 'queued' ? '…' : '?';

                return (
                  <div
                    key={svc}
                    className={`dash-hcard ${cls}${isExpanded ? ' expanded' : ''}`}
                    onClick={() => setExpandedCard(e => e === svc ? null : svc)}
                  >
                    <div className="dash-hcard-top">
                      <span className="dash-hcard-name">{SERVICE_NAMES[svc] ?? svc}</span>
                      <span className="dash-hcard-chevron">{isExpanded ? '▾' : '▸'}</span>
                    </div>
                    {h.latency_ms !== undefined && (
                      <div className="dash-hcard-latency">
                        <span className="dash-hcard-num">
                          {h.latency_ms >= 1000 ? (h.latency_ms / 1000).toFixed(1) : h.latency_ms}
                        </span>
                        <span className="dash-hcard-unit">{h.latency_ms >= 1000 ? 's' : 'ms'}</span>
                      </div>
                    )}
                    <div className="dash-hcard-meta">
                      <span className={`dash-type-tag ${isJob ? 'job' : 'api'}`}>{isJob ? 'JOB' : 'API'}</span>
                      {isJob && h.last_run && (
                        <span className="dash-hcard-meta-text">{h.last_run_status ?? 'Unknown'} · {relTime(h.last_run)}</span>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="dash-hcard-detail" onClick={e => e.stopPropagation()}>
                        {gh && (
                          <div className="dash-hcard-detail-section">
                            <h4>GitHub Actions</h4>
                            <div className="dash-gh-run">
                              <span className={`dash-gh-chip ${ghChipCls}`}>{ghChipLabel}</span>
                              <span>{gh.workflow_name}</span>
                              <span className="dash-muted">· {gh.branch} · {relTime(gh.created_at)}</span>
                              <a href={gh.html_url} target="_blank" rel="noopener noreferrer" className="dash-gh-link">↗</a>
                            </div>
                            {gh.failed_jobs && gh.failed_jobs.length > 0 && (
                              <div className="dash-gh-failed-jobs">Failed: {gh.failed_jobs.join(', ')}</div>
                            )}
                          </div>
                        )}

                        {svcMetrics.length > 0 && (
                          <div className="dash-hcard-detail-section">
                            <h4>Request metrics — 24h</h4>
                            <div className="dash-hcard-metrics">
                              {svcMetrics.map((r, i) => (
                                <div key={i} className="dash-hcard-metric-row">
                                  <span className="dash-mono dash-hcard-metric-ep">{r.endpoint}</span>
                                  <span className="dash-hcard-metric-stats">
                                    {fmt(r.requests_24h)} req · {r.avg_latency_ms}ms avg ·{' '}
                                    <span className={r.errors_24h > 0 ? 'dash-err-pos' : 'dash-zero'}>{r.errors_24h} err</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {svcErrors.length > 0 && (
                          <div className="dash-hcard-detail-section">
                            <h4>Recent errors</h4>
                            <div className="dash-hcard-errors">
                              {svcErrors.slice(0, 5).map((e, i) => (
                                <div key={i} className="dash-hcard-error-row">
                                  <span className="dash-eitem-time">{relTime(e.timestamp)}</span>
                                  <span className="dash-mono dash-muted">{e.endpoint}</span>
                                  <span className="dash-eitem-msg">{e.message}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {!gh && svcMetrics.length === 0 && svcErrors.length === 0 && (
                          <p className="dash-muted" style={{ fontSize: '0.8rem', margin: 0 }}>No additional data available.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Errors + Cost */}
            <div className="dash-two-col">
              <div>
                <p className="dash-slabel">Recent errors</p>
                {data.errors.length === 0 ? (
                  <div className="dash-empty-state">No errors in the last 24 hours</div>
                ) : (
                  <div className="dash-elist">
                    {data.errors.map((e, i) => (
                      <div key={i} className="dash-eitem">
                        <span className="dash-eitem-time">{relTime(e.timestamp)}</span>
                        <span className="dash-ebadge">{SERVICE_NAMES[e.service] ?? e.service}</span>
                        <div className="dash-eitem-info">
                          <div className="dash-eitem-ep">{e.endpoint}</div>
                          <div className="dash-eitem-msg">{e.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="dash-slabel">Azure cost</p>
                {data.cost.error ? (
                  <div className="dash-cost-card">
                    <p className="dash-note" style={{ padding: '20px' }}>{data.cost.error}</p>
                  </div>
                ) : (
                  <div className="dash-cost-card">
                    <div className="dash-cost-hero">
                      <div className="dash-cost-lbl">Month to date</div>
                      <div className="dash-cost-val">
                        <span className="dash-cost-curr">{data.cost.currency}</span>
                        <span className="dash-cost-num">{data.cost.month_to_date.toFixed(2)}</span>
                      </div>
                      <div className="dash-cost-period">
                        {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                    <table>
                      <thead><tr><th>Service</th><th>Cost</th></tr></thead>
                      <tbody>
                        {data.cost.by_service.map((r, i) => (
                          <tr key={i}>
                            <td>{r.service}</td>
                            <td className="dash-mono">{r.cost.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Register panel */}
        <div className={`dash-reg-panel${regOpen ? ' open' : ''}`}>
          <div className="dash-reg-hdr" onClick={() => setRegOpen(o => !o)}>
            <span className="dash-reg-title">Register Azure Resources</span>
            <span className="dash-reg-count">
              {data ? Object.keys(data.health).length : 0} services monitored
            </span>
            <span className="dash-reg-arrow">▾</span>
          </div>
          <div className="dash-reg-body">
            {!discoverData && (
              <button className="dash-action-btn" onClick={fetchDiscover} disabled={discoverLoading}>
                {discoverLoading ? 'Discovering…' : 'Discover Resources'}
              </button>
            )}
            {!discoverData && (
              <p className="dash-reg-note">
                Scans your Azure subscription for Function Apps, Container Apps, and APIM services not yet registered with this dashboard.
              </p>
            )}
            {discoverError && <p className="dash-note" style={{ color: 'var(--dn)', marginTop: 8 }}>Error: {discoverError}</p>}

            {discoverData && (
              <>
                <button className="dash-action-btn--secondary dash-action-btn" onClick={fetchDiscover} disabled={discoverLoading}>
                  {discoverLoading ? 'Refreshing…' : 'Refresh'}
                </button>

                {unregistered.length === 0 && (
                  <p className="dash-note" style={{ marginTop: 12 }}>All discovered resources are already registered.</p>
                )}

                {unregistered.length > 0 && (
                  <div className="dash-resource-list">
                    <p className="dash-note">{unregistered.length} resource{unregistered.length !== 1 ? 's' : ''} available to register:</p>
                    {unregistered.map(resource => (
                      <div key={resource.id} className="dash-resource-item">
                        <div className="dash-resource-header">
                          <div className="dash-resource-meta">
                            <span className="dash-resource-name">{resource.name}</span>
                            <span className="dash-tag">{TYPE_FROM_AZURE[resource.type] ?? resource.type}</span>
                            <span className="dash-tag dash-tag--muted">{resource.resource_group}</span>
                          </div>
                          {registeringId === resource.id ? (
                            <button className="dash-action-btn dash-action-btn--ghost" onClick={() => setRegisteringId(null)}>Cancel</button>
                          ) : (
                            <button className="dash-action-btn" onClick={() => openRegisterForm(resource)}>Register</button>
                          )}
                        </div>

                        {registeringId === resource.id && (
                          <div className="dash-register-form">
                            <div className="dash-form-row">
                              <label className="dash-form-label">Name</label>
                              <input className="dash-input" value={registerForm.name}
                                onChange={e => setRegisterForm(f => ({ ...f, name: e.target.value }))} />
                            </div>
                            <div className="dash-form-row">
                              <label className="dash-form-label">Type</label>
                              <select className="dash-input" value={registerForm.type}
                                onChange={e => setRegisterForm(f => ({ ...f, type: e.target.value }))}>
                                {VALID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                            <div className="dash-form-row">
                              <label className="dash-form-label">Health URL <span className="dash-form-optional">(optional)</span></label>
                              <input className="dash-input" placeholder="https://my-api.example.com"
                                value={registerForm.health_url}
                                onChange={e => setRegisterForm(f => ({ ...f, health_url: e.target.value }))} />
                            </div>
                            <div className="dash-form-row">
                              <label className="dash-form-label">Log Workspace ID <span className="dash-form-optional">(optional)</span></label>
                              <input className="dash-input" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                value={registerForm.log_workspace_id}
                                onChange={e => setRegisterForm(f => ({ ...f, log_workspace_id: e.target.value }))} />
                            </div>
                            <div className="dash-form-row">
                              <label className="dash-form-label">GitHub Repo <span className="dash-form-optional">(optional)</span></label>
                              <input className="dash-input" placeholder="owner/repo"
                                value={registerForm.github_repo}
                                onChange={e => setRegisterForm(f => ({ ...f, github_repo: e.target.value }))} />
                            </div>
                            {registerError && <p className="dash-note" style={{ color: 'var(--dn)' }}>{registerError}</p>}
                            <button className="dash-action-btn" onClick={submitRegister}
                              disabled={registerLoading || !registerForm.name || !registerForm.type}>
                              {registerLoading ? 'Registering…' : 'Confirm Registration'}
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
                    <div className="dash-resource-list" style={{ marginTop: 8 }}>
                      {registered.map(resource => (
                        <div key={resource.id} className="dash-resource-item">
                          <div className="dash-resource-header">
                            <div className="dash-resource-meta">
                              <span className="dash-resource-name">{resource.name}</span>
                              <span className="dash-tag">{TYPE_FROM_AZURE[resource.type] ?? resource.type}</span>
                              <span className="dash-spill up" style={{ fontSize: '10px' }}>Registered</span>
                            </div>
                            {editingApp === resource.name ? (
                              <button className="dash-action-btn dash-action-btn--ghost" onClick={() => setEditingApp(null)}>Cancel</button>
                            ) : (
                              <button className="dash-action-btn dash-action-btn--secondary" onClick={() => openEditApp(resource.name)}>Edit</button>
                            )}
                          </div>

                          {editingApp === resource.name && (
                            <div className="dash-register-form">
                              {editLoading ? (
                                <p className="dash-note">Loading current values…</p>
                              ) : (
                                <>
                                  <div className="dash-form-row">
                                    <label className="dash-form-label">GitHub Repo</label>
                                    <input className="dash-input" placeholder="owner/repo"
                                      value={editForm.github_repo}
                                      onChange={e => setEditForm(f => ({ ...f, github_repo: e.target.value }))} />
                                  </div>
                                  <div className="dash-form-row">
                                    <label className="dash-form-label">Health URL</label>
                                    <input className="dash-input" placeholder="https://my-api.example.com"
                                      value={editForm.health_url}
                                      onChange={e => setEditForm(f => ({ ...f, health_url: e.target.value }))} />
                                  </div>
                                  <div className="dash-form-row">
                                    <label className="dash-form-label">Log Workspace ID</label>
                                    <input className="dash-input" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                      value={editForm.log_workspace_id}
                                      onChange={e => setEditForm(f => ({ ...f, log_workspace_id: e.target.value }))} />
                                  </div>
                                  <div className="dash-form-row">
                                    <label className="dash-form-label">Type</label>
                                    <select className="dash-input" value={editForm.type}
                                      onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>
                                      {VALID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                  </div>
                                  {editError && <p className="dash-note" style={{ color: 'var(--dn)' }}>{editError}</p>}
                                  <button className="dash-action-btn" onClick={saveEditApp} disabled={editSaving}>
                                    {editSaving ? 'Saving…' : 'Save changes'}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
