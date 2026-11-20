import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter, RouterProvider, createBrowserRouter, createMemoryRouter } from 'react-router-dom';
import PoliGraph from './PoliGraph.tsx';
import PoliGraphLookup from './PoliGraphLookup.tsx';
import type { LookupResult, Official } from './lib/poligraphTypes.ts';

const ADDRESS = '1600 Pennsylvania Ave NW, Washington, DC';

function official(id: string, name: string, party: string, title: string, officeId = 'x', start = '2025-01-03'): Official {
  return {
    id, name, party, level: 'federal', photo_url: null, current: true,
    terms: [
      { office_id: 'x', title: 'Older title', kind: 'legislator', jurisdiction: 'us', district: null, start: '2015-01-03', end: '2017-01-03' },
      { office_id: officeId, title, kind: 'legislator', jurisdiction: 'us', district: null, start, end: null },
    ],
  };
}

const RESULT: LookupResult = {
  federal: [
    official('o_p', 'Pat President', 'Independent', 'President of the United States', 'us-president'),
    official('o_s1', 'Sam Senator', 'Democratic', 'U.S. Senator', 'us-senate-or'),
    official('o_s2', 'Sue Senator', 'Republican', 'U.S. Senator', 'us-senate-or'),
    official('o_h', 'Hal House', 'Democratic', 'U.S. Representative', 'us-house-or-3'),
  ],
  state: [],
};

function res(body: any, status = 200) {
  return { ok: status < 400, status, json: async () => body };
}

const OLD_URL = process.env.REACT_APP_POLIGRAPH_API_URL;

beforeEach(() => {
  process.env.REACT_APP_POLIGRAPH_API_URL = 'http://pg.test';
  global.fetch = jest.fn().mockResolvedValue(res(RESULT));
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
  if (OLD_URL === undefined) delete process.env.REACT_APP_POLIGRAPH_API_URL;
  else process.env.REACT_APP_POLIGRAPH_API_URL = OLD_URL;
});

function renderLookup(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/poligraph/lookup', state }]}>
      <PoliGraphLookup />
    </MemoryRouter>,
  );
}

function submit(value: string) {
  fireEvent.change(screen.getByLabelText('Your address'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Find my officials' }));
}

describe('address form', () => {
  test('input is labelled with street-address autocomplete and a 200 char cap', () => {
    renderLookup();
    const input = screen.getByLabelText('Your address');
    expect(input).toHaveAttribute('autocomplete', 'street-address');
    expect(input).toHaveAttribute('maxlength', '200');
  });

  test('a blank submit shows a message and does not fetch', () => {
    renderLookup();
    fireEvent.click(screen.getByRole('button', { name: 'Find my officials' }));
    expect(screen.getByText('Enter a street address.')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('submitting shows Looking up… and disables the button', async () => {
    let resolve: (v: any) => void = () => {};
    global.fetch = jest.fn().mockReturnValue(new Promise((r) => { resolve = r; }));
    renderLookup();
    submit(ADDRESS);
    const button = await screen.findByRole('button', { name: 'Looking up…' });
    expect(button).toBeDisabled();
    resolve(res(RESULT));
    await screen.findByRole('heading', { name: 'Federal' });
  });

  test.each([
    [404, 'address_not_found', "We couldn't find that address. Try adding the city and state."],
    [503, 'lookup_unavailable', 'Address lookup is unavailable right now. Try again later.'],
    [400, 'bad_parameter', 'Enter a street address.'],
    [500, 'internal', 'Address lookup is unavailable right now. Try again later.'],
  ])('a %i %s response shows the right message', async (status, code, message) => {
    global.fetch = jest.fn().mockResolvedValue(res({ error: code }, status));
    renderLookup();
    submit(ADDRESS);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Find my officials' })).toBeEnabled();
  });

  test('a 400 with an empty body still shows the blank-address message', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, json: async () => { throw new Error('empty'); } });
    renderLookup();
    submit(ADDRESS);
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a street address.');
  });

  test('help text and error are linked to the input', async () => {
    global.fetch = jest.fn().mockResolvedValue(res({ error: 'address_not_found' }, 404));
    renderLookup();
    const input = screen.getByLabelText('Your address');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveAccessibleDescription("Your address is used once to find your districts and isn't saved.");
    submit(ADDRESS);
    await screen.findByRole('alert');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(/isn't saved\..*couldn't find that address/);
  });

  test('a network error shows the connection message', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fail'));
    renderLookup();
    submit(ADDRESS);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't reach PoliGraph. Check your connection and try again.",
    );
  });
});

