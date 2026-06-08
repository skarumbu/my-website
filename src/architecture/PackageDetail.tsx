import React from 'react';
import archContent from '../architecture-content.json';
import historyIndex from '../architecture-history-index.json';

type HistoryEntry = { package: string; capturedAt: string; commitSha: string; commitMessage: string };
const allHistory = historyIndex as HistoryEntry[];

type GeneratedContent = {
  summary?: string;
  description?: string;
  features?: string[];
  architecture?: { overview?: string; keyPoints?: string[] };
  dataFlow?: { label: string; color?: string; sublines?: string[] }[] | null;
  updatedAt?: string;
  updatedBySha?: string;
};
const generated = archContent as Record<string, GeneratedContent>;

// ── Data ─────────────────────────────────────────────────────────────────────

interface FlowStep {
  label: string;
  sublines?: string[];
  color?: 'blue' | 'green' | 'orange' | 'purple';
}

interface PipelineStep {
  label: string;
  color?: 'blue' | 'green' | 'orange';
}

interface PkgData {
  name: string;
  role: string;
  runsOn: string;
  description: string;
  features: string[];
  architecture: {
    overview: string;
    keyPoints: string[];
  };
  techStack: string[];
  pipeline: PipelineStep[];
  dataFlow?: FlowStep[];
}

