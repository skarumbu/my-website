import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VersionHistoryPanel, VersionHistoryClient } from './VersionHistoryPanel';

function makeClient(overrides: Partial<VersionHistoryClient> = {}): VersionHistoryClient {
  return {
    listVersions: jest.fn().mockResolvedValue([]),
    diff: jest.fn().mockResolvedValue({ text_diff: '', attachment_changes: [] }),
    ...overrides,
  };
}

test('renders version list from the injected client', async () => {
  const client = makeClient({
    listVersions: jest.fn().mockResolvedValue([
      { document_id: 'writing::hello', version_id: 'v2', content_type: 'markdown', message: 'update', author: 'me@example.com', created_at: '2026-01-02T00:00:00.000Z' },
      { document_id: 'writing::hello', version_id: 'v1', content_type: 'markdown', message: 'add', author: 'me@example.com', created_at: '2026-01-01T00:00:00.000Z' },
    ]),
  });

  render(<VersionHistoryPanel client={client} />);

  await waitFor(() => expect(screen.getByText('update')).toBeInTheDocument());
  expect(screen.getByText('add')).toBeInTheDocument();
  expect(screen.getAllByText('me@example.com')).toHaveLength(2);
});

test('showAuthor=false hides the author column (architecture versions are all machine-authored)', async () => {
  const client = makeClient({
    listVersions: jest.fn().mockResolvedValue([
      { document_id: 'architecture::digits', version_id: 'v1', content_type: 'json', message: 'backfill: initial import', author: 'machine', created_at: '2026-01-01T00:00:00.000Z' },
    ]),
  });

  render(<VersionHistoryPanel client={client} showAuthor={false} />);

  await waitFor(() => expect(screen.getByText('backfill: initial import')).toBeInTheDocument());
  expect(screen.queryByText('machine')).not.toBeInTheDocument();
});

test('selecting two versions calls client.diff and shows the result', async () => {
  const client = makeClient({
    listVersions: jest.fn().mockResolvedValue([
      { document_id: 'writing::hello', version_id: 'v2', content_type: 'markdown', message: 'update', created_at: '2026-01-02T00:00:00.000Z' },
      { document_id: 'writing::hello', version_id: 'v1', content_type: 'markdown', message: 'add', created_at: '2026-01-01T00:00:00.000Z' },
    ]),
    diff: jest.fn().mockResolvedValue({ text_diff: '-old line\n+new line', attachment_changes: [] }),
  });

  render(<VersionHistoryPanel client={client} />);
  await waitFor(() => screen.getByText('update'));

  fireEvent.click(screen.getByLabelText('Compare v1 to v2'));

  await waitFor(() => expect(screen.getByText(/new line/)).toBeInTheDocument());
  expect(client.diff).toHaveBeenCalledWith('v1', 'v2');
});

test('selecting a new version pair clears the stale diff while the new one loads', async () => {
  let resolveSecondDiff: (value: any) => void;
  const secondDiffPromise = new Promise((resolve) => {
    resolveSecondDiff = resolve;
  });

  const diffMock = jest
    .fn()
    .mockResolvedValueOnce({ text_diff: '-old line\n+first diff', attachment_changes: [] })
    .mockReturnValueOnce(secondDiffPromise);

  const client = makeClient({
    listVersions: jest.fn().mockResolvedValue([
      { document_id: 'writing::hello', version_id: 'v3', content_type: 'markdown', message: 'third', created_at: '2026-01-03T00:00:00.000Z' },
      { document_id: 'writing::hello', version_id: 'v2', content_type: 'markdown', message: 'second', created_at: '2026-01-02T00:00:00.000Z' },
      { document_id: 'writing::hello', version_id: 'v1', content_type: 'markdown', message: 'first', created_at: '2026-01-01T00:00:00.000Z' },
    ]),
    diff: diffMock,
  });

  render(<VersionHistoryPanel client={client} />);
  await waitFor(() => screen.getByText('third'));

  fireEvent.click(screen.getByLabelText('Compare v2 to v3'));
  await waitFor(() => expect(screen.getByText(/first diff/)).toBeInTheDocument());

  fireEvent.click(screen.getByLabelText('Compare v1 to v2'));
  expect(screen.queryByText(/first diff/)).not.toBeInTheDocument();

  resolveSecondDiff!({ text_diff: '-old line\n+second diff', attachment_changes: [] });
  await waitFor(() => expect(screen.getByText(/second diff/)).toBeInTheDocument());
});

test('renders nothing while loading and nothing when there are no versions', async () => {
  const client = makeClient({ listVersions: jest.fn().mockResolvedValue([]) });
  const { container } = render(<VersionHistoryPanel client={client} />);
  await waitFor(() => expect(client.listVersions).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});