describe('results', () => {
  test('lists federal officials in API order with links, party and latest term', () => {
    renderLookup({ result: RESULT });
    expect(screen.getByRole('heading', { name: 'Federal' })).toBeInTheDocument();
    const links = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/poligraph/official/'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/poligraph/official/o_p', '/poligraph/official/o_s1', '/poligraph/official/o_s2', '/poligraph/official/o_h',
    ]);
    expect(links[0]).toHaveTextContent('Pat President');
    expect(links[0]).toHaveTextContent('Independent');
    expect(links[0]).toHaveTextContent('President of the United States');
    expect(links[0]).not.toHaveTextContent('Older title');
    expect(links[3]).toHaveTextContent('U.S. Representative, Oregon 3rd');
  });

  test('empty state list says state officials are coming soon', () => {
    renderLookup({ result: RESULT });
    expect(screen.getByRole('heading', { name: 'State' })).toBeInTheDocument();
    expect(screen.getByText('State officials are coming soon.')).toBeInTheDocument();
  });

  test('offers a Look up another address form', () => {
    renderLookup({ result: RESULT });
    expect(screen.getByRole('heading', { name: 'Look up another address' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your address')).toHaveValue('');
  });

  test('another lookup replaces the shown results', async () => {
    renderLookup({ result: RESULT });
    global.fetch = jest.fn().mockResolvedValue(res({
      federal: [official('o_new', 'New Person', 'Green', 'U.S. Senator', 'us-senate-me')],
      state: [],
    }));
    submit('2 Other St, Augusta, ME');
    expect(await screen.findByRole('link', { name: /New Person/ })).toBeInTheDocument();
    expect(screen.queryByText('Pat President')).not.toBeInTheDocument();
  });

  test('a second lookup replaces history state with the new results only and moves focus', async () => {
    const router = createMemoryRouter(
      [{ path: '/poligraph/lookup', element: <PoliGraphLookup /> }],
      { initialEntries: [{ pathname: '/poligraph/lookup', state: { result: RESULT } }] },
    );
    const second = { federal: [official('o_new', 'New Person', 'Green', 'U.S. Senator', 'us-senate-me')], state: [] };
    global.fetch = jest.fn().mockResolvedValue(res(second));
    render(<RouterProvider router={router} />);
    submit('2 Other St, Augusta, ME');
    await screen.findByRole('link', { name: /New Person/ });
    expect(router.state.location.state.result).toEqual(second);
    expect(JSON.stringify(router.state.location)).not.toContain('Other St');
    expect(router.state.historyAction).toBe('REPLACE');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Federal' })).toHaveFocus());
  });

  test('a lookup that resolves after the user left does not navigate', async () => {
    let release: (v: any) => void = () => {};
    global.fetch = jest.fn().mockImplementation(
      () => new Promise((r) => { release = r; }),
    );
    const router = createMemoryRouter(
      [
        { path: '/poligraph', element: <PoliGraph /> },
        { path: '/poligraph/lookup', element: <PoliGraphLookup /> },
        { path: '/elsewhere', element: <div>Elsewhere</div> },
      ],
      { initialEntries: ['/poligraph'] },
    );
    render(<RouterProvider router={router} />);
    submit('2 Other St, Augusta, ME');
    await waitFor(() =>
      expect((global.fetch as jest.Mock).mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true),
    );
    await act(async () => { await router.navigate('/elsewhere'); });
    expect(await screen.findByText('Elsewhere')).toBeInTheDocument();
    await act(async () => {
      release(res(RESULT));
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(router.state.location.pathname).toBe('/elsewhere');
    expect(screen.getByText('Elsewhere')).toBeInTheDocument();
  });

  test('a direct visit shows only the form', () => {
    renderLookup();
    expect(screen.queryByRole('heading', { name: 'Federal' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Your address')).toBeInTheDocument();
  });
});

describe('privacy', () => {
  test('the address never leaves the input and the POST body', async () => {
    const spies = (['log', 'warn', 'error'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
    const router = createMemoryRouter(
      [
        { path: '/poligraph', element: <PoliGraph /> },
        { path: '/poligraph/lookup', element: <PoliGraphLookup /> },
      ],
      { initialEntries: ['/poligraph'] },
    );
    global.fetch = jest.fn().mockImplementation(async (url: string) =>
      String(url).endsWith('/search-index') ? res([]) : res(RESULT),
    );
    render(<RouterProvider router={router} />);

    fireEvent.change(screen.getByLabelText('Your address'), { target: { value: ADDRESS } });
    fireEvent.click(screen.getByRole('button', { name: 'Find my officials' }));
    await screen.findByRole('heading', { name: 'Federal' });

    expect(router.state.location.pathname).toBe('/poligraph/lookup');
    for (const part of [window.location.search, window.location.hash, window.location.pathname,
      router.state.location.search, router.state.location.hash, router.state.location.pathname]) {
      expect(part).not.toContain('Pennsylvania');
    }
    expect(JSON.stringify(window.history.state)).not.toContain('Pennsylvania');
    expect(JSON.stringify(router.state.location.state)).not.toContain('Pennsylvania');

    for (const store of [window.localStorage, window.sessionStorage]) {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i) as string;
        expect(key).not.toContain('Pennsylvania');
        expect(store.getItem(key) ?? '').not.toContain('Pennsylvania');
      }
    }
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain('Pennsylvania');
    }

    const calls = (global.fetch as jest.Mock).mock.calls;
    const lookupCall = calls.find(([, init]) => init?.method === 'POST');
    expect(lookupCall[1].body).toContain('Pennsylvania');
    for (const [url] of calls) expect(String(url)).not.toContain('Pennsylvania');

    expect(screen.getByLabelText('Your address')).toHaveValue('');
    expect(document.body.innerHTML).not.toContain('Pennsylvania');
  });

  test('with a browser router the address is absent from window.location and history.state', async () => {
    window.history.replaceState(null, '', '/poligraph');
    const router = createBrowserRouter([
      { path: '/poligraph', element: <PoliGraph /> },
      { path: '/poligraph/lookup', element: <PoliGraphLookup /> },
    ]);
    global.fetch = jest.fn().mockImplementation(async (url: string) =>
      String(url).endsWith('/search-index') ? res([]) : res(RESULT),
    );
    render(<RouterProvider router={router} />);
    fireEvent.change(screen.getByLabelText('Your address'), { target: { value: ADDRESS } });
    fireEvent.click(screen.getByRole('button', { name: 'Find my officials' }));
    await screen.findByRole('heading', { name: 'Federal' });

    expect(window.location.pathname).toBe('/poligraph/lookup');
    expect(window.location.search).not.toContain('Pennsylvania');
    expect(window.location.hash).not.toContain('Pennsylvania');
    const historyState = JSON.stringify(window.history.state);
    expect(historyState).toContain('o_p');
    expect(historyState).not.toContain('Pennsylvania');
    router.dispose();
    window.history.replaceState(null, '', '/');
  });
});
