import React from 'react';
import NavBar from './components/nav-bar.tsx';
import './styling/architecture.css';
import metadata from './architecture-metadata.json';

type ServiceMeta = { lastDeploy: string | null; commitSha: string | null };
const meta = metadata as Record<string, ServiceMeta>;

function deployLabel(key: string) {
  const m = meta[key];
  if (!m?.lastDeploy) return null;
  return `${m.lastDeploy} · ${m.commitSha}`;
}

const Architecture: React.FC = () => {
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="arch-page">
      <NavBar />
      <div className="arch-content">

        {/* ── Header ── */}
        <h1 className="arch-title">System Architecture</h1>
        <p className="arch-subtitle">Internal reference · Not linked from navigation</p>

        {/* ── TOC ── */}
        <div className="arch-card">
          <strong>Contents</strong>
          <ol className="arch-toc">
            <li><a href="#overview">Overview</a></li>
            <li><a href="#diagram">System Diagram</a></li>
            <li><a href="#packages">Packages</a></li>
            <li><a href="#data-flows">Data Flows</a></li>
            <li><a href="#cicd">CI/CD &amp; Deployment</a></li>
          </ol>
        </div>

        {/* ── 1. Overview ── */}
        <section className="arch-section" id="overview">
          <h2>1. Overview</h2>
          <p>
            The system is made up of six packages. The frontend is a React SPA hosted on
            Azure Static Web Apps. It talks to four backend services — two Azure Functions
            apps and two Azure Container Apps. A separate infrastructure package defines
            all cloud resources.
          </p>
          <table className="arch-table">
            <thead>
              <tr><th>Package</th><th>Role</th><th>Runs on</th><th>Last Deploy</th></tr>
            </thead>
            <tbody>
              {[
                ['my-website',           'React SPA — the user-facing frontend',                          'Azure Static Web Apps', null],
                ['digits',               'Generates and serves Digits puzzles',                           'Azure Functions',       'digits'],
                ['momentum-finder',      'Identifies momentum shifts in live NBA games',                  'Azure Container Apps',  'momentum-finder'],
                ['trail-finder',         'Trail recommendations + conditions via Google Places & AI',     'Azure Container Apps',  'trail-finder'],
                ['dashboard-api',        'Aggregates health, metrics, and cost across all services',      'Azure Functions',       'dashboard-api'],
                ['azure-infrastructure', 'Defines all Azure cloud resources (infra-as-code)',             'Provisioning only',     null],
              ].map(([pkg, role, runs, metaKey]) => (
                <tr key={pkg as string}>
                  <td><code className="arch-inline-code">{pkg}</code></td>
                  <td>{role}</td>
                  <td>{runs}</td>
                  <td style={{ fontSize: '0.78rem', color: '#8b949e', whiteSpace: 'nowrap' }}>
                    {metaKey ? (deployLabel(metaKey as string) ?? '—') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ── 2. System Diagram ── */}
        <section className="arch-section" id="diagram">
          <h2>2. System Diagram</h2>

          {/* Top: browser */}
          <div className="arch-flow">
            <div className="arch-flow-box blue" style={{ width: '100%', boxSizing: 'border-box' }}>
              User Browser
            </div>
            <div className="arch-flow-down">↓</div>

            {/* Middle: SPA */}
            <div className="arch-flow-box" style={{ width: '100%', boxSizing: 'border-box', padding: '1rem 1.25rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>
                Azure Static Web Apps — <code style={{ fontWeight: 400 }}>my-website</code>
              </div>
              <div className="arch-route-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                <div className="arch-flow-box blue">
                  <div className="arch-route-path">/</div>
                  <div className="arch-route-label">Landing page</div>
                </div>
                <div className="arch-flow-box green">
                  <div className="arch-route-path">/digits</div>
                  <div className="arch-route-label">Puzzle game</div>
                </div>
                <div className="arch-flow-box orange">
                  <div className="arch-route-path">/momentum-finder</div>
                  <div className="arch-route-label">NBA games view</div>
                </div>
                <div className="arch-flow-box" style={{ borderColor: '#388bfd', color: '#58a6ff' }}>
                  <div className="arch-route-path">/trail-finder</div>
                  <div className="arch-route-label">Trail recommendations</div>
                </div>
                <div className="arch-flow-box purple">
                  <div className="arch-route-path">/dashboard</div>
                  <div className="arch-route-label">Ops dashboard</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-around' }}>
              <div style={{ width: '20%' }} />
              <div className="arch-flow-down">↓</div>
              <div className="arch-flow-down">↓</div>
              <div className="arch-flow-down">↓</div>
              <div style={{ width: '20%' }} />
            </div>

            {/* Bottom: four APIs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', width: '100%' }}>
              <div className="arch-flow-box green" style={{ padding: '0.75rem 1rem', whiteSpace: 'normal' }}>
                <div style={{ fontWeight: 700 }}>digits</div>
                <div style={{ fontSize: '0.72rem', marginTop: '0.2rem', opacity: 0.8 }}>Azure Functions</div>
                <div style={{ fontSize: '0.72rem', marginTop: '0.35rem', color: '#8b949e' }}>
                  Generates and stores Digits puzzles · writes metrics to Table Storage
                </div>
              </div>
              <div className="arch-flow-box orange" style={{ padding: '0.75rem 1rem', whiteSpace: 'normal' }}>
                <div style={{ fontWeight: 700 }}>momentum-finder</div>
                <div style={{ fontSize: '0.72rem', marginTop: '0.2rem', opacity: 0.8 }}>Container App</div>
                <div style={{ fontSize: '0.72rem', marginTop: '0.35rem', color: '#8b949e' }}>
                  Detects NBA momentum shifts · structured JSON logs → Log Analytics
                </div>
              </div>
              <div className="arch-flow-box" style={{ padding: '0.75rem 1rem', whiteSpace: 'normal', borderColor: '#388bfd', color: '#58a6ff' }}>
                <div style={{ fontWeight: 700 }}>trail-finder</div>
                <div style={{ fontSize: '0.72rem', marginTop: '0.2rem', opacity: 0.8 }}>Container App</div>
                <div style={{ fontSize: '0.72rem', marginTop: '0.35rem', color: '#8b949e' }}>
                  Google Places · Open-Meteo weather · Azure OpenAI synthesis · 24h cache
                </div>
              </div>
              <div className="arch-flow-box purple" style={{ padding: '0.75rem 1rem', whiteSpace: 'normal' }}>
                <div style={{ fontWeight: 700 }}>dashboard-api</div>
                <div style={{ fontSize: '0.72rem', marginTop: '0.2rem', opacity: 0.8 }}>Azure Functions</div>
                <div style={{ fontSize: '0.72rem', marginTop: '0.35rem', color: '#8b949e' }}>
                  Aggregates health checks, Log Analytics, Table Storage metrics, and Cost Management
                </div>
              </div>
            </div>
          </div>

          {/* Infrastructure underline */}
          <div className="arch-flow-box purple" style={{ width: '100%', boxSizing: 'border-box', marginTop: '0.5rem', padding: '0.6rem 1rem', whiteSpace: 'normal', textAlign: 'center' }}>
            <span style={{ fontWeight: 700 }}>azure-infrastructure</span>
            <span style={{ fontSize: '0.75rem', marginLeft: '0.75rem', opacity: 0.8 }}>
              Provisions and configures all Azure resources used by the packages above · Bicep · subscription scope
            </span>
          </div>
        </section>

        {/* ── 3. Packages ── */}
        <section className="arch-section" id="packages">
          <h2>3. Packages</h2>

          <h3>my-website — Frontend SPA</h3>
          <p>
            A React (TypeScript) single-page application. Handles all user interaction.
            Deployed to Azure Static Web Apps, which serves the static build and rewrites
            all navigation to <code className="arch-inline-code">index.html</code> so
            client-side routing works on deep links. Autocomplete on the Trail Finder
            search bar is powered by the Google Maps JS SDK running entirely in the browser.
          </p>
          <div className="arch-tech-stack">
            {['React 18', 'TypeScript', 'React Router v6', 'Create React App', 'Azure Static Web Apps', 'Google Maps JS SDK'].map(t =>
              <span key={t} className="arch-tech-item">{t}</span>
            )}
          </div>

          <h3>digits — Puzzle API</h3>
          <p>
            Generates, stores, and serves daily Digits puzzles via Azure Table Storage.
            Each invocation writes a metrics row (duration, status) to a <code className="arch-inline-code">metrics</code> table
            so the dashboard can track request volume. In local development the frontend
            bypasses this API and uses hardcoded stub data instead.
          </p>
          <div className="arch-tech-stack">
            {['Azure Functions v2', 'Python 3.11', 'Azure Table Storage'].map(t =>
              <span key={t} className="arch-tech-item">{t}</span>
            )}
          </div>

          <h3>momentum-finder — NBA Momentum API</h3>
          <p>
            Analyses live NBA game data to surface momentum shifts. Runs as a Container App
            (FastAPI + Uvicorn on port 80, scales 0–10 replicas). Emits structured JSON logs
            on every request that flow into Log Analytics for the dashboard to query.
          </p>
          <div className="arch-tech-stack">
            {['FastAPI', 'Python 3.11', 'Azure Container Apps', 'Log Analytics'].map(t =>
              <span key={t} className="arch-tech-item">{t}</span>
            )}
          </div>

          <h3>trail-finder — Trail Recommendations API</h3>
          <p>
            Given a city, geocodes it, searches Google Places for nearby trails, fetches
            weather from Open-Meteo, pulls AllTrails snippets via Google Custom Search, then
            synthesizes a condition summary and gear list with Azure OpenAI. Results are cached
            in memory for 24 hours. Runs as a Container App with the same logging middleware
            as momentum-finder.
          </p>
          <div className="arch-tech-stack">
            {['FastAPI', 'Python 3.11', 'Azure Container Apps', 'Google Places API', 'Open-Meteo', 'Azure OpenAI', 'Log Analytics'].map(t =>
              <span key={t} className="arch-tech-item">{t}</span>
            )}
          </div>

          <h3>dashboard-api — Ops Dashboard API</h3>
          <p>
            Single aggregator endpoint that fans out in parallel to: health-check
            momentum-finder and trail-finder, query Log Analytics (KQL) for request counts,
            latency, and recent errors, query the Digits metrics Table Storage table, and
            fetch Azure Cost Management MTD spend. Uses a system-assigned managed identity
            with Log Analytics Reader and Cost Management Reader roles — no stored credentials.
          </p>
          <div className="arch-tech-stack">
            {['Azure Functions v2', 'Python 3.11', 'Managed Identity', 'azure-monitor-query', 'Azure Cost Management'].map(t =>
              <span key={t} className="arch-tech-item">{t}</span>
            )}
          </div>

          <h3>azure-infrastructure — Infrastructure as Code</h3>
          <p>
            Defines and provisions all Azure resources at subscription scope using Bicep.
            Modules cover the Static Web App, Container Registry, Container App Environment
            (shared Log Analytics workspace), momentum-finder and trail-finder Container Apps,
            Digits and Dashboard Azure Functions apps, and all RBAC role assignments.
          </p>
          <div className="arch-tech-stack">
            {['Azure Bicep', 'Azure RBAC', 'Managed Identity', 'Container Registry'].map(t =>
              <span key={t} className="arch-tech-item">{t}</span>
            )}
          </div>
        </section>

        {/* ── 4. Data Flows ── */}
        <section className="arch-section" id="data-flows">
          <h2>4. Data Flows</h2>

          <h3>Digits puzzle flow</h3>
          <div className="arch-flow">
            <div className="arch-flow-box blue">User opens /digits</div>
            <div className="arch-flow-down">↓</div>
            <div className="arch-flow-box">
              my-website checks environment
              <small>development → use hardcoded stub data (no API call)</small>
              <small>production → call Digits API</small>
            </div>
            <div className="arch-flow-down">↓  (production only)</div>
            <div className="arch-flow-box green">
              digits API (Azure Functions)
              <small>returns puzzle numbers, target, solutions, difficulty · writes metrics row to Table Storage</small>
            </div>
            <div className="arch-flow-down">↓</div>
            <div className="arch-flow-box blue">
              Puzzles rendered — sorted easy → medium → hard
            </div>
          </div>

          <h3>Momentum Finder flow</h3>
          <div className="arch-flow">
            <div className="arch-flow-box blue">User opens /momentum-finder</div>
            <div className="arch-flow-down">↓</div>
            <div className="arch-flow-box orange">
              momentum-finder API (Container App)
              <small>GET {'{REACT_APP_API_BASE_URL}'}/get-current-games</small>
            </div>
            <div className="arch-flow-down">↓</div>
            <div className="arch-flow-box blue">
              Live game cards displayed
              <small>teams, score, status, momentum indicators</small>
            </div>
          </div>

          <h3>Trail Finder flow</h3>
          <div className="arch-flow">
            <div className="arch-flow-box blue">User types city in /trail-finder</div>
            <div className="arch-flow-down">↓</div>
            <div className="arch-flow-box" style={{ borderColor: '#388bfd', color: '#58a6ff' }}>
              Google Maps JS SDK (browser-side)
              <small>AutocompleteService · no backend round-trip · 300ms debounce</small>
            </div>
            <div className="arch-flow-down">↓  (on search)</div>
            <div className="arch-flow-box" style={{ borderColor: '#388bfd', color: '#58a6ff' }}>
              trail-finder API (Container App)
              <small>geocode → Google Places text search → place details + reviews</small>
              <small>Open-Meteo weekend weather forecast</small>
              <small>Google Custom Search for AllTrails snippets</small>
              <small>Azure OpenAI synthesizes condition summary + gear list</small>
              <small>result cached 24h per location</small>
            </div>
            <div className="arch-flow-down">↓</div>
            <div className="arch-flow-box blue">
              Trail cards displayed — name, rating, conditions, gear list
            </div>
          </div>

          <h3>Dashboard flow</h3>
          <div className="arch-flow">
            <div className="arch-flow-box purple">User opens /dashboard (60s poll)</div>
            <div className="arch-flow-down">↓</div>
            <div className="arch-flow-box purple">
              dashboard-api (Azure Functions) — parallel fan-out
              <small>Health checks → momentum-finder /health, trail-finder /health</small>
              <small>Log Analytics KQL → request counts, avg latency, errors per service (24h)</small>
              <small>Table Storage → digits metrics rows (24h)</small>
              <small>Azure Cost Management → MTD spend by service (1h cache)</small>
            </div>
            <div className="arch-flow-down">↓</div>
            <div className="arch-flow-box blue">
              Dashboard renders health pills, metrics tables, error log, cost breakdown
            </div>
          </div>
        </section>

        {/* ── 5. CI/CD ── */}
        <section className="arch-section" id="cicd">
          <h2>5. CI/CD &amp; Deployment</h2>
          <p>
            Every package deploys automatically via GitHub Actions. After each backend deploy
            succeeds, the workflow commits updated deploy metadata to <code className="arch-inline-code">my-website</code>,
            triggering a frontend rebuild so this page stays current.
          </p>

          <h3>my-website</h3>
          <div className="arch-pipeline">
            <div className="arch-pipeline-box">{'git push\nmain'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box blue">{'GitHub Actions\ntrigger'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box">{'npm run build'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box orange">{'Azure SWA\ndeploy action'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box green">{'Live on\nAzure SWA'}</div>
          </div>

          <h3>digits &amp; dashboard-api (Azure Functions)</h3>
          <div className="arch-pipeline">
            <div className="arch-pipeline-box">{'git push\nmain/master'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box blue">{'GitHub Actions'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box">{'func publish\n--python'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box green">{'Live on\nAzure Functions'}</div>
          </div>

          <h3>momentum-finder &amp; trail-finder (Container Apps)</h3>
          <div className="arch-pipeline">
            <div className="arch-pipeline-box">{'git push\nmain/master'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box blue">{'GitHub Actions'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box">{'docker build\n& push to ACR'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box orange">{'az containerapp\nupdate'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box green">{'Live on\nContainer Apps'}</div>
          </div>

          <h3>Cross-repo rebuild</h3>
          <div className="arch-pipeline">
            <div className="arch-pipeline-box">{'any backend\nrepo push'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box blue">{'deploy succeeds\n(post-deploy job)'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box orange">{'commit metadata\nto my-website'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box green">{'Architecture page\nauto-updated'}</div>
          </div>

          <ul>
            <li>Pull requests to <code className="arch-inline-code">my-website</code> get an isolated preview environment, torn down on close</li>
            <li>All Azure resources are managed by the <code className="arch-inline-code">azure-infrastructure</code> package</li>
            <li>Container Apps scale to zero when idle — expect cold starts on first request</li>
            <li>dashboard-api uses a system-assigned managed identity; no secrets stored in app settings</li>
          </ul>
        </section>

        <p className="arch-footer">Last updated: {today}</p>
      </div>
    </div>
  );
};

export default Architecture;
