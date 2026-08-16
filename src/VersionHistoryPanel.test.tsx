import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VersionHistoryPanel } from './VersionHistoryPanel';

beforeEach(() => {
  process.env.REACT_APP_POSTS_API_BASE_URL = 'http://test.local';
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('renders version list from the proxy route', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      versions: [
        { document_id: 'writing::hello', version_id: 'v2', content_type: 'markdown', message: 'update', created_at: '2026-01-02T00:00:00.000Z' },
        { document_id: 'writing::hello', version_id: 'v1', content_type: 'markdown', message: 'add', created_at: '2026-01-01T00:00:00.000Z' },
      ],
    }),
  });

  render(<VersionHistoryPanel section="writing" slug="hello" token={null} />);

  await waitFor(() => expect(screen.getByText('update')).toBeInTheDocument());
  expect(screen.getByText('add')).toBeInTheDocument();
});

test('selecting two versions fetches and shows a diff', async () => {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        versions: [
          { document_id: 'writing::hello', version_id: 'v2', content_type: 'markdown', message: 'update', created_at: '2026-01-02T00:00:00.000Z' },
          { document_id: 'writing::hello', version_id: 'v1', content_type: 'markdown', message: 'add', created_at: '2026-01-01T00:00:00.000Z' },
        ],
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text_diff: '-old line\n+new line', attachment_changes: [] }),
    });

  render(<VersionHistoryPanel section="writing" slug="hello" token={null} />);
  await waitFor(() => screen.getByText('update'));

  fireEvent.click(screen.getByLabelText('Compare v1 to v2'));

  await waitFor(() => expect(screen.getByText(/new line/)).toBeInTheDocument());
});
