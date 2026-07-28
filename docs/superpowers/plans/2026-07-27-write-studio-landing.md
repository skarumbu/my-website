# Write/Diary Studio Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/write` into a landing page for both the Writing and Diary sections — two summary cards (counts + quick-create) and a merged recent-activity strip — while keeping the existing post list on the same page and leaving `/diary` untouched.

**Architecture:** A new presentational component (`StudioSummary`) renders the two cards and the recent-activity merge from props; `Write.tsx` gains a second data fetch (diary items, parallel to its existing posts fetch) and passes both datasets into `StudioSummary`, replacing the old text-tab switcher. `Diary.tsx` is not modified.

**Tech Stack:** Create React App (TypeScript), react-router-dom (plain `<a href>` navigation, matching existing convention — this codebase does not use `<Link>`), Jest + React Testing Library (`@testing-library/react`, `@testing-library/jest-dom`), CSS Modules-free plain CSS files per page/component under `src/styling/`.

## Global Constraints

- No new routes — `/write`, `/diary`, and their sub-routes are unchanged.
- Follow existing design tokens from `src/styling/private-theme.css` (`--ink`, `--ink-2`, `--ink-3`, `--paper`, `--bg-1`, `--line`, `--accent`, `--accent-dk`, `--good`, `--c-*`/`--c-*-ink` pairs). Do not introduce new colors.
- Match existing navigation convention: plain `<a href="...">` for links, `useNavigate()` + `onClick` for programmatic navigation (e.g. button clicks) — this is what `Write.tsx`/`Diary.tsx` already do.
- Match existing component style: functional components, hooks, no class components.
- Tests run via `npm test` (CRA's Jest runner). Existing tests live beside the file they test (`src/Write.test.tsx`) or under `src/__tests__/`; follow whichever convention the file you're testing already uses. `Write.test.tsx` already exists beside `Write.tsx` — keep extending that one.
- `Diary.tsx`, `DiaryEditor.tsx`, `DiaryViewer.tsx`, and `diary.css` are out of scope — do not modify them.

---

### Task 1: `Post` type extraction + `StudioSummary` component

**Files:**
- Create: `src/lib/writeTypes.ts`
- Create: `src/components/StudioSummary.tsx`
- Create: `src/styling/studio-summary.css`
- Test: `src/components/StudioSummary.test.tsx`

**Interfaces:**
- Produces: `Post` interface (`src/lib/writeTypes.ts`) — `{ slug: string; title: string; description: string; date: string; published: boolean; updatedAt?: string; }`. This mirrors the `Post` interface currently declared inline in `Write.tsx` (lines 10-17) — Task 2 will delete that inline copy and import from here instead, so the shape here must match exactly.
- Produces: `StudioSummary` default export, a React component with props `{ posts: Post[]; diaryEntries: DiaryEntry[]; diaryLoading: boolean; diaryError: boolean; onNewPost: () => void; onNewEntry: () => void; }`.
- Produces: `buildRecentItems(posts: Post[], diaryEntries: DiaryEntry[], diaryError: boolean): RecentItem[]` — named export from `StudioSummary.tsx`, used directly by its own tests and available for Task 3 if needed.
- Consumes: `DiaryEntry` from `src/lib/diaryTypes.ts` (already exists — `{ slug: string; title: string; date: string; updatedAt?: string; blocks: Block[]; }`).

- [ ] **Step 1: Create the shared `Post` type**

Create `src/lib/writeTypes.ts`:

```typescript
export interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
  published: boolean;
  updatedAt?: string;
}
```

- [ ] **Step 2: Write the failing tests for `StudioSummary`**

Create `src/components/StudioSummary.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import StudioSummary, { buildRecentItems } from './StudioSummary';
import { Post } from '../lib/writeTypes';
import { DiaryEntry } from '../lib/diaryTypes';

const posts: Post[] = [
  { slug: 'a', title: 'Post A', description: '', date: '2026-07-20', published: true },
  { slug: 'b', title: 'Post B', description: '', date: '2026-07-25', published: false },
];

const diaryEntries: DiaryEntry[] = [
  { slug: 'd1', title: 'Entry One', date: '2026-07-24', blocks: [] },
  { slug: 'd2', title: 'Entry Two', date: '2026-07-26', blocks: [] },
  { slug: 'd3', title: 'Entry Three', date: '2026-07-10', blocks: [] },
];

const noop = () => {};

describe('buildRecentItems', () => {
  it('merges posts and diary entries sorted by date descending, capped at 3', () => {
    const items = buildRecentItems(posts, diaryEntries, false);
    expect(items).toHaveLength(3);
    expect(items.map(i => i.slug)).toEqual(['d2', 'b', 'd1']);
  });

  it('excludes diary entries when diaryError is true', () => {
    const items = buildRecentItems(posts, diaryEntries, true);
    expect(items.every(i => i.type === 'writing')).toBe(true);
    expect(items.map(i => i.slug)).toEqual(['b', 'a']);
  });
});

describe('StudioSummary', () => {
  it('shows post and draft counts on the Writing card', () => {
    render(
      <StudioSummary
        posts={posts}
        diaryEntries={diaryEntries}
        diaryLoading={false}
        diaryError={false}
        onNewPost={noop}
        onNewEntry={noop}
      />
    );
    expect(screen.getByText('2 posts · 1 draft')).toBeInTheDocument();
  });

  it('shows entry count on the Diary card', () => {
    render(
      <StudioSummary
        posts={posts}
        diaryEntries={diaryEntries}
        diaryLoading={false}
        diaryError={false}
        onNewPost={noop}
        onNewEntry={noop}
      />
    );
    expect(screen.getByText('3 entries')).toBeInTheDocument();
  });

  it('shows a loading label on the Diary card while diary is loading', () => {
    render(
      <StudioSummary
        posts={posts}
        diaryEntries={[]}
        diaryLoading={true}
        diaryError={false}
        onNewPost={noop}
        onNewEntry={noop}
      />
    );
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('degrades gracefully when the diary fetch failed', () => {
    render(
      <StudioSummary
        posts={posts}
        diaryEntries={[]}
        diaryLoading={false}
        diaryError={true}
        onNewPost={noop}
        onNewEntry={noop}
      />
    );
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('2 posts · 1 draft')).toBeInTheDocument();
  });

  it('calls onNewPost when the Writing card button is clicked', () => {
    const onNewPost = jest.fn();
    render(
      <StudioSummary
        posts={posts}
        diaryEntries={diaryEntries}
        diaryLoading={false}
        diaryError={false}
        onNewPost={onNewPost}
        onNewEntry={noop}
      />
    );
    screen.getByRole('button', { name: '+ New Post' }).click();
    expect(onNewPost).toHaveBeenCalledTimes(1);
  });

  it('calls onNewEntry (not navigation) when the Diary card button is clicked', () => {
    const onNewEntry = jest.fn();
    render(
      <StudioSummary
        posts={posts}
        diaryEntries={diaryEntries}
        diaryLoading={false}
        diaryError={false}
        onNewPost={noop}
        onNewEntry={onNewEntry}
      />
    );
    screen.getByRole('button', { name: '+ New Entry' }).click();
    expect(onNewEntry).toHaveBeenCalledTimes(1);
  });

  it('links the Diary card to /diary', () => {
    render(
      <StudioSummary
        posts={posts}
        diaryEntries={diaryEntries}
        diaryLoading={false}
        diaryError={false}
        onNewPost={noop}
        onNewEntry={noop}
      />
    );
    expect(screen.getByText('📔 Diary').closest('a')).toHaveAttribute('href', '/diary');
  });

  it('renders recent items linking to the right page per type', () => {
    render(
      <StudioSummary
        posts={posts}
        diaryEntries={diaryEntries}
        diaryLoading={false}
        diaryError={false}
        onNewPost={noop}
        onNewEntry={noop}
      />
    );
    expect(screen.getByText('Entry Two').closest('a')).toHaveAttribute('href', '/diary/d2');
    expect(screen.getByText('Post B').closest('a')).toHaveAttribute('href', '/write/b');
  });

  it('omits the recent section entirely when there is nothing to show', () => {
    render(
      <StudioSummary
        posts={[]}
        diaryEntries={[]}
        diaryLoading={false}
        diaryError={false}
        onNewPost={noop}
        onNewEntry={noop}
      />
    );
    expect(screen.queryByText('Recent across both')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx cross-env CI=true npx react-scripts test src/components/StudioSummary.test.tsx --watchAll=false`
Expected: FAIL — `Cannot find module './StudioSummary'` (component doesn't exist yet).

- [ ] **Step 4: Implement `StudioSummary`**

Create `src/components/StudioSummary.tsx`:

```tsx
import React from 'react';
import { Post } from '../lib/writeTypes.ts';
import { DiaryEntry } from '../lib/diaryTypes.ts';
import '../styling/studio-summary.css';

interface RecentItem {
  type: 'writing' | 'diary';
  slug: string;
  title: string;
  date: string;
  published?: boolean;
}

export function buildRecentItems(
  posts: Post[],
  diaryEntries: DiaryEntry[],
  diaryError: boolean
): RecentItem[] {
  const writingItems: RecentItem[] = posts.map(p => ({
    type: 'writing',
    slug: p.slug,
    title: p.title,
    date: p.date,
    published: p.published,
  }));
  const diaryItems: RecentItem[] = diaryError
    ? []
    : diaryEntries.map(e => ({
        type: 'diary',
        slug: e.slug,
        title: e.title,
        date: e.date,
      }));
  return [...writingItems, ...diaryItems]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
}

interface StudioSummaryProps {
  posts: Post[];
  diaryEntries: DiaryEntry[];
  diaryLoading: boolean;
  diaryError: boolean;
  onNewPost: () => void;
  onNewEntry: () => void;
}

function StudioSummary({
  posts,
  diaryEntries,
  diaryLoading,
  diaryError,
  onNewPost,
  onNewEntry,
}: StudioSummaryProps) {
  const draftCount = posts.filter(p => !p.published).length;
  const diaryCountLabel = diaryLoading
    ? 'Loading…'
    : diaryError
    ? '—'
    : `${diaryEntries.length} ${diaryEntries.length === 1 ? 'entry' : 'entries'}`;
  const recentItems = buildRecentItems(posts, diaryEntries, diaryError);

  return (
    <div className="studio-summary">
      <div className="studio-summary-row">
        <div className="studio-card">
          <div className="studio-card-top">
            <h2 className="studio-card-title">✍️ Writing</h2>
            <span className="studio-card-badge studio-card-badge-public">Public</span>
          </div>
          <p className="studio-card-count">
            {posts.length} {posts.length === 1 ? 'post' : 'posts'} · {draftCount}{' '}
            {draftCount === 1 ? 'draft' : 'drafts'}
          </p>
          <button className="studio-card-cta" onClick={onNewPost}>
            + New Post
          </button>
        </div>

        <a className="studio-card studio-card-link" href="/diary">
          <div className="studio-card-top">
            <h2 className="studio-card-title">📔 Diary</h2>
            <span className="studio-card-badge studio-card-badge-private">Private</span>
          </div>
          <p className="studio-card-count">{diaryCountLabel}</p>
          <button
            className="studio-card-cta"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onNewEntry();
            }}
          >
            + New Entry
          </button>
        </a>
      </div>

      {recentItems.length > 0 && (
        <div className="studio-recent">
          <span className="studio-recent-label">Recent across both</span>
          <ul className="studio-recent-list">
            {recentItems.map(item => (
              <li key={`${item.type}-${item.slug}`} className="studio-recent-item">
                <a
                  className="studio-recent-link"
                  href={item.type === 'writing' ? `/write/${item.slug}` : `/diary/${item.slug}`}
                >
                  <span className="studio-recent-title">{item.title}</span>
                  <span className="studio-recent-meta">
                    {item.type === 'writing' ? 'Writing' : 'Diary'}
                    {item.type === 'writing' && (item.published ? ' · Published' : ' · Draft')}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default StudioSummary;
```

- [ ] **Step 5: Create the stylesheet (visual only — no test asserts on styles)**

Create `src/styling/studio-summary.css`:

```css
.studio-summary {
  margin-bottom: 32px;
}

.studio-summary-row {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.studio-card {
  flex: 1;
  background: var(--paper);
  border-radius: 14px;
  padding: 18px 20px;
  box-shadow:
    0 3px 0 rgba(58, 36, 24, 0.10),
    0 8px 18px rgba(58, 36, 24, 0.08);
  text-decoration: none;
  color: inherit;
  display: block;
}

a.studio-card-link {
  transition: transform 180ms ease, box-shadow 180ms ease;
}

a.studio-card-link:hover {
  transform: translateY(-2px);
  box-shadow:
    0 5px 0 rgba(58, 36, 24, 0.12),
    0 12px 24px rgba(58, 36, 24, 0.12);
}

.studio-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.studio-card-title {
  font-family: 'Fraunces', serif;
  font-size: 17px;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
}

.studio-card-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.studio-card-badge-public {
  background: rgba(79, 168, 110, 0.15);
  color: var(--good);
}

.studio-card-badge-private {
  background: var(--c-lilac);
  color: var(--c-lilac-ink);
}

.studio-card-count {
  font-size: 13px;
  color: var(--ink-3);
  margin: 8px 0 12px;
}

.studio-card-cta {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  box-shadow: 0 3px 0 var(--accent-dk);
  transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
}

.studio-card-cta:hover {
  background: var(--accent-dk);
}

.studio-card-cta:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 var(--accent-dk);
}

.studio-recent-label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--ink-3);
  margin-bottom: 8px;
}

.studio-recent-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.studio-recent-item {
  border-bottom: 1px solid var(--line);
}

.studio-recent-link {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  text-decoration: none;
  color: var(--ink);
}

.studio-recent-link:hover .studio-recent-title {
  text-decoration: underline;
}

.studio-recent-title {
  font-family: 'Fraunces', serif;
  font-size: 15px;
  font-weight: 600;
}

.studio-recent-meta {
  font-size: 12px;
  color: var(--ink-3);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  a.studio-card-link,
  .studio-card-cta {
    transition: none;
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx cross-env CI=true npx react-scripts test src/components/StudioSummary.test.tsx --watchAll=false`
Expected: PASS — all tests in `StudioSummary.test.tsx` green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/writeTypes.ts src/components/StudioSummary.tsx src/components/StudioSummary.test.tsx src/styling/studio-summary.css
git commit -m "feat: add StudioSummary component for write/diary landing cards"
```

---

### Task 2: Wire `StudioSummary` into `Write.tsx`

**Files:**
- Modify: `src/Write.tsx`
- Test: `src/Write.test.tsx`

**Interfaces:**
- Consumes: `Post` from `src/lib/writeTypes.ts` (Task 1), `StudioSummary` default export + props shape from `src/components/StudioSummary.tsx` (Task 1), `DiaryEntry` from `src/lib/diaryTypes.ts` (pre-existing), `sectionUrl` from `src/lib/postsApi.ts` (pre-existing — `sectionUrl('diary')` returns the diary items endpoint).
- Produces: nothing new consumed elsewhere — this is the final integration point for this feature.

- [ ] **Step 1: Write the failing tests**

Modify `src/Write.test.tsx` — replace its full contents with:

```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Write from './Write';

// Fake Google ID token with exp far in the future so isTokenExpired returns false
const FAKE_TOKEN = 'eyJhbGciOiJSUzI1NiJ9.' +
  btoa(JSON.stringify({ sub: '123', email: 'test@example.com', exp: 9999999999 })) +
  '.fakesig';

function mockFetchBySection(bySection: Record<string, { ok: boolean; status?: number; items?: any[] }>) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    const section = url.includes('/sections/diary/') ? 'diary' : 'writing';
    const config = bySection[section] ?? { ok: true, items: [] };
    if (!config.ok) {
      return Promise.resolve({ ok: false, status: config.status ?? 500, json: async () => ({}) });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ items: config.items ?? [] }) });
  });
}

