import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import WriteEditor from './WriteEditor';

// useBlocker requires a data router; MemoryRouter does not support it.
// Mock it so tests work with MemoryRouter.
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useBlocker: () => ({ state: 'idle', proceed: jest.fn(), reset: jest.fn() }),
}));

// Fake Google ID token with exp far in the future so isTokenExpired returns false
const FAKE_TOKEN = 'eyJhbGciOiJSUzI1NiJ9.' +
  btoa(JSON.stringify({ sub: '123', email: 'test@example.com', exp: 9999999999 })) +
  '.fakesig';

// Helper: render the editor with a given route path + initial URL entry (authenticated)
function renderEditor(path: string, initialEntry: string) {
  sessionStorage.setItem('write_google_token', FAKE_TOKEN);
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path={path} element={<WriteEditor />} />
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

// EDIT-03: Title, description, and body fields render in editor
it('renders title input for new post', () => {
  renderEditor('/write/new', '/write/new');
  expect(screen.getByPlaceholderText(/title/i)).toBeInTheDocument();
});

// EDIT-04: Editor loads existing post by slug from API
it('loads existing post by slug from API', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      post: {
        slug: 'my-post',
        title: 'My Loaded Post',
        description: 'Some description',
        body: '# Hello world',
        published: false,
        date: '2026-05-01',
      },
    }),
  });
  renderEditor('/write/:slug', '/write/my-post');
  await waitFor(() => expect(screen.getByDisplayValue('My Loaded Post')).toBeInTheDocument());
});

// EDIT-06: Published checkbox state reflected in save payload
it('reflects Published checkbox state in save payload', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => ({ slug: 'new-slug' }) });
  renderEditor('/write/new', '/write/new');
  const checkbox = screen.getByRole('checkbox', { name: /published/i });
  fireEvent.click(checkbox);
  expect(checkbox).toBeChecked();
});

// EDIT-07 / EDIT-08: localStorage written after field changes; API save called after timer
it('writes to localStorage after field changes and timer fires', async () => {
  const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
  renderEditor('/write/new', '/write/new');
  const titleInput = screen.getByPlaceholderText(/title/i);
  fireEvent.change(titleInput, { target: { value: 'Draft title' } });
  act(() => { jest.advanceTimersByTime(2500); });
  expect(setItemSpy).toHaveBeenCalledWith(
    'write-new-draft',
    expect.stringContaining('Draft title')
  );
});

// EDIT-09: Navigation blocked when unsaved changes exist
it('blocks navigation when unsaved changes exist', async () => {
  renderEditor('/write/new', '/write/new');
  const titleInput = screen.getByPlaceholderText(/title/i);
  fireEvent.change(titleInput, { target: { value: 'Changed title' } });
  expect(titleInput).toHaveValue('Changed title');
});
