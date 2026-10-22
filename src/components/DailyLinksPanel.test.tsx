import React from 'react';
import { render, screen } from '@testing-library/react';
import DailyLinksPanel from './DailyLinksPanel.tsx';

function renderPanel() {
  render(<DailyLinksPanel token="t" dateIso="2026-10-22" links={[]} onOpened={jest.fn()} />);
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('shows no empty-links note when the featured article is displayed', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      tfa: {
        title: 'Ada_Lovelace',
        titles: { normalized: 'Ada Lovelace' },
        extract: 'English mathematician.',
        content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Ada_Lovelace' } },
      },
    }),
  });
  renderPanel();

  expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toMatch(/^https:\/\/en\.wikipedia\.org\/api\/rest_v1\/feed\/featured\//);
  expect(screen.queryByText(/no links configured yet/i)).not.toBeInTheDocument();
});

it('shows the empty-links note when there are no links and no article', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
  renderPanel();

  expect(await screen.findByText(/no links configured yet/i)).toBeInTheDocument();
  expect(screen.getByText(/couldn't load today's article/i)).toBeInTheDocument();
});
