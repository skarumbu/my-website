import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Write from './Write';

// Fake Google ID token with exp far in the future so isTokenExpired returns false
const FAKE_TOKEN = 'eyJhbGciOiJSUzI1NiJ9.' +
  btoa(JSON.stringify({ sub: '123', email: 'test@example.com', exp: 9999999999 })) +
  '.fakesig';

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
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ posts: [] }),
  });
  render(<MemoryRouter><Write /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Your posts')).toBeInTheDocument());
});
