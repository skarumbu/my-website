# Testing Patterns

**Analysis Date:** 2026-05-30

## Test Framework

**Runner:**
- Jest (via `react-scripts` / Create React App default)
- No separate `jest.config.*` file — configuration is embedded in CRA defaults
- TypeScript support via CRA's built-in Babel transform

**Assertion Library:**
- `@testing-library/jest-dom` v5.17.0 — extended DOM matchers
- Setup file: `src/setupTests.js`

**Additional Libraries:**
- `@testing-library/react` v13.4.0 — React component rendering
- `@testing-library/user-event` v13.5.0 — user interaction simulation

**Run Commands:**
```bash
npm test            # Run tests in interactive watch mode
CI=true npm test    # Run tests once (non-interactive, for CI)
```

## Test File Organization

**Location:**
- Co-located with source files (CRA default convention)
- No `__tests__` directory exists

**Current State:**
- Zero test files exist in the repository (no `*.test.*` or `*.spec.*` files found)
- `src/setupTests.js` is present and imports `@testing-library/jest-dom`, establishing the test infrastructure but no tests have been written

**Naming (prescribed by CRA convention):**
- Place test files alongside the component they test: `src/components/Spinner.test.tsx`
- Use `.test.tsx` extension for TypeScript component tests
- Use `.test.ts` for non-JSX TypeScript tests

## Test Structure

**Suite Organization (prescribed pattern — no existing tests to reference):**
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ComponentName from './ComponentName';

describe('ComponentName', () => {
  it('renders without crashing', () => {
    render(<ComponentName />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
```

**Setup:**
- Global setup via `src/setupTests.js` — imported automatically by CRA before every test file
- No per-suite `beforeEach`/`afterEach` patterns established (no tests exist)

## Mocking

**Framework:** Jest built-in mocks (via `react-scripts`)

**What to Mock:**
- `axios` calls in `Digits.tsx` (uses `axios.request`)
- `fetch` calls in `MomentumFinder.tsx` and `Ideas.tsx`
- `process.env.NODE_ENV` and `process.env.REACT_APP_*` environment variables
- `@azure/msal-react` (`useMsal`, `useIsAuthenticated`) for auth-gated components like `Ideas`

**Recommended Patterns:**
```typescript
// Mock fetch globally
global.fetch = jest.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ games: [] }) })
) as jest.Mock;

// Mock environment variable
process.env.REACT_APP_API_BASE_URL = 'http://localhost:4000';

// Mock axios
jest.mock('axios');
import axios from 'axios';
(axios.request as jest.Mock).mockResolvedValue({ data: { ... } });

// Mock MSAL hooks
jest.mock('@azure/msal-react', () => ({
  useMsal: () => ({ instance: { acquireTokenSilent: jest.fn() }, accounts: [{}] }),
  useIsAuthenticated: () => true,
}));
```

**What NOT to Mock:**
- CSS imports (CRA handles these automatically in test environments)
- React itself

## Fixtures and Factories

**Test Data:**
- `Digits.tsx` contains inline stub data that mirrors production shape — reuse these fixtures in tests:
  ```typescript
  // From src/Digits.tsx (development stub, lines 50-81)
  const stubbedPuzzles = [
    [{ id: 0, value: 14, shown: true, selected: false }, ...],
    ...
  ];
  const stubbedTargets = [114, 660, 2146];
  ```

**Location:**
- No fixtures directory exists; test data should live in `src/__fixtures__/` or co-located in test files
- For shared fixtures, create `src/__fixtures__/digits.ts`, `src/__fixtures__/ideas.ts`, etc.

## Coverage

**Requirements:** None enforced — no coverage threshold configured

**View Coverage:**
```bash
CI=true npm test -- --coverage
```

## Test Types

**Unit Tests:**
- Appropriate for pure utility functions:
  - `applyOperation` in `src/Digits.tsx` (arithmetic logic)
  - `fmtDate` in `src/Ideas.tsx` (date formatting)
  - `cardRot` in `src/Ideas.tsx` (deterministic rotation from string)
  - `tintFor` in `src/Ideas.tsx` (color lookup)

**Integration Tests:**
- Appropriate for components with state and fetch calls:
  - `MomentumFinder` — render, mock fetch, verify game cards appear
  - `Digits` — render in development mode (NODE_ENV=development), verify stub data renders, verify number selection interaction
  - `Ideas` — render unauthenticated state, verify login button

**E2E Tests:**
- Not configured — no Cypress, Playwright, or similar framework present

## Common Patterns

**Async Testing:**
```typescript
import { render, screen, waitFor } from '@testing-library/react';

it('loads and displays games', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ games: [{ gameId: '1', team1: 'LAL', team2: 'BOS', date: 'Today' }] }),
  });
  render(<MomentumFinder />);
  await waitFor(() => expect(screen.getByText('LAL')).toBeInTheDocument());
});
```

**Testing Development Stub Mode (Digits):**
```typescript
it('renders stub puzzles in development', async () => {
  // NODE_ENV is 'test' by default in CRA; need to override or mock the branch
  render(<Digits />);
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
});
```

**Error State Testing:**
```typescript
it('shows error when API_BASE_URL is missing', () => {
  delete process.env.REACT_APP_API_BASE_URL;
  render(<MomentumFinder />);
  expect(screen.getByText(/Missing REACT_APP_API_BASE_URL/)).toBeInTheDocument();
});
```

## Notes on Current State

The test infrastructure is fully bootstrapped (jest-dom, react testing library, user-event) but **no tests have been authored**. The highest-value first tests to write are:

1. Pure utility functions (`applyOperation`, `fmtDate`, `cardRot`) — zero mocking required
2. `MomentumFinder` unauthenticated/loading/error rendering paths
3. `Digits` component with mocked axios for production path and direct render for dev path

---

*Testing analysis: 2026-05-30*
