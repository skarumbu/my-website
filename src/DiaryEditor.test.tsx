import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import DiaryEditor from './DiaryEditor';

// useBlocker requires a data router; MemoryRouter does not support it.
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useBlocker: () => ({ state: 'idle', proceed: jest.fn(), reset: jest.fn() }),
}));

function makeToken(exp: number): string {
  const header = btoa(JSON.stringify({ alg: 'RS256' }));
  const payload = btoa(JSON.stringify({ sub: '123', email: 'test@example.com', exp }));
  return `${header}.${payload}.fakesig`;
}

const FRESH_TOKEN = makeToken(Math.floor(Date.now() / 1000) + 3600);
// Expires 5s after "now" — valid enough to authenticate on mount (the real
// long-idle-tab scenario), then crossed by advancing the fake clock, rather
// than already expired at mount, which the restore effect would reject and
// never render the editor at all.
const SOON_TO_EXPIRE_TOKEN = makeToken(Math.floor(Date.now() / 1000) + 5);

function renderEditor(path: string, initialEntry: string, token = FRESH_TOKEN) {
  sessionStorage.setItem('write_google_token', token);
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path={path} element={<DiaryEditor />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  process.env.REACT_APP_POSTS_API_BASE_URL = 'http://test.local';
  global.fetch = jest.fn();
  sessionStorage.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  sessionStorage.clear();
});

// Regression test for: "save says it failed, but a re-check shows
// everything saved" — root cause was attempting a save with a token that
// had already quietly expired in a long-idle tab, which produced the
// generic "Save failed... try again" message instead of a clear prompt
// to re-authenticate.
it('shows the re-auth banner instead of a generic save-failed message when the tab has been idle long enough for the token to expire', async () => {
  renderEditor('/diary/new', '/diary/new', SOON_TO_EXPIRE_TOKEN);
  await waitFor(() => expect(screen.getByPlaceholderText(/title/i)).toBeInTheDocument());

  // Simulate the tab sitting open past the token's lifetime.
  act(() => { jest.advanceTimersByTime(10000); });

  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

  expect(await screen.findByText(/session expired/i)).toBeInTheDocument();
  expect(screen.queryByText(/save failed/i)).not.toBeInTheDocument();
  // The whole point: no network round trip was wasted on a token we
  // already knew was unusable.
  expect(global.fetch).not.toHaveBeenCalled();
});

// A rarer race — token looked fresh client-side but the server rejects it
// anyway (clock skew, early revocation). Should still land on the inline
// banner, not a full sign-out or the generic failure message.
it('shows the re-auth banner (not a generic failure) when the server returns 401 on save', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
  renderEditor('/diary/new', '/diary/new');
  await waitFor(() => expect(screen.getByPlaceholderText(/title/i)).toBeInTheDocument());

  fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'My entry' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
  });

  expect(await screen.findByText(/session expired/i)).toBeInTheDocument();
  expect(screen.queryByText(/save failed/i)).not.toBeInTheDocument();
  // Unlike the old signOut()-on-401 behavior, the title field (and the
  // rest of the draft) should still be visible and editable.
  expect(screen.getByDisplayValue('My entry')).toBeInTheDocument();
});

it('saves normally when the token is valid', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => ({ slug: 'new-entry' }) });
  renderEditor('/diary/new', '/diary/new');
  await waitFor(() => expect(screen.getByPlaceholderText(/title/i)).toBeInTheDocument());

  fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'My entry' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
  });

  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/session expired/i)).not.toBeInTheDocument();
});
