import React from 'react';
import NavBar from './components/nav-bar.tsx';
import './styling/architecture.css';
import metadata from './architecture-metadata.json';
import ArchDiagram from './architecture/ArchDiagram.tsx';

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
            <li><a href="#design-docs">Design Doc Generation</a></li>
          </ol>
        </div>

        {/* ── 1. Overview ── */}
        <section className="arch-section" id="overview">
          <h2>1. Overview</h2>
          <p>
            The system is made up of eight packages. The frontend is a React SPA hosted on
            Azure Static Web Apps. It talks to five backend services — three Azure Functions
            apps, two Azure Container Apps, and one Container App Job. A separate
            infrastructure package defines all cloud resources.
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
                ['ideas-api',            'Stores/serves AI-generated feature ideas; triggers ideas-bot',  'Azure Functions',       'ideas-api'],
                ['ideas-bot',            'Autonomous agent: implements features and opens draft PRs',      'Container App Job',     null],
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
          <ArchDiagram />
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

          <h3>ideas-api — Ideas Board API</h3>
          <p>
            Stores and serves AI-generated feature ideas in Azure Table Storage.
            Accepts browser JWT tokens via EasyAuth for read access and an
            <code className="arch-inline-code">X-Ideas-Key</code> machine write-key for
            automated writes. Exposes endpoints to list and create ideas, manage projects,
            and trigger the ideas-bot Container App Job via{' '}
            <code className="arch-inline-code">POST /api/ideas/{'{id}'}/run-bot</code>.
          </p>
          <div className="arch-tech-stack">
            {['Azure Functions v2', 'Python 3.11', 'Azure Table Storage', 'EasyAuth', 'Managed Identity'].map(t =>
              <span key={t} className="arch-tech-item">{t}</span>
            )}
          </div>

          <h3>ideas-bot — Autonomous Feature Agent</h3>
          <p>
            Container App Job triggered by ideas-api. Clones the target repository, then
            runs a GPT-4o tool-use loop that reads and writes files and runs shell commands
            to implement the requested feature. Commits the result and opens a draft pull
            request on GitHub. The job scales to zero between invocations — each trigger
            spins up a fresh container.
          </p>
          <div className="arch-tech-stack">
            {['Python 3.11', 'Azure Container App Job', 'Azure OpenAI (GPT-4o)', 'GitHub API'].map(t =>
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

          <h3>Ideas Board flow</h3>
          <div className="arch-flow">
            <div className="arch-flow-box purple">User opens /ideas</div>
            <div className="arch-flow-down">↓</div>
            <div className="arch-flow-box purple">
              ideas-api (Azure Functions)
              <small>GET /api/ideas — reads Azure Table Storage (EasyAuth JWT)</small>
              <small>GET /api/projects — project list</small>
            </div>
            <div className="arch-flow-down">↓</div>
            <div className="arch-flow-box purple">
              Ideas board rendered
              <small>user clicks "Assign Bot" → POST /api/ideas/{'{id}'}/run-bot</small>
            </div>
            <div className="arch-flow-down">↓  (on Assign Bot)</div>
            <div className="arch-flow-box" style={{ borderColor: '#30363d', color: '#8b949e' }}>
              ideas-bot (Container App Job)
              <small>clones target repo · GPT-4o tool-use loop · read/write files</small>
              <small>commits changes · opens draft PR on GitHub</small>
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

          <h3>ideas-api (Azure Functions)</h3>
          <div className="arch-pipeline">
            <div className="arch-pipeline-box">{'git push\nmain'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box blue">{'GitHub Actions'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box">{'func publish\n--python'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box green">{'Live on\nAzure Functions'}</div>
          </div>

          <h3>ideas-bot (Container App Job)</h3>
          <div className="arch-pipeline">
            <div className="arch-pipeline-box">{'git push\nmain'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box blue">{'GitHub Actions'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box">{'docker build\n& push to ACR'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box orange">{'az containerapp\njob update'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box green">{'Live as\nContainer App Job'}</div>
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

        {/* ── 6. Design Doc Generation ── */}
        <section className="arch-section" id="design-docs">
          <h2>6. Design Doc Generation</h2>
          <p>
            Every pull request to any backend repo triggers a GitHub Actions workflow that
            uses Azure OpenAI (GPT-4o) to decide whether the change warrants an Architecture
            Decision Record (ADR). Significant changes — new endpoints, external integrations,
            schema changes, security changes — get an ADR automatically generated and committed
            as a second draft PR to <code className="arch-inline-code">docs/design/</code> in
            that repo.
          </p>

          <h3>How it works</h3>
          <div className="arch-pipeline" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
            <div className="arch-pipeline-box">{'PR opened /\nupdated'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box blue">{'design-doc-check.yml\n(caller, per repo)'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box blue">{'reusable workflow\n@ my-website/main'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box">{'git diff\nbase..HEAD'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box orange">{'GPT-4o\nsignificance check'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box orange">{'GPT-4o\ngenerates ADR'}</div>
            <span className="arch-pipeline-arrow">→</span>
            <div className="arch-pipeline-box green">{'draft PR with\ndocs/design/YYYY-MM-DD-name.md'}</div>
          </div>

          <h3>Significance criteria</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
            <div>
              <p style={{ color: '#3fb950', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.85rem' }}>Generates an ADR</p>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#c9d1d9', lineHeight: 1.7 }}>
                <li>New API endpoints or routes</li>
                <li>New external integrations or dependencies</li>
                <li>Data model / schema changes</li>
                <li>Security or authentication changes</li>
                <li>Significant new user-facing features</li>
              </ul>
            </div>
            <div>
              <p style={{ color: '#8b949e', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.85rem' }}>Skipped</p>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#8b949e', lineHeight: 1.7 }}>
                <li>Bug fixes</li>
                <li>Dependency version bumps</li>
                <li>UI tweaks (colour, spacing, copy)</li>
                <li>Test-only changes</li>
                <li>Lint or formatting</li>
              </ul>
            </div>
          </div>

          <h3>ADR format</h3>
          <pre style={{
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 6,
            padding: '0.85rem 1rem',
            fontSize: '0.78rem',
            color: '#8b949e',
            lineHeight: 1.6,
            overflowX: 'auto',
            marginTop: '0.5rem',
          }}>{`# ADR: [Feature Name]
**Date:** YYYY-MM-DD  **Status:** Proposed  **PR:** [repo#N](url)

## Context
## Decision
## Alternatives Considered
## Consequences (Positive / Trade-offs)
## Relevant Code (GitHub permalink links)`}</pre>

          <h3>Adding a new repo</h3>
          <ol style={{ fontSize: '0.88rem', color: '#c9d1d9', lineHeight: 1.8, paddingLeft: '1.4rem' }}>
            <li>
              Copy <code className="arch-inline-code">.github/workflows/design-doc-check.yml</code> from
              any backend repo; update the <code className="arch-inline-code">repo_name</code> input to
              match the new repo's short name.
            </li>
            <li>
              Add <code className="arch-inline-code">AZURE_OPENAI_API_KEY</code> and{' '}
              <code className="arch-inline-code">DESIGN_DOC_GH_TOKEN</code> secrets in the repo's
              GitHub Settings → Secrets.
            </li>
            <li>
              Create <code className="arch-inline-code">docs/design/.gitkeep</code> to initialise
              the ADR directory.
            </li>
          </ol>
        </section>

        <p className="arch-footer">Last updated: {today}</p>
      </div>
    </div>
  );
};

export default Architecture;
