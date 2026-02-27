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

**Key architectural points:**

- **SPA routing on Azure**: `public/staticwebapp.config.json` rewrites all navigation to `index.html` so deep links work on the Azure Static Web Apps host.
- **Digits feature**: Fetches puzzle data from an Azure Functions endpoint (`digits-api-prod-hwbxtkz6lsfoq.azurewebsites.net`). In `development` mode (`process.env.NODE_ENV === 'development'`), it uses hardcoded stub data instead of hitting the API — no backend setup needed locally.
- **MomentumFinder feature**: Fetches live NBA game data from `process.env.REACT_APP_API_BASE_URL/get-current-games`. This env var must be set for the feature to work; otherwise it shows an error message.
- **Styling**: Each major view has a corresponding CSS file in `src/styling/`. Component-level CSS lives alongside components (e.g., `Row.css`).
- **Components**: Reusable UI pieces live in `src/components/`, with interactive circle buttons grouped under `src/components/buttons/`.