beforeEach(() => {
  process.env.REACT_APP_POSTS_API_BASE_URL = 'http://test.local';
  global.fetch = jest.fn();
  sessionStorage.clear();
});

afterEach(() => {
  jest.resetAllMocks();
  sessionStorage.clear();
});

it('shows login prompt when unauthenticated', () => {
  render(<MemoryRouter><Write /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: /sign in to write/i })).toBeInTheDocument();
});

it('renders Your posts heading when authenticated and posts loaded', async () => {
  sessionStorage.setItem('write_google_token', FAKE_TOKEN);
  mockFetchBySection({ writing: { ok: true, items: [] }, diary: { ok: true, items: [] } });
  render(<MemoryRouter><Write /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Your posts')).toBeInTheDocument());
});

it('shows studio summary counts for both posts and diary entries', async () => {
  sessionStorage.setItem('write_google_token', FAKE_TOKEN);
  mockFetchBySection({
    writing: {
      ok: true,
      items: [
        { slug: 'a', title: 'Post A', description: '', date: '2026-07-20', published: true },
        { slug: 'b', title: 'Post B', description: '', date: '2026-07-25', published: false },
      ],
    },
    diary: {
      ok: true,
      items: [
        { slug: 'd1', title: 'Entry One', date: '2026-07-24' },
        { slug: 'd2', title: 'Entry Two', date: '2026-07-26' },
      ],
    },
  });
  render(<MemoryRouter><Write /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('2 posts · 1 draft')).toBeInTheDocument());
  expect(screen.getByText('2 entries')).toBeInTheDocument();
});

