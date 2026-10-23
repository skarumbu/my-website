import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DailyLinksPanel from './DailyLinksPanel.tsx';
import { DailyLinkConfig } from '../lib/dailyLinksTypes.ts';

type LinkView = { config: DailyLinkConfig; openedToday: boolean };

const CONFIG_URL = 'http://test.local/api/daily/links/config';

const HN: LinkView = { config: { id: 'hn', label: 'Hacker News', url: 'https://news.ycombinator.com' }, openedToday: true };
const BBC: LinkView = { config: { id: 'bbc', label: 'BBC', url: 'https://bbc.co.uk' }, openedToday: false };

const WIKI = {
  tfa: {
    title: 'Ada_Lovelace',
    titles: { normalized: 'Ada Lovelace' },
    extract: 'English mathematician.',
    content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Ada_Lovelace' } },
  },
};

type PutReply = 'echo' | { status: number };

// Wikipedia answers with the article (or a 503); the links PUT echoes its
// body back as the server does, unless the test asks for an error status.
function mockFetch({ wiki = true, put = 'echo' as PutReply } = {}) {
  (global.fetch as jest.Mock).mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.startsWith('https://en.wikipedia.org')) {
      return wiki
        ? { ok: true, status: 200, json: async () => WIKI }
        : { ok: false, status: 503, json: async () => ({}) };
    }
    if (put === 'echo') return { ok: true, status: 200, json: async () => JSON.parse(init!.body as string) };
    return { ok: false, status: put.status, json: async () => ({}) };
  });
}

async function renderPanel(links: LinkView[] = []) {
  const handlers = { onOpened: jest.fn(), onLinksChange: jest.fn(), onUnauthorized: jest.fn() };
  render(<DailyLinksPanel token="t" dateIso="2026-10-22" links={links} {...handlers} />);
  // Let the featured-article fetch settle so it doesn't update state mid-test.
  await React.act(async () => {});
  return handlers;
}

function putCalls() {
  return (global.fetch as jest.Mock).mock.calls.filter(([, init]) => init?.method === 'PUT');
}

function putBody(): DailyLinkConfig[] {
  const calls = putCalls();
  expect(calls).toHaveLength(1);
  expect(calls[0][0]).toBe(CONFIG_URL);
  return JSON.parse(calls[0][1].body).links;
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const type = (name: string | RegExp, value: string) => fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });

