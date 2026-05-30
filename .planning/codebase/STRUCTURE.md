# Codebase Structure

**Analysis Date:** 2026-05-30

## Directory Layout

```
my-website/
├── .claude/                     # Claude Code project config
├── .github/
│   ├── scripts/                 # Helper scripts for CI
│   └── workflows/               # GitHub Actions workflows
│       ├── azure-static-web-apps.yml       # Main CI/CD: build + deploy to Azure SWA
│       ├── arch-content-update-reusable.yml # Reusable: update architecture JSON from backend CI
│       └── design-doc-check-reusable.yml   # Reusable: AI-generated ADR on significant PRs
├── .planning/
│   └── codebase/                # GSD codebase map documents (this file lives here)
├── docs/
│   └── design/                  # Architecture Decision Records (ADRs)
├── public/
│   ├── index.html               # CRA HTML shell
│   ├── staticwebapp.config.json # Azure SWA routing: rewrites all paths to index.html
│   ├── manifest.json            # PWA manifest
│   └── favicon.ico / logos      # Static brand assets
├── src/
│   ├── index.js                 # App entry point: MSAL init, router, ReactDOM mount
│   ├── authConfig.js            # MSAL config and OAuth scope definitions
│   ├── App.tsx                  # Home/landing page (route: /)
│   ├── Digits.tsx               # Digits puzzle game (route: /digits)
│   ├── MomentumFinder.tsx       # NBA live scoreboard (route: /momentum-finder)
│   ├── TrailFinder.tsx          # Trail search (route: /trail-finder)
│   ├── Dashboard.tsx            # Ops dashboard, MSAL-gated (route: /dashboard)
│   ├── Ideas.tsx                # Ideas board, MSAL-gated (route: /ideas)
│   ├── LearningPlan.tsx         # AI learning plans, Google OAuth (route: /learning-plan)
│   ├── Architecture.tsx         # System architecture reference (route: /architecture)
│   ├── Row.css                  # Layout CSS for Digits puzzle rows
│   ├── architecture/            # Sub-components for Architecture page only
│   │   ├── arch-graph-data.ts   # ReactFlow node/edge definitions for system diagram
│   │   ├── ArchDiagram.tsx      # Interactive ReactFlow diagram
│   │   ├── ServiceNode.tsx      # Custom node renderer for ArchDiagram
│   │   ├── ServicePanel.tsx     # Side panel shown on node click
│   │   └── PackageDetail.tsx    # Full drilldown view for a single package
│   ├── architecture-content.json       # AI-generated package summaries (CI-updated)
│   ├── architecture-metadata.json      # Last deploy SHA/timestamp per package (CI-updated)
│   ├── architecture-history-index.json # Index of historical architecture snapshots
│   ├── architecture-history/           # Timestamped JSON snapshots per package
│   │   ├── dashboard-api/
│   │   └── ideas-api/
│   ├── components/              # Shared/reusable UI components
│   │   ├── nav-bar.tsx          # Standard navigation bar (used by most pages)
│   │   ├── DigitsNavBar.tsx     # Digits-specific branded nav bar
│   │   ├── FireworksComponent.tsx  # Fireworks animation (Digits win state)
│   │   ├── SignCircle.tsx       # Operator button for Digits game
│   │   ├── Spinner.tsx          # Loading spinner (PulseLoader)
│   │   ├── TargetDisplay.tsx    # Target number display for Digits game
│   │   └── buttons/             # Interactive circle buttons for Digits
│   │       ├── DigitCircle.tsx  # Candy-colored number button
│   │       └── RetryCircle.tsx  # Animated retry button
│   ├── images/
│   │   └── refresh.png          # Refresh icon used by RetryCircle
│   └── styling/                 # All CSS files
│       ├── index.css            # Global base styles
│       ├── main.css             # Shared layout utility (`.main` container)
│       ├── home.css             # Home/landing page styles
│       ├── digits-nav-bar.css   # Digits nav bar styles
│       ├── nav-bar.css          # Standard nav bar styles
│       ├── button.css           # Shared button styles
│       ├── circle.css           # Circle button styles (Digits game)
│       ├── architecture.css     # Architecture page styles
│       ├── dashboard.css        # Dashboard page styles
│       ├── ideas.css            # Ideas board styles
│       ├── learning-plan.css    # Learning plan page styles
│       ├── momentum-finder.css  # MomentumFinder page styles
│       ├── target-display.css   # TargetDisplay component styles
│       └── trail-finder.css     # TrailFinder page styles
├── CLAUDE.md                    # Claude Code instructions for this repo
├── eslint.config.mjs            # ESLint flat config
├── package.json                 # npm dependencies and scripts
└── package-lock.json            # Lockfile
```

## Directory Purposes

**`src/` (root):**
- Purpose: All application source code
- Contains: Page components (one per route), entry point, auth config, co-located CSS for Digits rows
- Key files: `src/index.js` (router + entry), `src/authConfig.js` (MSAL/OAuth config)

**`src/components/`:**
- Purpose: Reusable presentational UI components shared across pages
- Contains: NavBar variants, Digits game UI pieces, utility components (Spinner, Fireworks)
- Key files: `src/components/nav-bar.tsx` (used by 6+ pages), `src/components/buttons/DigitCircle.tsx`

**`src/components/buttons/`:**
- Purpose: Interactive circle button components specific to the Digits puzzle
- Contains: `DigitCircle.tsx`, `RetryCircle.tsx`

**`src/architecture/`:**
- Purpose: Sub-components and data used exclusively by `Architecture.tsx`
- Contains: ReactFlow diagram, node/edge data, package detail drilldown
- Key files: `src/architecture/arch-graph-data.ts` (all node/edge definitions)

