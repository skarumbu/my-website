import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PageDetail from './PageDetail';
import * as historyApi from './historyApi';
import type { Page, PackagePage } from './pageTypes';

// PageDetail fetches its content from history-api at runtime — there is no
// local overlay/template file to derive mock data from anymore (see the
// architecture-wiki -> history-api migration's "step 7": the git-tracked
// overlay was removed once every page had a real history-api version). These
// literal fixtures are snapshots of real, live content — kept minimal but
// shaped like the real pages so the tests exercise the same rendering paths.
jest.mock('./historyApi');

const mocked = historyApi as jest.Mocked<typeof historyApi>;

const digitsPage: PackagePage = {
  key: 'digits',
  title: 'digits',
  role: 'Generates and serves daily Digits puzzles',
  description: 'Azure Functions app that generates, stores, and serves daily number puzzles.',
  features: ['Generates number puzzles with configurable difficulty (easy, medium, hard)'],
  architecture: {
    overview: 'Two Azure Function triggers: a timer trigger and an HTTP trigger.',
    keyPoints: ['Timer trigger fires on a 6-field NCRONTAB cron expression, "0 0 0 * * *"'],
  },
  relatedPages: [],
  runsOn: 'Azure Functions',
  repoUrl: 'https://github.com/skarumbu/digits',
  techStack: ['Azure Functions v2', 'Python 3.11', 'Azure Table Storage'],
  pipeline: [
    { label: 'git push\nmain/master' },
    { label: 'GitHub Actions', color: 'blue' },
    { label: 'func publish\n--python' },
    { label: 'Live on\nAzure Functions', color: 'green' },
  ],
};

const postsApiPage: PackagePage = {
  key: 'posts-api',
  title: 'posts-api',
  role: 'Manages content sections (writing, diary), both fully backed by history-api',
  description: 'Both current sections (writing, diary) store their content as history-api documents.',
  features: ['Both "writing" and "diary" sections are private and fully backed by history-api, not GitHub'],
  architecture: {
    overview: 'Both current sections use HistoryApiStorage exclusively.',
    keyPoints: ['HistoryApiStorage is the only storage backend actually used by any section today'],
  },
  relatedPages: ['azure-infrastructure', 'authentication'],
  runsOn: 'Azure Functions',
  repoUrl: 'https://github.com/skarumbu/posts-api',
  techStack: ['Azure Functions v2', 'Python 3.11', 'history-api (HistoryApiStorage)', 'Google ID token auth', 'requests'],
  pipeline: [
    { label: 'git push\nmain' },
    { label: 'GitHub Actions', color: 'blue' },
    { label: 'func publish\n--python' },
    { label: 'Live on\nAzure Functions', color: 'green' },
  ],
};

const authenticationPage: Page = {
  key: 'authentication',
  title: 'Authentication',
  description: 'Most backend services validate a Google ID token themselves, server-side, on every request.',
  sections: [
    {
      heading: 'Azure EasyAuth (platform-level)',
      content: 'ideas-api, dashboard-api, and history-api rely on Azure Functions\' built-in EasyAuth.',
    },
  ],
  relatedPages: ['posts-api', 'ideas-api', 'dashboard-api', 'learning-plan-api', 'azure-infrastructure'],
};

const pages: Record<string, Page | PackagePage> = {
  digits: digitsPage,
  'posts-api': postsApiPage,
  authentication: authenticationPage,
};

beforeEach(() => {
  mocked.getCachedPage.mockReturnValue(undefined);
  mocked.getPage.mockImplementation(async (key: string) => {
    const page = pages[key];
    if (!page) throw new Error(`history-api /sections/architecture/documents/${key} -> 401`);
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

  it('shows an error state for an unknown page key (history-api has no distinct "not found" for an anonymous caller)', async () => {
    render(<PageDetail pageKey="not-a-real-page" onBack={() => {}} onSelectPage={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Failed to load this page/)).toBeInTheDocument());
  });

  it('shows an error state when the fetch itself fails', async () => {
    mocked.getPage.mockRejectedValueOnce(new Error('history-api /sections/architecture/documents/digits -> 500'));
    render(<PageDetail pageKey="digits" onBack={() => {}} onSelectPage={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Failed to load this page/)).toBeInTheDocument());
  });
});