beforeEach(() => {
  process.env.REACT_APP_DAILY_API_BASE_URL = 'http://test.local';
  sessionStorage.clear();
  localStorage.clear();
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('keeps showing the featured article above the links', async () => {
  mockFetch();
  await renderPanel([HN]);

  expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toMatch(/^https:\/\/en\.wikipedia\.org\/api\/rest_v1\/feed\/featured\//);
  expect(screen.getByRole('button', { name: /hacker news/i })).toBeInTheDocument();
});

it('with no links, prompts to add some instead of the old note', async () => {
  mockFetch({ wiki: false });
  await renderPanel();

  expect(await screen.findByText(/couldn't load today's article/i)).toBeInTheDocument();
  expect(screen.getByText('Add the sites you check every day.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '+ Add links' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  expect(screen.queryByText(/no links configured yet/i)).not.toBeInTheDocument();
});

it('"+ Add links" opens the editor with one empty, focused row', async () => {
  mockFetch();
  await renderPanel();

  click('+ Add links');
  const label = screen.getByRole('textbox', { name: 'Label for link 1' });
  expect(label).toHaveValue('');
  await waitFor(() => expect(label).toHaveFocus());
});

it('Edit shows a prefilled row per link with labelled controls', async () => {
  mockFetch();
  await renderPanel([HN, BBC]);

  click('Edit');
  expect(screen.getByRole('textbox', { name: 'Label for Hacker News' })).toHaveValue('Hacker News');
  expect(screen.getByRole('textbox', { name: 'URL for Hacker News' })).toHaveValue('https://news.ycombinator.com');
  expect(screen.getByRole('textbox', { name: 'Label for BBC' })).toHaveValue('BBC');
  expect(screen.getByRole('button', { name: 'Move Hacker News up' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Move Hacker News down' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Move BBC down' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Remove BBC' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
});

it('add, reorder and remove shape the PUT body', async () => {
  mockFetch();
  const { onLinksChange } = await renderPanel([HN, BBC]);

  click('Edit');
  click('+ Add link');
  const newLabel = screen.getByRole('textbox', { name: 'Label for link 3' });
  await waitFor(() => expect(newLabel).toHaveFocus());
  type('Label for link 3', 'Lobsters');
  type('URL for Lobsters', 'lobste.rs');
  click('Move Lobsters up');
  click('Remove Hacker News');
  click('Save');

  await waitFor(() => expect(onLinksChange).toHaveBeenCalled());
  const body = putBody();
  expect(body.map(l => [l.label, l.url])).toEqual([
    ['Lobsters', 'https://lobste.rs'],
    ['BBC', 'https://bbc.co.uk'],
  ]);
  expect(body[1].id).toBe('bbc');
  expect(body[0].id).not.toBe('hn');
  expect(body[0].id).toBeTruthy();
});

it('an invalid URL blocks the save and shows the error on that row', async () => {
  mockFetch();
  const { onLinksChange } = await renderPanel([HN]);

  click('Edit');
  type('URL for Hacker News', 'javascript:alert(1)');
  click('Save');

  expect(putCalls()).toHaveLength(0);
  const url = screen.getByRole('textbox', { name: 'URL for Hacker News' });
  expect(url).toHaveAttribute('aria-invalid', 'true');
  expect(url).toHaveAccessibleDescription(/web address/i);
  expect(onLinksChange).not.toHaveBeenCalled();
});

it('a successful save hands back the links with openedToday kept for surviving ids', async () => {
  mockFetch();
  const { onLinksChange } = await renderPanel([HN, BBC]);

  click('Edit');
  type('Label for Hacker News', 'HN');
  click('+ Add link');
  type('Label for link 3', 'Lobsters');
  type('URL for Lobsters', 'https://lobste.rs');
  click('Save');

  await waitFor(() => expect(onLinksChange).toHaveBeenCalledTimes(1));
  const [next] = onLinksChange.mock.calls[0];
  expect(next.map((l: LinkView) => [l.config.label, l.openedToday])).toEqual([
    ['HN', true],
    ['BBC', false],
    ['Lobsters', false],
  ]);
  expect(next[0].config.id).toBe('hn');
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
});

it('a failed save keeps the edits and shows the error', async () => {
  mockFetch({ put: { status: 500 } });
  const { onLinksChange } = await renderPanel([HN]);

  click('Edit');
  type('Label for Hacker News', 'HN');
  click('Save');

  expect(await screen.findByText('Could not save links. Try again.')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Label for HN' })).toHaveValue('HN');
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  expect(onLinksChange).not.toHaveBeenCalled();
});

it('Save is disabled while the save is in flight', async () => {
  let resolve!: (v: unknown) => void;
  (global.fetch as jest.Mock).mockImplementation((url: string) =>
    url.startsWith('https://en.wikipedia.org')
      ? Promise.resolve({ ok: false, status: 503, json: async () => ({}) })
      : new Promise(r => { resolve = r; }),
  );
  await renderPanel([HN]);

  click('Edit');
  click('Save');
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  resolve({ ok: true, status: 200, json: async () => ({ links: [HN.config] }) });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument());
});

it('Escape discards edits', async () => {
  mockFetch();
  const { onLinksChange } = await renderPanel([HN]);

  click('Edit');
  type('Label for Hacker News', 'Changed');
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Label for Changed' }), { key: 'Escape' });

  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /hacker news/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus();
  click('Edit');
  expect(screen.getByRole('textbox', { name: 'Label for Hacker News' })).toHaveValue('Hacker News');
  expect(putCalls()).toHaveLength(0);
  expect(onLinksChange).not.toHaveBeenCalled();
});

it('Cancel discards edits', async () => {
  mockFetch();
  await renderPanel([HN]);

  click('Edit');
  click('Remove Hacker News');
  click('Cancel');

  expect(screen.getByRole('button', { name: /hacker news/i })).toBeInTheDocument();
  expect(putCalls()).toHaveLength(0);
});

it('a 401 on save calls onUnauthorized', async () => {
  mockFetch({ put: { status: 401 } });
  const { onUnauthorized, onLinksChange } = await renderPanel([HN]);

  click('Edit');
  click('Save');

  await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
  expect(onLinksChange).not.toHaveBeenCalled();
});
