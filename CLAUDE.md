# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start        # Dev server on localhost:3000 (uses WATCHPACK_POLLING=true for Windows compatibility)
npm run build    # Production build to /build
npm test         # Run tests in interactive watch mode
npx eslint src/  # Lint the source (CI uses CI=false to suppress ESLint warnings as errors)
```

The build pipeline runs via GitHub Actions and deploys automatically to Azure Static Web Apps on push to `main`.

## Architecture

This is a **Create React App** (TypeScript/JSX) single-page application with client-side routing via `react-router-dom`.

**Routes** (defined in `src/index.js`):
- `/` → `App.tsx` — landing page with NavBar
- `/digits` → `Digits.tsx` — number puzzle game
- `/momentum-finder` → `MomentumFinder.tsx` — live NBA games view
- `/poligraph` → `PoliGraph.tsx` — PoliGraph officials search and records
- `/poligraph/official/:officialId` → `PoliGraphOfficial.tsx` — one official's record, with filters and paging
- `/poligraph/lookup` → `PoliGraphLookup.tsx` — find my officials by address

**Key architectural points:**

- **SPA routing on Azure**: `public/staticwebapp.config.json` rewrites all navigation to `index.html` so deep links work on the Azure Static Web Apps host.
- **Digits feature**: Fetches puzzle data from an Azure Functions endpoint (`digits-api-prod-hwbxtkz6lsfoq.azurewebsites.net`). In `development` mode (`process.env.NODE_ENV === 'development'`), it uses hardcoded stub data instead of hitting the API — no backend setup needed locally.
- **MomentumFinder feature**: Fetches live NBA game data from `process.env.REACT_APP_API_BASE_URL/get-current-games`. This env var must be set for the feature to work; otherwise it shows an error message.
- **PoliGraph feature**: The API base URL comes from `process.env.REACT_APP_POLIGRAPH_API_URL`, read at call time. In `development` with that var unset, it uses stub data from `src/lib/poligraphStub.ts`. The lookup address is used only in one POST body and is never stored (not in the URL, history state, storage, or logs).
- **Styling**: Each major view has a corresponding CSS file in `src/styling/`. Component-level CSS lives alongside components (e.g., `Row.css`).
- **Components**: Reusable UI pieces live in `src/components/`, with interactive circle buttons grouped under `src/components/buttons/`.