**`src/styling/`:**
- Purpose: All CSS for the application — one file per page or major component
- Contains: Global styles (`index.css`, `main.css`) plus per-feature CSS files
- Key files: `src/styling/index.css` (global), `src/styling/main.css` (`.main` layout wrapper)

**`src/images/`:**
- Purpose: Static image assets imported by components
- Contains: `refresh.png` (used by RetryCircle)

**`public/`:**
- Purpose: Static assets served as-is; not processed by Webpack/CRA
- Key files: `public/staticwebapp.config.json` (SPA routing fallback for Azure SWA)

**`.github/workflows/`:**
- Purpose: CI/CD automation
- Contains: Main deploy workflow, two reusable workflows (architecture update, ADR generation)

**`docs/design/`:**
- Purpose: Architecture Decision Records (ADRs) auto-generated by CI on significant PRs
- Contains: Markdown ADR files named `YYYY-MM-DD-feature-name.md`

## Key File Locations

**Entry Points:**
- `src/index.js`: MSAL initialization, route definitions, ReactDOM mount — the single JavaScript entry point
- `public/index.html`: HTML shell — do not add `<script>` tags here manually

**Configuration:**
- `src/authConfig.js`: MSAL client config and API scope definitions — update here when adding auth-gated features
- `public/staticwebapp.config.json`: Azure SWA routing rules — controls SPA fallback and static asset exclusions
- `eslint.config.mjs`: ESLint flat config
- `package.json`: npm scripts (`start`, `build`, `test`) and dependency versions

**Core Logic:**
- `src/Digits.tsx`: Puzzle game logic — number selection, arithmetic operations, hint/help system
- `src/Dashboard.tsx`: Ops dashboard — MSAL token acquisition, parallel service health/metrics/cost display
- `src/Ideas.tsx`: Ideas CRUD + bot trigger — most complex data flow in the frontend

**Architecture Reference:**
- `src/architecture/arch-graph-data.ts`: Edit this to add/remove nodes and edges in the interactive system diagram
- `src/architecture-content.json`: CI-managed — do not edit by hand; updated by `arch-content-update-reusable.yml`
- `src/architecture-metadata.json`: CI-managed — do not edit by hand

**Testing:**
- `src/setupTests.js`: jest-dom setup
- Test files: Not present in `src/` — no test files detected

## Naming Conventions

**Files:**
- Page components: PascalCase matching the route feature name — `Digits.tsx`, `MomentumFinder.tsx`, `TrailFinder.tsx`
- Reusable components: PascalCase — `NavBar.tsx` (exported as `nav-bar.tsx`), `DigitCircle.tsx`
- CSS files: kebab-case matching the component/page — `momentum-finder.css`, `digits-nav-bar.css`
- Data/config files: kebab-case with descriptive names — `arch-graph-data.ts`, `authConfig.js`
- JSON data files: kebab-case — `architecture-content.json`, `architecture-history-index.json`

**Directories:**
- Feature sub-directories: kebab-case — `architecture/`, `architecture-history/`
- Component groupings: lowercase noun — `components/`, `buttons/`, `styling/`, `images/`

**Components:**
- All React components: `React.FC` or `function ComponentName()` pattern; PascalCase names
- Props interfaces: PascalCase with `Props` suffix — `DigitCircleProps`, `RetryCircleProps`, `TargetDisplayProps`

**CSS Classes:**
- Page-scoped: BEM-style with feature prefix — `dash-hcard`, `dash-hcard-top`, `momentum-card`, `tf-difficulty-badge`
- Shared utilities: Short descriptive names — `.main`, `.Circle`, `.button`

## Where to Add New Code

**New Page/Feature:**
- Create `src/NewFeature.tsx` (PascalCase matching route name)
- Add route entry in `src/index.js` router config
- Add nav link in both `src/components/nav-bar.tsx` AND `src/components/DigitsNavBar.tsx`
- Create `src/styling/new-feature.css` and import it at the top of the page component
- Add card to `src/App.tsx` home page projects grid
- If auth-gated: add MSAL scope to `src/authConfig.js` and wrap with `useIsAuthenticated()` check

**New Reusable Component:**
- General components: `src/components/ComponentName.tsx`
- Digits-game-specific buttons: `src/components/buttons/ComponentName.tsx`
- Create corresponding CSS in `src/styling/component-name.css`

**New Env Variable:**
- Add to `.github/workflows/azure-static-web-apps.yml` under `env:` in the build step
- Reference as `process.env.REACT_APP_YOUR_VAR` in source (must start with `REACT_APP_`)
- Add to CLAUDE.md documentation

**Utilities / Hooks:**
- Currently no `src/hooks/` or `src/utils/` directories exist — create them if extracting shared logic from page components
- Suggested: `src/hooks/useAuth.ts` for shared MSAL token acquisition pattern (currently duplicated in Dashboard, Ideas)

**Architecture Diagram Update:**
- Add/modify nodes and edges in `src/architecture/arch-graph-data.ts`
- Package summaries in `src/architecture-content.json` are CI-managed — do not edit manually

## Special Directories

**`src/architecture-history/`:**
- Purpose: Timestamped JSON snapshots of architecture content per backend package
- Generated: Yes (by `arch-content-update-reusable.yml` CI workflow)
- Committed: Yes (snapshots committed to repo for history tracking)

**`build/`:**
- Purpose: CRA production build output
- Generated: Yes (`npm run build`)
- Committed: No (in `.gitignore`)

**`.planning/codebase/`:**
- Purpose: GSD codebase map documents for Claude Code planning workflows
- Generated: Yes (by `/gsd-map-codebase` command)
- Committed: No (in `.gitignore` or ignored by convention)

---

*Structure analysis: 2026-05-30*
