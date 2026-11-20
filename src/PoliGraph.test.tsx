import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PoliGraph from './PoliGraph.tsx';
import type { IndexRow } from './lib/poligraphTypes.ts';

function row(overrides: Partial<IndexRow>): IndexRow {
  return {
    id: 'o_x', name: 'X', office: null, jurisdiction: null, office_id: null,
    state: null, district: null, level: 'federal', party: null, current: true,
    ...overrides,
  };
}

const INDEX: IndexRow[] = [
  row({ id: 'o_p', name: 'Pat Example', office: 'President of the United States', office_id: 'us-president', jurisdiction: 'us' }),
  row({ id: 'o_w', name: 'Ron Wyden', office: 'U.S. Senator', office_id: 'us-senate-or', state: 'or', jurisdiction: 'us' }),
  row({ id: 'o_m', name: 'Jeff Merkley', office: 'U.S. Senator', office_id: 'us-senate-or', state: 'or', jurisdiction: 'us' }),
  row({ id: 'o_h3', name: 'Maxine Three', office: 'U.S. Representative', office_id: 'us-house-or-3', state: 'or', district: '3', jurisdiction: 'us' }),
  row({ id: 'o_h1', name: 'Zed One', office: 'U.S. Representative', office_id: 'us-house-or-1', state: 'or', district: '1', jurisdiction: 'us' }),
  row({ id: 'o_wa', name: 'Wash Member', office: 'U.S. Representative', office_id: 'us-house-wa-2', state: 'wa', district: '2', jurisdiction: 'us' }),
  row({ id: 'o_old', name: 'Old Pres', office: 'President of the United States', office_id: 'us-president', current: false }),
];

function res(body: any, status = 200) {
  return { ok: status < 400, status, json: async () => body };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PoliGraph />
    </MemoryRouter>,
  );
}

const OLD_URL = process.env.REACT_APP_POLIGRAPH_API_URL;

beforeEach(() => {
  process.env.REACT_APP_POLIGRAPH_API_URL = 'http://pg.test';
  global.fetch = jest.fn().mockResolvedValue(res(INDEX));
});

afterEach(() => {
  if (OLD_URL === undefined) delete process.env.REACT_APP_POLIGRAPH_API_URL;
  else process.env.REACT_APP_POLIGRAPH_API_URL = OLD_URL;
});

async function loaded() {
  const box = await screen.findByRole('searchbox', { name: 'Search officials' });
  await waitFor(() => expect(box).toBeEnabled());
  return box;
}

test('renders heading, subhead, nav and the find-my-officials slot', async () => {
  renderPage();
  await loaded();
  expect(screen.getByRole('heading', { name: 'PoliGraph' })).toBeInTheDocument();
  expect(screen.getByText('See what officials have signed, sponsored and voted on, with a link to the source for every entry.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
  expect(screen.getByTestId('find-my-officials')).toBeInTheDocument();
});

test('typing filters the index and links to the official', async () => {
  renderPage();
  const box = await loaded();
  fireEvent.change(box, { target: { value: 'wyd' } });
  const link = screen.getByRole('link', { name: /Ron Wyden/ });
  expect(link).toHaveAttribute('href', '/poligraph/official/o_w');
  expect(link).toHaveTextContent('U.S. Senator, Oregon');
});

test('shows a loading status while the index loads', async () => {
  let release: (v: any) => void = () => {};
  global.fetch = jest.fn().mockReturnValue(new Promise((r) => { release = r; }));
  renderPage();
  expect(screen.getByRole('status')).toHaveTextContent('Loading officials…');
  release(res(INDEX));
  await loaded();
  expect(screen.queryByText('Loading officials…')).not.toBeInTheDocument();
});

test('browse list and results show state and district', async () => {
  renderPage();
  const box = await loaded();
  fireEvent.change(box, { target: { value: 'maxine' } });
  expect(screen.getByRole('link', { name: /Maxine Three/ })).toHaveTextContent('U.S. Representative, Oregon 3rd');
  fireEvent.change(box, { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('State'), { target: { value: 'or' } });
  const list = screen.getByRole('list', { name: 'Oregon members of Congress' });
  expect(list).toHaveTextContent('U.S. Senator, Oregon');
  expect(list).toHaveTextContent('U.S. Representative, Oregon 1st');
});

test('fetches the index once, not per keystroke', async () => {
  renderPage();
  const box = await loaded();
  fireEvent.change(box, { target: { value: 'w' } });
  fireEvent.change(box, { target: { value: 'wy' } });
  fireEvent.change(box, { target: { value: 'wyd' } });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('empty index shows a loading-soon message and disables search', async () => {
  global.fetch = jest.fn().mockResolvedValue(res([]));
  renderPage();
  expect(await screen.findByText('Officials are still being loaded. Check back soon.')).toBeInTheDocument();
  expect(screen.getByRole('searchbox', { name: 'Search officials' })).toBeDisabled();
});

test('a query with no matches says so', async () => {
  renderPage();
  const box = await loaded();
  fireEvent.change(box, { target: { value: 'zzz' } });
  expect(screen.getByText('No officials match “zzz”.')).toBeInTheDocument();
});

test('fetch failure shows an error and Retry refetches', async () => {
  global.fetch = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(res(INDEX));
  renderPage();
  expect(await screen.findByText("Couldn't load officials.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Search officials' })).toBeEnabled());
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(screen.queryByText("Couldn't load officials.")).not.toBeInTheDocument();
});

describe('browse', () => {
  test('President links to the current us-president row', async () => {
    renderPage();
    await loaded();
    expect(screen.getByRole('link', { name: /President/ })).toHaveAttribute('href', '/poligraph/official/o_p');
  });

  test('state select lists only states in the index, by name', async () => {
    renderPage();
    await loaded();
    const select = screen.getByLabelText('State');
    const names = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(names).toEqual(expect.arrayContaining(['Oregon', 'Washington']));
    expect(names).not.toContain('Alaska');
  });

  test('choosing Oregon lists senators first, then House by district', async () => {
    renderPage();
    await loaded();
    fireEvent.change(screen.getByLabelText('State'), { target: { value: 'or' } });
    const list = screen.getByRole('list', { name: 'Oregon members of Congress' });
    const names = within(list).getAllByRole('link').map((a) => a.textContent ?? '');
    expect(names.map((n) => n.split(/U\.S\./)[0].trim())).toEqual([
      'Jeff Merkley', 'Ron Wyden', 'Zed One', 'Maxine Three',
    ]);
    expect(within(list).queryByText(/Wash Member/)).not.toBeInTheDocument();
  });

  test('no governors list', async () => {
    renderPage();
    await loaded();
    expect(screen.queryByText(/governor/i)).not.toBeInTheDocument();
  });
});

describe('find my officials', () => {
  test('shows the heading, form and privacy help text', async () => {
    renderPage();
    await loaded();
    const section = screen.getByTestId('find-my-officials');
    expect(within(section).getByRole('heading', { name: 'Find my officials' })).toBeInTheDocument();
    expect(within(section).getByLabelText('Your address')).toBeInTheDocument();
    expect(within(section).getByText("Your address is used once to find your districts and isn't saved.")).toBeInTheDocument();
  });
});
