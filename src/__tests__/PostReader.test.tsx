import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown-content">{children}</div>
  ),
}));

import PostReader from '../PostReader';

beforeEach(() => {
  process.env.REACT_APP_POSTS_API_BASE_URL = 'http://test.local';
  global.fetch = jest.fn();
});
afterEach(() => {
  jest.resetAllMocks();
});

it('renders post title, back link, and markdown body', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({
      title: 'My Post', slug: 'my-post', date: '2026-05-30',
      description: 'Desc', updatedAt: '', body: '# Hello'
    }),
  });
  render(
    <MemoryRouter initialEntries={['/posts/my-post']}>
      <Routes><Route path="/posts/:slug" element={<PostReader />} /></Routes>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText('My Post')).toBeInTheDocument());
  const backLink = screen.getByText('← Writing');
  expect(backLink.getAttribute('href')).toBe('/posts');
  expect(screen.getByTestId('markdown-content').textContent).toBe('# Hello');
});
