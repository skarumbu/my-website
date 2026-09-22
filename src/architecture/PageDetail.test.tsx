import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PageDetail, { resolvePage } from './PageDetail';
import * as historyApi from './historyApi';

// PageDetail now fetches its content from history-api at runtime instead of
// calling resolvePage() directly (see the migration design doc). resolvePage()
// itself is unchanged and still the source of truth for what history-api's
// content *should* be (it's what scripts/gen-arch-fixtures.mjs pins against),
// so it doubles as realistic mock data here — these tests exercise the same
// rendering they always did, just via a mocked fetch instead of a static import.
jest.mock('./historyApi');

const mocked = historyApi as jest.Mocked<typeof historyApi>;

beforeEach(() => {
  mocked.getCachedPage.mockReturnValue(undefined);
  mocked.getPage.mockImplementation(async (key: string) => {
    const page = resolvePage(key);
    if (!page) throw new Error(`no page for ${key}`);
    return page;
  });
  mocked.listVersions.mockResolvedValue([]);
  mocked.diff.mockResolvedValue({ text_diff: '', attachment_changes: [] });
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('PageDetail — package pages', () => {
  it('renders a package page with role, description, tech stack, and CI/CD', async () => {
    render(<PageDetail pageKey="digits" onBack={() => {}} onSelectPage={() => {}} />);
    await waitFor(() => expect(screen.getByText('digits')).toBeInTheDocument());
    expect(screen.getByText('Generates and serves daily Digits puzzles')).toBeInTheDocument();
    expect(screen.getByText('Azure Functions v2')).toBeInTheDocument();
    expect(screen.getByText('CI / CD')).toBeInTheDocument();
  });

  it('links the newest dashboard-api commit to its GitHub repo (which uses an underscore, unlike the hyphenated package key)', async () => {
    render(<PageDetail pageKey="dashboard-api" onBack={() => {}} onSelectPage={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Earlier history/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Earlier history/));
    const link = screen.getByText('b7176d7').closest('a');
    expect(link).toHaveAttribute('href', 'https://github.com/skarumbu/dashboard_api/commit/b7176d7');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('shows a Related Pages chip for a package referenced by the seeded "authentication" page, and navigates on click', async () => {
    const onSelectPage = jest.fn();
    render(<PageDetail pageKey="posts-api" onBack={() => {}} onSelectPage={onSelectPage} />);
    const chip = await screen.findByRole('button', { name: 'Authentication' });
    fireEvent.click(chip);
    expect(onSelectPage).toHaveBeenCalledWith('authentication');
  });

  it('does not render a Related Pages section for a package nothing references', async () => {
    render(<PageDetail pageKey="digits" onBack={() => {}} onSelectPage={() => {}} />);
    await waitFor(() => expect(screen.getByText('digits')).toBeInTheDocument());
    expect(screen.queryByText('Related Pages')).not.toBeInTheDocument();
  });

  it('passes a per-page version client to VersionHistoryPanel (no versions -> panel renders nothing)', async () => {
    render(<PageDetail pageKey="digits" onBack={() => {}} onSelectPage={() => {}} />);
    await waitFor(() => expect(mocked.listVersions).toHaveBeenCalledWith('digits'));
    expect(screen.queryByText(/Version history/)).not.toBeInTheDocument();
  });
});

describe('PageDetail — non-package (topic) pages', () => {
  it('renders the seeded "authentication" page with its sections, but no tech stack or CI/CD', async () => {
    render(<PageDetail pageKey="authentication" onBack={() => {}} onSelectPage={() => {}} />);
    await waitFor(() => expect(screen.getByText('Authentication')).toBeInTheDocument());
    expect(screen.getByText('Azure EasyAuth (platform-level)')).toBeInTheDocument();
    expect(screen.queryByText('CI / CD')).not.toBeInTheDocument();
  });

  it('shows Related Pages chips (forward-declared) and navigates to a package on click', async () => {
    const onSelectPage = jest.fn();
    render(<PageDetail pageKey="authentication" onBack={() => {}} onSelectPage={onSelectPage} />);
    const chip = await screen.findByRole('button', { name: 'posts-api' });
    fireEvent.click(chip);
    expect(onSelectPage).toHaveBeenCalledWith('posts-api');
  });

  it('shows the error state for an unknown page key (history-api has no distinct "not found" for an anonymous caller)', async () => {
    render(<PageDetail pageKey="not-a-real-page" onBack={() => {}} onSelectPage={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Failed to load this page/)).toBeInTheDocument());
  });

  it('shows an error state when the fetch itself fails', async () => {
    mocked.getPage.mockRejectedValueOnce(new Error('history-api /sections/architecture/documents/digits -> 500'));
    render(<PageDetail pageKey="digits" onBack={() => {}} onSelectPage={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Failed to load this page/)).toBeInTheDocument());
  });
});