it('degrades gracefully when the diary fetch fails, without breaking the posts list', async () => {
  sessionStorage.setItem('write_google_token', FAKE_TOKEN);
  mockFetchBySection({
    writing: {
      ok: true,
      items: [{ slug: 'a', title: 'Post A', description: '', date: '2026-07-20', published: true }],
    },
    diary: { ok: false, status: 500 },
  });
  render(<MemoryRouter><Write /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Your posts')).toBeInTheDocument());
  expect(screen.getByText('1 post · 0 drafts')).toBeInTheDocument();
  expect(screen.getByText('—')).toBeInTheDocument();
});

it('no longer renders the old Writing/Diary text-tab switcher', async () => {
  sessionStorage.setItem('write_google_token', FAKE_TOKEN);
  mockFetchBySection({ writing: { ok: true, items: [] }, diary: { ok: true, items: [] } });
  render(<MemoryRouter><Write /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Your posts')).toBeInTheDocument());
  expect(screen.queryByText('Writing', { selector: '.write-section-tab' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx cross-env CI=true npx react-scripts test src/Write.test.tsx --watchAll=false`
Expected: FAIL — `2 entries` / `— ` / studio card text not found (Write.tsx doesn't fetch or render diary data yet), and the last test may currently pass (switcher still present) or fail depending on current markup — either way, at least the summary-count assertions fail.

- [ ] **Step 3: Modify `Write.tsx`**

Replace lines 1-17 (imports and the local `Post` interface) — old:

```tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from './components/nav-bar.tsx';
import Spinner from './components/Spinner.tsx';
import { sectionUrl, isApiConfigured } from './lib/postsApi.ts';
import { useGoogleAuth } from './lib/useGoogleAuth.ts';
import './styling/private-theme.css';
import './styling/write.css';

interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
  published: boolean;
  updatedAt?: string;
}
```

new:

```tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from './components/nav-bar.tsx';
import Spinner from './components/Spinner.tsx';
import StudioSummary from './components/StudioSummary.tsx';
import { sectionUrl, isApiConfigured } from './lib/postsApi.ts';
import { useGoogleAuth } from './lib/useGoogleAuth.ts';
import { Post } from './lib/writeTypes.ts';
import { DiaryEntry } from './lib/diaryTypes.ts';
import './styling/private-theme.css';
import './styling/write.css';
```

Replace the state/effect block (old lines 19-53, `function Write()` through the end of the posts-loading `useEffect`) — old:

```tsx
function Write() {
  const navigate = useNavigate();
  const { authState, googleToken, googleBtnRef, signOut } = useGoogleAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load posts when authenticated
  useEffect(() => {
    if (authState !== 'authenticated') return;
    if (!isApiConfigured()) {
      setError('REACT_APP_POSTS_API_BASE_URL is not configured');
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(sectionUrl('writing'), {
          headers: { Authorization: `Bearer ${googleToken!}` },
        });
        if (res.status === 401) {
          signOut();
          return;
        }
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        setPosts(json.items ?? []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [authState]); // eslint-disable-line react-hooks/exhaustive-deps
```

new:

```tsx
function Write() {
  const navigate = useNavigate();
  const { authState, googleToken, googleBtnRef, signOut } = useGoogleAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diaryError, setDiaryError] = useState(false);

  // Load posts when authenticated
  useEffect(() => {
    if (authState !== 'authenticated') return;
    if (!isApiConfigured()) {
      setError('REACT_APP_POSTS_API_BASE_URL is not configured');
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(sectionUrl('writing'), {
          headers: { Authorization: `Bearer ${googleToken!}` },
        });
        if (res.status === 401) {
          signOut();
          return;
        }
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        setPosts(json.items ?? []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [authState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load diary entries alongside posts, for the studio summary cards. Kept
  // in its own error/loading state so a diary outage never blocks or
  // clears the posts list above.
  useEffect(() => {
    if (authState !== 'authenticated') return;
    if (!isApiConfigured()) {
      setDiaryError(true);
      return;
    }
    setDiaryLoading(true);
    setDiaryError(false);
    (async () => {
      try {
        const res = await fetch(sectionUrl('diary'), {
          headers: { Authorization: `Bearer ${googleToken!}` },
        });
        if (res.status === 401) {
          signOut();
          return;
        }
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        setDiaryEntries(json.items ?? []);
      } catch {
        setDiaryError(true);
      } finally {
        setDiaryLoading(false);
      }
    })();
  }, [authState]); // eslint-disable-line react-hooks/exhaustive-deps
```

Replace the section-switcher JSX (old lines 98-101) — old:

```tsx
        <div className="write-section-switcher">
          <span className="write-section-tab write-section-tab-active">Writing</span>
          <a className="write-section-tab" href="/diary">Diary</a>
        </div>
```

new:

```tsx
        <StudioSummary
          posts={posts}
          diaryEntries={diaryEntries}
          diaryLoading={diaryLoading}
          diaryError={diaryError}
          onNewPost={() => navigate('/write/new')}
          onNewEntry={() => navigate('/diary/new')}
        />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx cross-env CI=true npx react-scripts test src/Write.test.tsx --watchAll=false`
Expected: PASS — all tests in `Write.test.tsx` green.

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npx cross-env CI=true npx react-scripts test --watchAll=false`
Expected: PASS — no other test file imports the removed inline `Post` interface or the old switcher markup, so nothing else should break. If `WriteEditor.test.tsx` or others fail, investigate before proceeding — do not skip failures.

- [ ] **Step 6: Commit**

```bash
git add src/Write.tsx src/Write.test.tsx
git commit -m "feat: wire StudioSummary into Write.tsx, fetch diary data alongside posts"
```

---

### Task 3: Clean up dead CSS and manually verify

**Files:**
- Modify: `src/styling/write.css`

**Interfaces:**
- Consumes: none (pure cleanup + manual verification).
- Produces: none.

- [ ] **Step 1: Remove the now-unused switcher styles from `write.css`**

`Write.tsx` no longer renders any element with class `write-section-switcher` or `write-section-tab*` (Task 2 replaced that markup with `<StudioSummary />`). `Diary.tsx` still uses this exact block, but it keeps its own independent copy in `src/styling/diary.css` (per the comment already in that file: "Duplicated (not imported) because this page never loads write.css directly") — so removing it from `write.css` does not affect `/diary`.

Delete lines 15-49 of `src/styling/write.css` (the comment header, `.write-section-switcher`, `.write-section-tab`, `.write-section-tab:hover`, `.write-section-tab-active` rules, and the blank line right before `.write-header-row`) — old:

```css
/* ── Writing / Diary switcher — two folder tabs sitting on the page.
   The active tab is pulled forward (raised, full shadow); the inactive
   tab recedes flush against the line below it. */
.write-section-switcher {
  display: flex;
  gap: 6px;
  margin-bottom: 28px;
}

.write-section-tab {
  font-family: 'Caprasimo', serif;
  font-size: 15px;
  letter-spacing: -0.01em;
  color: var(--ink-3);
  text-decoration: none;
  padding: 9px 20px 11px;
  border-radius: 12px 12px 4px 4px;
  background: rgba(255, 255, 255, 0.4);
  transition: transform 160ms ease, background 160ms ease, box-shadow 160ms ease, color 160ms ease;
}

.write-section-tab:hover {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.75);
}

.write-section-tab-active {
  color: var(--ink);
  background: var(--paper);
  box-shadow:
    0 3px 0 rgba(58, 36, 24, 0.12),
    0 8px 16px rgba(58, 36, 24, 0.08);
  transform: translateY(-2px);
}

```

new: (removed — file continues directly with `.write-header-row`)

Also remove `.write-section-tab` and `.write-new-btn` from the `@media (prefers-reduced-motion: reduce)` block near the end of the file — old:

```css
@media (prefers-reduced-motion: reduce) {
  .write-section-tab,
  .write-new-btn {
    transition: none;
  }
}
```

new:

```css
@media (prefers-reduced-motion: reduce) {
  .write-new-btn {
    transition: none;
  }
}
```

- [ ] **Step 2: Run the full test suite once more**

Run: `npx cross-env CI=true npx react-scripts test --watchAll=false`
Expected: PASS — CSS-only change, no test should be affected.

- [ ] **Step 3: Manually verify in the running app**

Run: `npm start` (if not already running — check with `netstat -ano | grep ":3000"` first on Windows, since the dev server is often already up).

In a browser:
1. Navigate to `http://localhost:3000/write`, sign in with Google if prompted.
2. Confirm the two summary cards render: "✍️ Writing" with a green "Public" badge and a post/draft count, and "📔 Diary" with a purple "Private" badge and an entry count.
3. Confirm "Recent across both" appears below the cards (if you have both posts and diary entries) and that clicking an item navigates to the right editor/viewer.
4. Click "+ New Post" on the Writing card — confirm it navigates to `/write/new`.
5. Click "+ New Entry" on the Diary card — confirm it navigates to `/diary/new` (not `/diary`, i.e. the button click did not just follow the card's own link).
6. Click anywhere else on the Diary card (not the button) — confirm it navigates to `/diary`.
7. Confirm the existing "Your posts" list still renders unchanged below the new cards.
8. Navigate to `http://localhost:3000/diary` — confirm it looks exactly as it did before (tab switcher + entry list), unaffected by this change.

- [ ] **Step 4: Commit**

```bash
git add src/styling/write.css
git commit -m "chore: remove dead write-section-switcher styles from write.css"
```
