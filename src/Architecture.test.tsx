import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Architecture from './Architecture';
import * as historyApi from './architecture/historyApi';
import type { Page, PackagePage } from './architecture/pageTypes';

jest.mock('./architecture/historyApi');
// PageDetail pulls in a lot (LinkedText, VersionHistoryPanel, the whole
// resolvePage() fixture machinery) that isn't this file's concern — the
// index-view tests only need to know PageDetail was reached with the right key.
jest.mock('./architecture/PageDetail', () => ({
  __esModule: true,
  default: ({ pageKey }: { pageKey: string }) => <div>PageDetail:{pageKey}</div>,
}));
// ArchDiagram (@xyflow/react) needs a ResizeObserver jsdom doesn't provide —
// irrelevant to what this file tests (the index fetch/loading/error states).
jest.mock('./architecture/ArchDiagram', () => ({
  __esModule: true,
  default: () => <div>ArchDiagram</div>,
}));

const mocked = historyApi as jest.Mocked<typeof historyApi>;

const digitsPage: PackagePage = {
  key: 'digits',
  title: 'digits',
  role: 'Puzzle generator',
  description: 'Generates puzzles.',
  relatedPages: [],
  runsOn: 'Azure Functions v2',
  repoUrl: 'https://github.com/skarumbu/digits',
  techStack: ['Python'],
  pipeline: [{ label: 'deploy' }],
};

const authPage: Page = {
  key: 'authentication',
  title: 'Authentication',
  summary: 'How auth works.',
  description: 'Auth overview.',
  relatedPages: [],
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Architecture />
    </MemoryRouter>,
  );
}

afterEach(() => {
  jest.resetAllMocks();
});

test('shows a loading state, then the index with packages and topics split correctly', async () => {
  mocked.listPages.mockResolvedValue([
    { slug: 'digits', latest_version_id: 'v1', content_type: 'json', visibility: 'public' },
    { slug: 'authentication', latest_version_id: 'v1', content_type: 'json', visibility: 'public' },
  ]);
  mocked.getPage.mockImplementation(async (key: string) => (key === 'digits' ? digitsPage : authPage));

  renderAt('/architecture');

  expect(screen.getByText('Loading…')).toBeInTheDocument();

  await waitFor(() => expect(screen.getAllByText('digits').length).toBeGreaterThan(0));
  expect(screen.getByText('Puzzle generator')).toBeInTheDocument();
  expect(screen.getByText('How auth works.')).toBeInTheDocument();
});

test('shows an error banner when the index fetch fails, no stale/fallback content', async () => {
  mocked.listPages.mockRejectedValue(new Error('history-api /sections/architecture/documents -> 500'));

  renderAt('/architecture');

  await waitFor(() => expect(screen.getByText(/Failed to load the architecture wiki/)).toBeInTheDocument());
  expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
});

test('a direct ?page= link renders PageDetail without fetching the index', async () => {
  renderAt('/architecture?page=digits');

  expect(await screen.findByText('PageDetail:digits')).toBeInTheDocument();
  expect(mocked.listPages).not.toHaveBeenCalled();
});

test('clicking a package row in the index navigates into PageDetail', async () => {
  mocked.listPages.mockResolvedValue([
    { slug: 'digits', latest_version_id: 'v1', content_type: 'json', visibility: 'public' },
  ]);
  mocked.getPage.mockResolvedValue(digitsPage);

  renderAt('/architecture');

  const row = await screen.findByText('digits', { selector: 'code' });
  fireEvent.click(row);

  expect(await screen.findByText('PageDetail:digits')).toBeInTheDocument();
});
