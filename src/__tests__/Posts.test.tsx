import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Posts from '../Posts';

beforeEach(() => {
  process.env.REACT_APP_POSTS_API_BASE_URL = 'http://test.local';
  global.fetch = jest.fn();
});
afterEach(() => {
  jest.resetAllMocks();
});

it('renders post list rows with title, date, and description', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({
      posts: [{ title: 'Hello World', slug: 'hello-world', date: '2026-05-30', description: 'A first post', updatedAt: '' }]
    }),
  });
  render(<MemoryRouter><Posts /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Hello World')).toBeInTheDocument());
  expect(screen.getByText('A first post')).toBeInTheDocument();
  const link = screen.getByRole('link', { name: /Hello World/i });
  expect(link.getAttribute('href')).toBe('/posts/hello-world');
});

it('shows empty-state message when posts array is empty', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ posts: [] }),
  });
  render(<MemoryRouter><Posts /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('No posts yet. Check back soon.')).toBeInTheDocument());
});