const PACKAGES: Record<string, PkgData> = {
  'my-website': {
    name: 'my-website',
    role: 'React SPA — user-facing frontend',
    runsOn: 'Azure Static Web Apps',
    description:
      'A React (TypeScript) single-page application that hosts all user-facing features. Deployed to Azure Static Web Apps with a rewrite rule that sends all navigation to index.html so client-side routing works on deep links.',
    features: [
      'Digits — daily number puzzle game. Uses hardcoded stub data in development (no API call needed)',
      'Momentum Finder — live NBA game cards with momentum shift indicators',
      'Trail Finder — city search with Google Maps autocomplete (browser-side), trail recommendations, weather, and AI-generated gear list',
      'Ideas Board — EasyAuth sign-in, feature idea list and project management, one-click bot trigger',
      'Learning Plan — Google OAuth sign-in, AI-generated personalised study plans, save and review history',
      'Architecture reference — internal system documentation (not linked from the main nav)',
    ],
    architecture: {
      overview:
        'Create React App with TypeScript and client-side routing via react-router-dom. Each route maps to a top-level TSX + CSS pair. A shared NavBar component appears on every view. REACT_APP_* environment variables are injected at build time by GitHub Actions.',
      keyPoints: [
        'public/staticwebapp.config.json rewrites all routes to index.html — required for deep-link navigation on Azure SWA',
        'Digits uses process.env.NODE_ENV === "development" to skip the API and use hardcoded stub data locally',
        'Trail Finder autocomplete uses the Google Maps JS SDK entirely in the browser — no backend round-trip, 300ms debounce',
        'Every PR to main gets an isolated SWA preview environment, torn down automatically when the PR closes',
        'Cross-repo deploy: after each backend service deploys, it commits updated metadata to this repo, triggering a frontend rebuild so the Architecture page stays current',
      ],
    },
    techStack: ['React 18', 'TypeScript', 'React Router v6', 'Create React App', 'Azure Static Web Apps', 'Google Maps JS SDK'],
    pipeline: [
      { label: 'git push\nmain' },
      { label: 'GitHub Actions\ntrigger', color: 'blue' },
      { label: 'npm run build' },
      { label: 'Azure SWA\ndeploy action', color: 'orange' },
      { label: 'Live on\nAzure SWA', color: 'green' },
    ],
  },

  'digits': {
    name: 'digits',
    role: 'Generates and serves daily Digits puzzles',
    runsOn: 'Azure Functions',

    description:
      'Azure Functions app that generates, stores, and serves daily number puzzles. Each request is instrumented with metrics rows written to Table Storage so the dashboard can track volume and latency.',
    features: [
      'Generates number puzzles with configurable difficulty (easy, medium, hard)',
      'Stores puzzles in Azure Table Storage partitioned by date',
      'Serves the current day\'s puzzles via a single HTTP GET endpoint',
      'Writes per-request metrics rows (duration, status, puzzle count) to a metrics table',
      'Three difficulty tiers returned in a single response — frontend sorts easy → medium → hard',
    ],
    architecture: {
      overview:
        'Two Azure Function triggers: a timer trigger that generates the day\'s puzzles at midnight UTC and writes them to Table Storage, and an HTTP trigger that reads and returns them. Table Storage acts as both puzzle store and metrics sink.',
      keyPoints: [
        'Frontend skips this API in development — NODE_ENV=development activates hardcoded stub data',
        'Metrics rows are picked up by dashboard-api via Azure Table Storage queries',
        'Timer trigger uses a cron expression: "0 0 * * *" (midnight UTC daily)',
        'Puzzles are keyed by ISO date string — no cleanup needed, old rows simply age out',
      ],
    },
    techStack: ['Azure Functions v2', 'Python 3.11', 'Azure Table Storage'],
    pipeline: [
      { label: 'git push\nmain/master' },
      { label: 'GitHub Actions', color: 'blue' },
      { label: 'func publish\n--python' },
      { label: 'Live on\nAzure Functions', color: 'green' },
    ],
    dataFlow: [
      { label: 'User opens /digits', color: 'blue' },
      { label: 'Frontend checks NODE_ENV', sublines: ['development → hardcoded stub data (no API call)', 'production → call Digits API'] },
      { label: 'Digits API (Azure Functions)', sublines: ['returns puzzles sorted by difficulty', 'writes metrics row to Table Storage'], color: 'green' },
      { label: 'Puzzles rendered — easy → medium → hard', color: 'blue' },
    ],
  },

  'momentum-finder': {
    name: 'momentum-finder',
    role: 'Identifies momentum shifts in live NBA games',
    runsOn: 'Azure Container Apps',

    description:
      'FastAPI Container App that analyses live NBA game data to detect and surface momentum shifts. Scales automatically between 0 and 10 replicas and emits structured JSON logs for dashboard monitoring.',
    features: [
      'Fetches live NBA game scores and play-by-play data',
      'Detects scoring runs and momentum shifts within a game',
      'Returns structured game cards with team info, score, period, and momentum indicators',
      '/health endpoint consumed by dashboard-api for uptime monitoring',
      'Structured JSON request logs flow into shared Log Analytics workspace',
    ],
    architecture: {
      overview:
        'FastAPI on Uvicorn (port 80), containerised and deployed as an Azure Container App. Shares a Log Analytics workspace with trail-finder for unified observability. The app scales to zero replicas when idle.',
      keyPoints: [
        'Scales 0–10 replicas — expect a cold start (~5–10s) on first request after idle',
        'Shared Log Analytics workspace with trail-finder; KQL queries in dashboard-api span both services',
        'REACT_APP_API_BASE_URL must be set in the frontend build for this feature to work',
        'Structured logging middleware attaches request_id, duration_ms, and status_code to every log line',
      ],
    },
    techStack: ['FastAPI', 'Python 3.11', 'Uvicorn', 'Azure Container Apps', 'Log Analytics', 'Docker'],
    pipeline: [
      { label: 'git push\nmain/master' },
      { label: 'GitHub Actions', color: 'blue' },
      { label: 'docker build\n& push to ACR' },
      { label: 'az containerapp\nupdate', color: 'orange' },
      { label: 'Live on\nContainer Apps', color: 'green' },
    ],
    dataFlow: [
      { label: 'User opens /momentum-finder', color: 'blue' },
      { label: 'GET {REACT_APP_API_BASE_URL}/get-current-games', color: 'orange' },
      { label: 'momentum-finder Container App', sublines: ['fetches live NBA data', 'analyses scoring runs and momentum'], color: 'orange' },
      { label: 'Live game cards rendered — teams, score, momentum indicators', color: 'blue' },
    ],
  },

  'trail-finder': {
    name: 'trail-finder',
    role: 'Trail recommendations + conditions via Google Places & AI',
    runsOn: 'Azure Container Apps',

    description:
      'FastAPI Container App that generates personalised trail recommendations for a given city. Fans out across Google Places, weather, and search APIs, then synthesizes a condition summary and gear list with Azure OpenAI. Results are cached 24h per location.',
    features: [
      'City search with Google Maps JS SDK autocomplete — runs entirely in the browser, zero backend cost',
      'Geocodes the city and searches Google Places for nearby hiking trails',
      'Fetches weekend weather forecast from Open-Meteo (free, no API key)',
      'Pulls AllTrails snippets via Google Custom Search for additional trail context',
      'Azure OpenAI synthesizes a condition summary and gear list from all sources',
      'In-memory result cache keyed by normalised city name — 24h TTL',
      '/health endpoint for dashboard monitoring',
    ],
    architecture: {
      overview:
        'FastAPI app with a sequential pipeline of external API calls fanned out where possible. Azure OpenAI synthesizes the final output from all gathered context. The in-memory cache is a Python dict — cleared on container restart.',
      keyPoints: [
        'Autocomplete is browser-side (Google Maps JS SDK) — 300ms debounce, no backend request until search is submitted',
        '24h cache TTL balances freshness with API cost; weather is the most volatile component',
        'Identical structured JSON logging middleware to momentum-finder — same KQL queries work for both',
        'Scales to zero when idle — same cold start caveat as momentum-finder',
        'Google Places and Custom Search quotas are the primary cost driver; OpenAI is secondary',
      ],
    },
    techStack: ['FastAPI', 'Python 3.11', 'Uvicorn', 'Azure Container Apps', 'Google Places API', 'Google Custom Search', 'Open-Meteo', 'Azure OpenAI', 'Log Analytics', 'Docker'],
    pipeline: [
      { label: 'git push\nmain/master' },
      { label: 'GitHub Actions', color: 'blue' },
      { label: 'docker build\n& push to ACR' },
      { label: 'az containerapp\nupdate', color: 'orange' },
      { label: 'Live on\nContainer Apps', color: 'green' },
    ],
    dataFlow: [
      { label: 'User types city → Google Maps JS SDK autocomplete (browser)', color: 'blue' },
      { label: 'User submits → trail-finder API (Container App)', color: 'orange' },
      { label: 'Geocode city → lat/lon', sublines: ['Google Places text search for nearby trails', 'Open-Meteo weekend weather forecast', 'Google Custom Search for AllTrails snippets'] },
      { label: 'Azure OpenAI synthesizes condition summary + gear list', color: 'orange' },
      { label: 'Result cached 24h · trail cards rendered', color: 'blue' },
    ],
  },

  'dashboard-api': {
    name: 'dashboard-api',
    role: 'Aggregates health, metrics, and cost across all services',
    runsOn: 'Azure Functions',

    description:
      'Azure Functions app that fans out in parallel to health-check all services, query Log Analytics for request metrics, pull Digits Table Storage metrics, and fetch Azure Cost Management spend — returning everything in a single aggregated response.',
    features: [
      'Health checks for momentum-finder and trail-finder (HTTP /health)',
      'Log Analytics KQL queries for request counts, average latency, and errors per service (24h window)',
      'Digits metrics from Table Storage (request volume, error rate)',
      'Azure Cost Management MTD spend breakdown — cached 1h due to API rate limits',
      'All data returned in a single response — frontend polls every 60 seconds',
    ],
    architecture: {
      overview:
        'Single HTTP-triggered function that executes all sub-queries in parallel via asyncio.gather. Uses a system-assigned Managed Identity — no credentials stored in app settings. RBAC roles are assigned by the azure-infrastructure package.',
      keyPoints: [
        'Managed Identity holds Log Analytics Reader (scoped to the shared workspace) and Cost Management Reader (scoped to subscription)',
        'No API keys in environment variables — all Azure SDK auth flows through Managed Identity',
        'Cost Management responses cached for 1h in memory; all other queries are live',
        'Frontend dashboard polls /api/dashboard every 60 seconds',
        'Parallel fan-out keeps response time under 3s even with 5+ downstream calls',
      ],
    },
    techStack: ['Azure Functions v2', 'Python 3.11', 'azure-monitor-query', 'azure-identity', 'Azure Cost Management', 'Managed Identity'],
    pipeline: [
      { label: 'git push\nmain/master' },
      { label: 'GitHub Actions', color: 'blue' },
      { label: 'func publish\n--python' },
      { label: 'Live on\nAzure Functions', color: 'green' },
    ],
    dataFlow: [
      { label: 'Dashboard frontend (60s poll)', color: 'blue' },
      { label: 'dashboard-api (Azure Functions) — parallel fan-out', sublines: [
        'Health: GET momentum-finder /health, trail-finder /health',
        'Log Analytics KQL: request counts, latency, errors (24h)',
        'Table Storage: digits metrics rows (24h)',
        'Cost Management: MTD spend by service (1h cache)',
      ], color: 'purple' },
      { label: 'Aggregated JSON response', color: 'green' },
      { label: 'Dashboard renders health pills, metrics tables, cost breakdown', color: 'blue' },
    ],
  },

  'ideas-api': {
    name: 'ideas-api',
    role: 'Stores/serves AI-generated feature ideas; triggers ideas-bot',
    runsOn: 'Azure Functions',

    description:
      'Azure Functions app that stores and serves feature ideas in Table Storage. Supports two auth modes: browser JWT tokens via EasyAuth for read access, and an X-Ideas-Key machine write-key for automated writes. Exposes a trigger endpoint for the ideas-bot.',
    features: [
      'List and create ideas in Azure Table Storage',
      'List and create projects — ideas are grouped under projects',
      'EasyAuth JWT authentication for browser access (read)',
      'X-Ideas-Key machine write-key for automated idea creation (write)',
      'POST /api/ideas/{id}/run-bot — triggers the ideas-bot Container App Job for a specific idea',
      'Ideas and projects stored in separate Table Storage tables',
    ],
    architecture: {
      overview:
        'HTTP-triggered Azure Functions backed by Table Storage. EasyAuth handles browser auth transparently at the Azure layer — no auth code in the application. A separate machine key enables automation (ideas-bot, external scripts) to write ideas without user credentials.',
      keyPoints: [
        'EasyAuth injects the validated Google ID token as a request header — the function reads sub and email from it',
        'X-Ideas-Key is a long-lived secret stored as a Function App setting (not in the codebase)',
        'run-bot endpoint starts a Container App Job execution via the Azure SDK and returns immediately',
        'No compute runs between requests — fully serverless, scales to zero',
        'Table Storage partition key = project ID; row key = idea ID (UUID)',
      ],
    },
    techStack: ['Azure Functions v2', 'Python 3.11', 'Azure Table Storage', 'EasyAuth', 'Managed Identity', 'azure-containerapp'],
    pipeline: [
      { label: 'git push\nmain' },
      { label: 'GitHub Actions', color: 'blue' },
      { label: 'func publish\n--python' },
      { label: 'Live on\nAzure Functions', color: 'green' },
    ],
    dataFlow: [
      { label: 'User opens /ideas — EasyAuth validates Google JWT', color: 'purple' },
      { label: 'GET /api/ideas + GET /api/projects', sublines: ['reads Azure Table Storage', 'returns idea and project lists'], color: 'purple' },
      { label: 'User clicks "Assign Bot"', color: 'purple' },
      { label: 'POST /api/ideas/{id}/run-bot', sublines: ['triggers Container App Job execution via Azure SDK', 'returns job execution ID immediately'], color: 'orange' },
      { label: 'ideas-bot runs asynchronously → opens draft PR', color: 'green' },
    ],
  },

  'ideas-bot': {
    name: 'ideas-bot',
    role: 'Autonomous agent: implements features and opens draft PRs',
    runsOn: 'Container App Job',
    description:
      'A containerised Python agent that autonomously implements feature ideas. Triggered on demand by ideas-api, it clones the target repo, runs a GPT-4o tool-use loop to read/write files and execute shell commands, commits the result, and opens a draft pull request.',
    features: [
      'Triggered on demand via ideas-api — one job execution per idea',
      'Clones the target GitHub repository fresh on each run',
      'GPT-4o tool-use loop with file read/write and shell execution tools',
      'Commits implemented changes with a descriptive commit message',
      'Opens a draft pull request on GitHub with a summary of changes',
      'Scales to zero between invocations — no idle cost',
    ],
    architecture: {
      overview:
        'A Python script packaged as a Docker container and registered as a Container App Job. Each trigger spins up a fresh job execution from scratch. The GPT-4o agent loop iterates until the feature is implemented or a maximum iteration limit is reached, then commits and creates the PR.',
      keyPoints: [
        'Fresh container per invocation — no shared state between runs',
        'GitHub PAT stored as a Container App secret (not an environment variable in the image)',
        'GPT-4o tool-use loop has a hard iteration cap to prevent runaway API cost',
        'Shell execution tool runs in a sandboxed subprocess within the container',
        'Job is triggered via az containerapp job start by ideas-api using Managed Identity',
      ],
    },
    techStack: ['Python 3.11', 'Azure Container App Job', 'Azure OpenAI (GPT-4o)', 'GitHub API', 'Docker', 'Managed Identity'],
    pipeline: [
      { label: 'git push\nmain' },
      { label: 'GitHub Actions', color: 'blue' },
      { label: 'docker build\n& push to ACR' },
      { label: 'az containerapp\njob update', color: 'orange' },
      { label: 'Live as\nContainer App Job', color: 'green' },
    ],
    dataFlow: [
      { label: 'ideas-api receives POST /run-bot', color: 'purple' },
      { label: 'Container App Job starts — fresh container', color: 'orange' },
      { label: 'Clone target repo · read idea description', sublines: ['GPT-4o tool-use loop', 'read files · write files · run shell commands'] },
      { label: 'Commit changes · open draft PR on GitHub', color: 'green' },
    ],
  },

  'azure-infrastructure': {
    name: 'azure-infrastructure',
    role: 'Defines all Azure cloud resources (infra-as-code)',
    runsOn: 'Provisioning only',
    description:
      'Bicep infrastructure-as-code package that defines and provisions every Azure resource in the system at subscription scope. Modules cover each service, the shared networking layer, and all RBAC role assignments.',
    features: [
      'Azure Static Web App for the frontend (my-website)',
      'Container Registry for Docker images (momentum-finder, trail-finder, ideas-bot)',
      'Container App Environment with shared Log Analytics workspace',
      'momentum-finder and trail-finder Container Apps (with scaling rules)',
      'digits, dashboard-api, and ideas-api Azure Functions apps',
      'All Managed Identity RBAC role assignments (Log Analytics Reader, Cost Management Reader)',
      'Container App Job definition for ideas-bot',
    ],
    architecture: {
      overview:
        'Modular Bicep files deployed at subscription scope. Each service has its own module. The Container App Environment module creates the shared Log Analytics workspace used for unified observability across all Container Apps.',
      keyPoints: [
        'Subscription-scope deployment — all resources land in a single resource group',
        'Managed Identity role assignments are defined alongside the resources that need them',
        'Container Registry uses admin credentials (not Managed Identity) for simplicity',
        'Log Analytics workspace is shared by momentum-finder, trail-finder, and dashboard-api',
        'Scaling rules on Container Apps: min 0 replicas (scale to zero), max 10',
      ],
    },
    techStack: ['Azure Bicep', 'Azure RBAC', 'Managed Identity', 'Container Registry', 'Azure CLI'],
    pipeline: [
      { label: 'Manual trigger\nor PR merge' },
      { label: 'GitHub Actions', color: 'blue' },
      { label: 'az deployment\nsub create', color: 'orange' },
      { label: 'Resources\nprovisioned', color: 'green' },
    ],
  },

  'learning-plan-api': {
    name: 'learning-plan-api',
    role: 'Generates and stores AI-powered personalised learning plans',
    runsOn: 'Azure Functions',

    description:
      'Azure Functions app that generates structured learning plans via the Claude API and stores them per user in Azure Table Storage. Google ID tokens are verified server-side for every request.',
    features: [
      'Generates structured learning plans (phases, steps, resources) via Claude API',
      'User authentication via Google OAuth — ID token verified server-side on every request',
      'Stores plans per user in Azure Table Storage (partition key = Google sub claim)',
      'List, create, retrieve, and delete plans per authenticated user',
      'Plan content stored as markdown; frontend renders it with a lightweight parser',
    ],
    architecture: {
      overview:
        'HTTP-triggered Azure Functions backed by Table Storage. Google ID tokens are validated using Google\'s public key endpoint. The Claude API generates the plan as markdown given a topic, duration, and depth. No session state — fully stateless JWT verification per request.',
      keyPoints: [
        'User isolation enforced at the storage level: partition key = Google sub claim',
        'Google token verification hits accounts.google.com/o/oauth2/v3/certs on each request (cached by the SDK)',
        'Claude API called with a structured prompt; plan markdown is stored as-is',
        'Frontend sends the Google ID token in Authorization: Bearer header',
        'No admin interface — plan deletion is user-self-service only',
      ],
    },
    techStack: ['Azure Functions v2', 'Python 3.11', 'Azure Table Storage', 'Claude API', 'Google OAuth'],
    pipeline: [
      { label: 'git push\nmain' },
      { label: 'GitHub Actions', color: 'blue' },
      { label: 'func publish\n--python' },
      { label: 'Live on\nAzure Functions', color: 'green' },
    ],
    dataFlow: [
      { label: 'User signs in — Google ID token returned to browser', color: 'blue' },
      { label: 'GET /api/plans — Authorization: Bearer {token}', color: 'green' },
      { label: 'learning-plan-api verifies Google token · reads Table Storage', sublines: ['returns plans for this user (partition = sub claim)'], color: 'green' },
      { label: 'User submits topic + duration + depth', color: 'blue' },
      { label: 'POST /api/plans/generate → Claude API', sublines: ['structured prompt → markdown learning plan returned'], color: 'orange' },
      { label: 'POST /api/plans saves plan to Table Storage', color: 'green' },
    ],
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  packageKey: string;
  onBack: () => void;
}

const PackageDetail: React.FC<Props> = ({ packageKey, onBack }) => {
  const staticPkg = PACKAGES[packageKey];

  if (!staticPkg) {
    return (
      <div style={{ padding: '2rem', color: '#8b949e' }}>
        <button className="arch-pkg-back" onClick={onBack}>← Back to Architecture</button>
        <p style={{ marginTop: '1rem' }}>Package not found: {packageKey}</p>
      </div>
    );
  }

  // Merge LLM-generated content over the static defaults
  const gen = generated[packageKey] ?? {};
  const pkg = {
    ...staticPkg,
    description: gen.description ?? staticPkg.description,
    features: gen.features ?? staticPkg.features,
    architecture: {
      ...staticPkg.architecture,
      ...(gen.architecture ?? {}),
    },
    dataFlow: gen.dataFlow !== undefined ? (gen.dataFlow ?? staticPkg.dataFlow) : staticPkg.dataFlow,
  };
  const designDocs: { title: string; href: string; date: string; description: string }[] =
    (gen as any).designDocs ?? [];

  const pkgHistory = allHistory.filter(e => e.package === packageKey);

  return (
    <div>
      <button className="arch-pkg-back" onClick={onBack}>← Architecture</button>

      {/* ── Header ── */}
      <div className="arch-pkg-header">
        <div className="arch-pkg-header-top">
          <code className="arch-pkg-name">{pkg.name}</code>
          <span className="arch-pkg-runs-on">{pkg.runsOn}</span>
          {gen.updatedAt && (
            <span className="arch-pkg-ai-badge" title={`Updated from commit ${gen.updatedBySha}`}>
              ✦ docs updated {gen.updatedAt}
            </span>
          )}
        </div>
        <p className="arch-pkg-role">{pkg.role}</p>
        <p className="arch-pkg-desc">{pkg.description}</p>
        <div className="arch-tech-stack" style={{ marginTop: '1rem' }}>
          {pkg.techStack.map(t => (
            <span key={t} className="arch-tech-item">{t}</span>
          ))}
        </div>
      </div>

      <div className="arch-pkg-body">

        {/* ── Features ── */}
        <section className="arch-section">
          <h2>Features</h2>
          <ul className="arch-pkg-features">
            {pkg.features.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </section>

        {/* ── Architecture ── */}
        <section className="arch-section">
          <h2>Architecture</h2>
          <p>{pkg.architecture.overview}</p>
          <h3>Key design points</h3>
          <ul className="arch-pkg-keypoints">
            {pkg.architecture.keyPoints.map((k, i) => <li key={i}>{k}</li>)}
          </ul>
        </section>

        {/* ── Data Flow ── */}
        {pkg.dataFlow && (
          <section className="arch-section">
            <h2>Data Flow</h2>
            <div className="arch-flow">
              {pkg.dataFlow.map((step, i) => (
                <React.Fragment key={i}>
                  <div className={`arch-flow-box${step.color ? ` ${step.color}` : ''}`}>
                    {step.label}
                    {step.sublines?.map((s, j) => <small key={j}>{s}</small>)}
                  </div>
                  {i < pkg.dataFlow!.length - 1 && <div className="arch-flow-down">↓</div>}
                </React.Fragment>
              ))}
            </div>
          </section>
        )}

        {/* ── CI/CD ── */}
        <section className="arch-section">
          <h2>CI / CD</h2>
          <div className="arch-pipeline">
            {pkg.pipeline.map((step, i) => (
              <React.Fragment key={i}>
                <div className={`arch-pipeline-box${step.color ? ` ${step.color}` : ''}`}>
                  {step.label}
                </div>
                {i < pkg.pipeline.length - 1 && (
                  <span className="arch-pipeline-arrow">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </section>

        {/* ── Design Docs ── */}
        {designDocs.length > 0 && (
          <section className="arch-section">
            <h2>Design Docs</h2>
            <ul className="arch-design-docs">
              {designDocs.map((d, i) => (
                <li key={i}>
                  <a href={d.href} target="_blank" rel="noopener noreferrer">{d.title}</a>
                  <span className="arch-design-doc-meta">{d.date} — {d.description}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Change History ── */}
        {pkgHistory.length > 0 && (
          <section className="arch-section">
            <details className="arch-history">
              <summary className="arch-history-summary">
                Change history <span className="arch-history-count">({pkgHistory.length})</span>
              </summary>
              <ul className="arch-history-list">
                {pkgHistory.map((e, i) => (
                  <li key={i} className="arch-history-entry">
                    <span className="arch-history-date">{e.capturedAt}</span>
                    <code className="arch-history-sha">{e.commitSha}</code>
                    <span className="arch-history-msg">{e.commitMessage.split('\n')[0]}</span>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        )}

      </div>
    </div>
  );
};

export { PACKAGES };
export default PackageDetail;
