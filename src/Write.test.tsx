import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import Write from './Write';

beforeEach(() => {
  process.env.REACT_APP_POSTS_API_BASE_URL = 'http://test.local';
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

it('shows login prompt when unauthenticated', () => {
  (useIsAuthenticated as jest.Mock).mockReturnValue(false);
  render(<MemoryRouter><Write /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: /sign in to write/i })).toBeInTheDocument();
});

it('renders Your posts heading when authenticated and posts loaded', async () => {
  (useIsAuthenticated as jest.Mock).mockReturnValue(true);
  (useMsal as jest.Mock).mockReturnValue({
    instance: {
      acquireTokenSilent: jest.fn().mockResolvedValue({ accessToken: 'tok' }),
      acquireTokenRedirect: jest.fn(),
      loginRedirect: jest.fn(),
    },
    inProgress: 'none',
    accounts: [{ username: 'test@example.com' }],
  });
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ posts: [] }),
  });
  render(<MemoryRouter><Write /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Your posts')).toBeInTheDocument());
});
