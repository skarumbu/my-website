import React from 'react';
import NavBar from './components/nav-bar.tsx';
import './styling/architecture.css';

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
            The system is made up of four packages. The frontend is a React SPA hosted on
            Azure Static Web Apps. It talks to two backend APIs — one that serves Digits
            puzzles and one that surfaces NBA momentum shifts. A separate infrastructure
            package defines all the cloud resources.
          </p>
          <table className="arch-table">
            <thead>
              <tr><th>Package</th><th>Role</th><th>Runs on</th></tr>
            </thead>
            <tbody>
              {[
                ['my-website',            'React SPA — the user-facing frontend',                         'Azure Static Web Apps'],
                ['digits',                'API that generates and serves Digits puzzles',                  'Azure Functions'],
                ['momentum-finder',       'Identifies momentum shifts in live NBA games',                  'API (REACT_APP_API_BASE_URL)'],
                ['azure-infrastructure',  'Defines all Azure cloud resources (infra-as-code)',             'Provisioning only'],
              ].map(([pkg, role, runs]) => (
                <tr key={pkg as string}>
                  <td><code className="arch-inline-code">{pkg}</code></td>
                  <td>{role}</td>
                  <td>{runs}</td>
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
              <div className="arch-route-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
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
              </div>
            </div>

            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-around' }}>
              <div className="arch-flow-down">↓</div>
              <div style={{ width: '33%' }} />
              <div className="arch-flow-down">↓</div>
            </div>

            {/* Bottom: two APIs side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}>
              <div className="arch-flow-box green" style={{ padding: '0.75rem 1rem', whiteSpace: 'normal' }}>
                <div style={{ fontWeight: 700 }}>digits</div>
                <div style={{ fontSize: '0.72rem', marginTop: '0.2rem', opacity: 0.8 }}>Azure Functions</div>
                <div style={{ fontSize: '0.72rem', marginTop: '0.35rem', color: '#8b949e' }}>
                  Generates and stores Digits puzzles
                </div>
              </div>
              <div className="arch-flow-box orange" style={{ padding: '0.75rem 1rem', whiteSpace: 'normal' }}>
                <div style={{ fontWeight: 700 }}>momentum-finder</div>
                <div style={{ fontSize: '0.72rem', marginTop: '0.2rem', opacity: 0.8 }}>API server</div>
                <div style={{ fontSize: '0.72rem', marginTop: '0.35rem', color: '#8b949e' }}>
                  Detects NBA momentum shifts from live game data
                </div>
              </div>
            </div>
          </div>

          {/* Infrastructure underline */}
          <div className="arch-flow-box purple" style={{ width: '100%', boxSizing: 'border-box', marginTop: '0.5rem', padding: '0.6rem 1rem', whiteSpace: 'normal', textAlign: 'center' }}>
            <span style={{ fontWeight: 700 }}>azure-infrastructure</span>
            <span style={{ fontSize: '0.75rem', marginLeft: '0.75rem', opacity: 0.8 }}>
              Provisions and configures all Azure resources used by the packages above
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
            client-side routing works on deep links.
          </p>
          <div className="arch-tech-stack">
            {['React 18', 'TypeScript', 'React Router v6', 'Create React App', 'Azure Static Web Apps'].map(t =>
              <span key={t} className="arch-tech-item">{t}</span>
            )}
          </div>

          <h3>digits — Puzzle API</h3>
          <p>
            Generates, stores, and serves the daily Digits puzzles. Exposes an HTTP
            endpoint that the frontend calls on load. In local development the frontend
            bypasses this API and uses hardcoded stub data instead.
          </p>
          <div className="arch-tech-stack">
            {['Azure Functions', 'REST API'].map(t =>
              <span key={t} className="arch-tech-item">{t}</span>
            )}
          </div>

          <h3>momentum-finder — NBA Momentum API</h3>
          <p>
            Analyses live NBA game data to surface momentum shifts. The frontend
            calls this API via the <code className="arch-inline-code">REACT_APP_API_BASE_URL</code> environment
            variable and displays the results in the <code className="arch-inline-code">/momentum-finder</code> view.
          </p>
          <div className="arch-tech-stack">
            {['REST API', 'Live NBA data'].map(t =>
              <span key={t} className="arch-tech-item">{t}</span>
            )}
          </div>

          <h3>azure-infrastructure — Infrastructure as Code</h3>
          <p>
            Defines and provisions all Azure resources used by the other packages —
            including the Static Web Apps host, the Functions runtime for the Digits
            API, and any shared configuration. Acts as the single source of truth for
            what exists in Azure.
          </p>
          <div className="arch-tech-stack">
            {['Azure', 'Infrastructure as Code'].map(t =>
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
              <small>returns puzzle numbers, target, solutions, difficulty</small>
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
              momentum-finder API
              <small>GET {'{REACT_APP_API_BASE_URL}'}/get-current-games</small>
            </div>
            <div className="arch-flow-down">↓</div>
            <div className="arch-flow-box blue">
              Live game cards displayed
              <small>teams, score, status, momentum indicators</small>
            </div>
          </div>
        </section>

        {/* ── 5. CI/CD ── */}
        <section className="arch-section" id="cicd">
          <h2>5. CI/CD &amp; Deployment</h2>
          <p>
            <code className="arch-inline-code">my-website</code> deploys automatically
            via GitHub Actions on every push to <code className="arch-inline-code">main</code>.
          </p>

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

          <ul>
            <li>Pull requests get an isolated preview environment, torn down on close</li>
            <li>All Azure resources are managed by the <code className="arch-inline-code">azure-infrastructure</code> package</li>
          </ul>
        </section>

        <p className="arch-footer">Last updated: {today}</p>
      </div>
    </div>
  );
};

export default Architecture;
