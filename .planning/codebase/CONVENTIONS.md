# Coding Conventions

**Analysis Date:** 2026-05-30

## Naming Patterns

**Files:**
- Page-level components use PascalCase: `App.tsx`, `Digits.tsx`, `MomentumFinder.tsx`, `Ideas.tsx`
- Component files use PascalCase: `DigitCircle.tsx`, `SignCircle.tsx`, `TargetDisplay.tsx`, `Spinner.tsx`
- The nav-bar component uses kebab-case as an exception: `nav-bar.tsx` (only one such case)
- CSS files use kebab-case: `home.css`, `nav-bar.css`, `digits-nav-bar.css`, `target-display.css`
- Config and utility files use camelCase: `authConfig.js`, `reportWebVitals.js`
- Data files use kebab-case: `arch-graph-data.ts`, `architecture-content.json`

**Components:**
- All React components are PascalCase function declarations or arrow functions
- Page-level components (full routes) are named to match their route: `MomentumFinder` → `/momentum-finder`
- Sub-components defined in the same file use PascalCase and appear above the main export: `Composer`, `BotStatusChip`, `StatusPill`, `IdeaCard`, `EmptyState` in `src/Ideas.tsx`

**Functions:**
- Event handlers use `handle` prefix: `handleSubmit`, `handleCreate`, `handleEdit`, `handleDelete`, `handleSetState`, `handleLogin`
- State-toggling helpers use action verbs: `openNew`, `openDetail`, `editFromDetail`, `retry`, `helpMe`
- Data-fetching functions use `fetch` prefix: `fetchGames`, `fetchIdeas`, `fetchProjects`
- Token helpers use `getToken` / `getTokenSilent` naming

**Variables:**
- camelCase throughout
- Boolean state variables use `is`/`has` prefixes or are plain nouns: `isAuthenticated`, `loading`, `posting`, `updating`
- Constants at module scope use SCREAMING_SNAKE_CASE: `POLL_INTERVAL_MS`, `DIFFICULTIES`, `CANDY_COLORS`, `TILTS`, `NEW_PROJECT_SENTINEL`, `API_BASE_URL`, `BASE_URL`

**Types / Interfaces:**
- Interfaces use PascalCase: `Digit`, `Sign`, `Game`, `Idea`, `Project`, `Update`
- Props interfaces are suffixed with `Props`: `DigitCircleProps`, `SignCircleProps`, `TargetDisplayProps`, `ComposerProps`, `DetailPanelProps`, `CardProps`
- Type aliases use PascalCase: `BotStatus`, `StatusFilter`, `SortOrder`
- Union string literal types are used for status/filter discriminators: `'open' | 'done' | 'dismissed'`

## Code Style

**Formatting:**
- No `.prettierrc` detected — formatting is informal/editor-driven
- Single quotes for string literals in `.tsx` files (majority pattern): `'react-scripts start'`
- Double quotes appear in JSX attribute strings and some `.tsx` files — inconsistent between files
- `Digits.tsx` uses single quotes for imports; `App.tsx` uses double quotes for imports
- Trailing commas present in most multi-line arrays/objects
- 2-space indentation throughout

**Linting:**
- ESLint configured via `eslint.config.mjs` using flat config format
- Rules: `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-plugin-react` recommended
- `react/react-in-jsx-scope` rule disabled (React 17+ JSX transform)
- Also has legacy `eslintConfig` in `package.json` extending `react-app` and `react-app/jest`
- TypeScript compiler errors are surface-level; some `any` types appear (e.g., `err: any`, `e: any`)

## Import Organization

**Order (observed pattern):**
1. React (always first when present): `import React from 'react'` or `import React, { useState, ... } from 'react'`
2. Third-party libraries: `axios`, `@azure/msal-react`, `@xyflow/react`
3. Local components: `import NavBar from './components/nav-bar.tsx'`
4. Local utilities/config: `import { msalConfig } from './authConfig.js'`
5. CSS imports last: `import './styling/main.css'`

**File extension in imports:**
- Explicit `.tsx` extensions are used in local component imports (non-standard, but consistent): `import Spinner from './components/Spinner.tsx'`
- `.ts` extension used for data files: `import { initialNodes } from './arch-graph-data.ts'`
- `.js` extension used for JS config: `import { msalConfig } from './authConfig.js'`

**Path Aliases:**
- None — all local imports use relative paths

## Error Handling

**Patterns:**
- API calls wrapped in `try/catch/finally` blocks
- Errors stored in React state as `string | null`: `const [error, setError] = useState<string | null>(null)`
- Error messages shown inline in JSX with a CSS error class: `<p className="ideas-error">{error}</p>`
- `catch` blocks set error state: `setError(e.message)` or `setError('Failed to create: ' + e.message)`
- Some catch blocks are silent (swallowed with empty `catch {}`): `IdeaDetailPanel.handleDeleteUpdate`, polling in `Ideas`
- `Digits.tsx` uses `console.log` for errors in the fetch block and for bad operations — not surfaced to UI
- `MomentumFinder.tsx` checks for `response.ok` and throws: `if (!response.ok) throw new Error(...)`
- Division by zero guarded in `applyOperation`: returns `null` for non-integer division

## Logging

**Framework:** `console.log` only — no structured logging library

**Patterns:**
- `console.log(error)` in catch blocks (Digits fetch): `src/Digits.tsx:135`
- `console.log("No solution found...")` as a dev-time guard: `src/Digits.tsx:147`
- `console.log("Bad Operation")` for unexpected arithmetic state: `src/Digits.tsx:183`
- No logging in production-facing components outside of `Digits.tsx`
- Prefer setting error state over console logging for user-visible errors

## Comments

**When to Comment:**
- Section dividers use `// ── SectionName ───` comment style (prominent in `Ideas.tsx`)
- Inline comments explain non-obvious decisions: `// Stubbed data for local development (mirrors prod shape...)`
- JSDoc not used anywhere in the codebase
- Comments on MSAL initialization explain the why: `// MSAL v3+ requires explicit initialization...`

## Function Design

**Size:**
- Small pure components are concise (5–15 lines): `Spinner`, `TargetDisplay`, `NavBar`
- Large page-level components are monolithic: `Digits.tsx` (~440 lines), `Ideas.tsx` (~990 lines)
- Sub-components are co-located in the same file rather than extracted to separate files

**Parameters:**
- Components receive typed props via destructured interface: `({ id, value, shown, selected, onClick }: DigitCircleProps)`
- Event handlers receive React synthetic events where needed: `(e: React.FormEvent)`

**Return Values:**
- All components return JSX or `null`
- Pure utility functions return computed values or `null` for invalid cases: `applyOperation` returns `number | null`

## Module Design

**Exports:**
- Default export per file — always the primary component or function
- Named exports used for data/config: `export const msalConfig`, `export const dashboardApiRequest`
- No barrel index files (no `src/components/index.ts`)

**React Component Declaration Style:**
- Most components use arrow function with explicit `React.FC` type: `const Foo: React.FC = () => ...`
- Some page-level components use plain function declaration: `function MomentumFinder()`, `function Ideas()`
- Both styles coexist without a consistent rule

**State Management:**
- All state is local `useState` — no global state manager (no Redux, Zustand, Context API for state)
- MSAL `MsalProvider` wraps the app for auth context only
- Data fetching done directly in `useEffect` or via `useCallback`-wrapped fetch functions

---

*Convention analysis: 2026-05-30*
