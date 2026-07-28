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
  await waitFor(() => expect(screen.getByText('1 post · 0 drafts')).toBeInTheDocument());
  expect(screen.getByText('Your posts')).toBeInTheDocument();
  expect(screen.getByText('—')).toBeInTheDocument();
});

it('no longer renders the old Writing/Diary text-tab switcher', async () => {
  sessionStorage.setItem('write_google_token', FAKE_TOKEN);
  mockFetchBySection({ writing: { ok: true, items: [] }, diary: { ok: true, items: [] } });
  render(<MemoryRouter><Write /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Your posts')).toBeInTheDocument());
  expect(screen.queryByText('Writing', { selector: '.write-section-tab' })).not.toBeInTheDocument();
});
