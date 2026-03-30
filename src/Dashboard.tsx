import React, { useState, useEffect } from 'react';
import NavBar from './components/nav-bar.tsx';
import './styling/dashboard.css';

const DASHBOARD_URL = process.env.REACT_APP_DASHBOARD_API_BASE_URL
  ? `${process.env.REACT_APP_DASHBOARD_API_BASE_URL}/api/DashboardGetter`
  : null;

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
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    if (!DASHBOARD_URL) {
      setError('REACT_APP_DASHBOARD_API_BASE_URL is not configured');
      setLoading(false);
      return;
    }
    try {
      const resp = await fetch(DASHBOARD_URL);
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

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, []);

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
      </div>
    </div>
  );
}

export default Dashboard;
