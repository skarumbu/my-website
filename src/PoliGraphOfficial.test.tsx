import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import PoliGraphOfficial from './PoliGraphOfficial.tsx';
import { TOPICS } from './lib/poligraphTypes.ts';
import type { Action, OfficialRecord } from './lib/poligraphTypes.ts';

function res(body: any, status = 200) {
  return { ok: status < 400, status, json: async () => body };
}

function record(overrides: Partial<OfficialRecord['official']> = {}, extra: Partial<OfficialRecord> = {}): OfficialRecord {
  return {
    official: {
      id: 'o_h', name: 'Maxine Three', party: 'D', level: 'federal', photo_url: null, current: true,
      terms: [
        { office_id: 'us-house-or-3', title: 'U.S. Representative', kind: 'legislator', jurisdiction: 'or', district: '3', start: '2019-01-03', end: '2021-01-03' },
        { office_id: 'us-house-or-3', title: 'U.S. Representative', kind: 'legislator', jurisdiction: 'or', district: '3', start: '2021-01-03', end: null },
      ],
      ...overrides,
    },
    counts: { sponsored: 12, cosponsored: 40, vote_yes: 200, vote_no: 80, vote_present: 15, vote_not_voting: 5 },
    freshness: [
      { source: 'congress', last_success: '2026-11-20T07:00:00+00:00', stale: false },
      { source: 'house_votes', last_success: '2026-11-21T07:00:00+00:00', stale: false },
    ],
    ...extra,
  };
}

function action(id: string, extra: Partial<Action> = {}): Action {
  return {
    official_id: 'o_h', item_id: `us-119-hr-${id}`, date: '2026-03-02', kind: 'sponsored',
    item_title: `Bill ${id}`, topics: [], source_url: `https://example.gov/${id}`, source: 'congress',
    office_id: 'us-house-or-3', is_key_vote: false, overridden_on: null, vote_ref: null, ...extra,
  };
}

function LocationDisplay() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

function renderPage(entry = '/poligraph/official/o_h') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/poligraph/official/:officialId" element={<PoliGraphOfficial />} />
        <Route path="/poligraph" element={<div>Landing</div>} />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>,
  );
}

type Handler = (url: URL) => any;

function route(handlers: { official?: Handler; actions?: Handler } = {}) {
  const officialHandler = handlers.official ?? (() => res(record()));
  const actionsHandler = handlers.actions ?? (() => res({ actions: [action('1')], cursor: null }));
  global.fetch = jest.fn((input: any) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/actions')) return Promise.resolve(actionsHandler(url));
    return Promise.resolve(officialHandler(url));
  }) as any;
}

function actionCalls(): URL[] {
  return (global.fetch as jest.Mock).mock.calls
    .map((c) => new URL(String(c[0])))
    .filter((u) => u.pathname.endsWith('/actions'));
}

const OLD_URL = process.env.REACT_APP_POLIGRAPH_API_URL;

beforeEach(() => {
  process.env.REACT_APP_POLIGRAPH_API_URL = 'http://pg.test';
  route();
});

afterEach(() => {
  if (OLD_URL === undefined) delete process.env.REACT_APP_POLIGRAPH_API_URL;
  else process.env.REACT_APP_POLIGRAPH_API_URL = OLD_URL;
});

describe('header', () => {
  it('shows name, party, term, since year and counts', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Maxine Three' })).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('U.S. Representative')).toBeInTheDocument();
    expect(screen.getByText('Oregon')).toBeInTheDocument();
    expect(screen.getByText('Since 2019')).toBeInTheDocument();
    expect(screen.getByText('12 sponsored · 40 co-sponsored · 300 votes')).toBeInTheDocument();
  });

  it('sets the document title', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(document.title).toBe('Maxine Three · PoliGraph'));
  });

  it('shows executive counts and omits zeros', async () => {
    route({
      official: () =>
        res(record({
          id: 'o_h', name: 'Pat Example', party: 'R', current: true,
          terms: [{ office_id: 'us-president', title: 'President', kind: 'executive', jurisdiction: 'us', district: null, start: '2025-01-20', end: null }],
        }, { counts: { signed: 30, vetoed: 2, line_item_veto: 1, pocket_veto: 0, executive_order: 0 } })),
    });
    renderPage();
    expect(await screen.findByText('30 signed · 3 vetoed')).toBeInTheDocument();
  });

  it('uses singular labels for a count of one', async () => {
    route({
      official: () =>
        res(record({
          terms: [{ office_id: 'us-president', title: 'President', kind: 'executive', jurisdiction: 'us', district: null, start: '2025-01-20', end: null }],
        }, { counts: { signed: 1, executive_order: 1 } })),
    });
    renderPage();
    expect(await screen.findByText('1 signed · 1 executive order')).toBeInTheDocument();
  });

  it('uses singular vote for a count of one', async () => {
    route({ official: () => res(record({}, { counts: { sponsored: 1, vote_yes: 1 } })) });
    renderPage();
    expect(await screen.findByText('1 sponsored · 1 vote')).toBeInTheDocument();
  });

  it('shows no Since for a non-current official', async () => {
    route({ official: () => res(record({ current: false })) });
    renderPage();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(/^Since/)).not.toBeInTheDocument();
  });
});

describe('freshness', () => {
  it('shows when the data was last updated', async () => {
    renderPage();
    expect(await screen.findByText('Data last updated Nov 20, 2026')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('alerts on a stale source', async () => {
    route({
      official: () => res(record({}, { freshness: [{ source: 'congress', last_success: '2026-11-10T00:00:00+00:00', stale: true }] })),
    });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Congress.gov data hasn't updated in over 2 days, so this record may be missing recent actions.",
    );
  });

  it('joins several stale sources with and', async () => {
    route({
      official: () =>
        res(record({}, {
          freshness: [
            { source: 'house_votes', last_success: '2026-11-10T00:00:00+00:00', stale: true },
            { source: 'senate_votes', last_success: '2026-11-10T00:00:00+00:00', stale: true },
          ],
        })),
    });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "House votes and Senate votes data hasn't updated in over 2 days",
    );
  });

  it("says the record hasn't synced when nothing has", async () => {
    route({
      official: () => res(record({}, { freshness: [{ source: 'congress', last_success: null, stale: true }] })),
    });
    renderPage();
    expect(await screen.findByText("This record hasn't synced yet.")).toBeInTheDocument();
  });
});

describe('filters', () => {
  it('defaults a legislator to Sponsored + key votes with no kind param', async () => {
    renderPage();
    const chip = await screen.findByRole('button', { name: 'Sponsored + key votes' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await screen.findByText('Bill 1');
    expect(actionCalls()).toHaveLength(1);
    expect(actionCalls()[0].searchParams.has('kind')).toBe(false);
  });

  it('All votes refetches without a cursor, replaces rows and updates the URL', async () => {
    route({
      actions: (url) =>
        url.searchParams.has('kind')
          ? res({ actions: [action('2', { kind: 'vote_yes' })], cursor: null })
          : res({ actions: [action('1')], cursor: 'c2' }),
    });
    renderPage();
    await screen.findByText('Bill 1');
    fireEvent.click(screen.getByRole('button', { name: 'All votes' }));
    await screen.findByText('Bill 2');
    expect(screen.queryByText('Bill 1')).not.toBeInTheDocument();
    const last = actionCalls()[actionCalls().length - 1];
    expect(last.search).toContain('kind=vote_yes%2Cvote_no%2Cvote_present%2Cvote_not_voting');
    expect(last.searchParams.has('cursor')).toBe(false);
    expect(screen.getByTestId('loc')).toHaveTextContent('/poligraph/official/o_h?preset=all-votes');
    expect(screen.getByRole('button', { name: 'All votes' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('key votes preset sends key_votes', async () => {
    renderPage();
    await screen.findByText('Bill 1');
    fireEvent.click(screen.getByRole('button', { name: 'Key votes' }));
    await waitFor(() => expect(actionCalls()).toHaveLength(2));
    expect(actionCalls()[1].searchParams.get('key_votes')).toBe('1');
  });

  it('topic and date filters feed the request and the URL', async () => {
    renderPage();
    await screen.findByText('Bill 1');
    const topic = screen.getByLabelText('Topic') as HTMLSelectElement;
    expect(within(topic).getAllByRole('option').map((o) => o.textContent)).toEqual(['All topics', ...TOPICS]);
    fireEvent.change(topic, { target: { value: 'Health' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-02-01' } });
    await waitFor(() => {
      const last = actionCalls()[actionCalls().length - 1];
      expect(last.searchParams.get('topic')).toBe('Health');
      expect(last.searchParams.get('from')).toBe('2026-01-01');
      expect(last.searchParams.get('to')).toBe('2026-02-01');
    });
    expect(screen.getByTestId('loc')).toHaveTextContent('?topic=Health&from=2026-01-01&to=2026-02-01');
  });

  it('reads filters from the URL', async () => {
    renderPage('/poligraph/official/o_h?preset=cosponsored&topic=Health');
    await screen.findByText('Bill 1');
    expect(screen.getByRole('button', { name: 'Co-sponsored' })).toHaveAttribute('aria-pressed', 'true');
    expect(actionCalls()[0].searchParams.get('kind')).toBe('cosponsored');
    expect(actionCalls()[0].searchParams.get('topic')).toBe('Health');
  });

  it('shows executive presets, and executive orders only for a president', async () => {
    route({
      official: () =>
        res(record({
          terms: [{ office_id: 'us-president', title: 'President', kind: 'executive', jurisdiction: 'us', district: null, start: '2025-01-20', end: null }],
        }, { counts: { signed: 3 } })),
    });
    renderPage();
    expect(await screen.findByRole('button', { name: 'All actions' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Signed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Executive orders' })).toBeInTheDocument();
  });

  it('hides executive orders for a non-president executive', async () => {
    route({
      official: () =>
        res(record({
          terms: [{ office_id: 'or-governor', title: 'Governor', kind: 'executive', jurisdiction: 'or', district: null, start: '2023-01-09', end: null }],
        }, { counts: { signed: 3 } })),
    });
    renderPage();
    await screen.findByRole('button', { name: 'All actions' });
    expect(screen.queryByRole('button', { name: 'Executive orders' })).not.toBeInTheDocument();
  });

  it('only shows the response of the latest request (Review Focus 2)', async () => {
    let releaseSponsored: (v: any) => void = () => {};
    route({
      actions: (url) => {
        const kind = url.searchParams.get('kind');
        if (kind === 'sponsored') return new Promise((r) => { releaseSponsored = r; });
        if (kind === 'cosponsored') return res({ actions: [action('co')], cursor: null });
        return res({ actions: [action('1')], cursor: null });
      },
    });
    renderPage();
    await screen.findByText('Bill 1');
    fireEvent.click(screen.getByRole('button', { name: 'Sponsored' }));
    fireEvent.click(screen.getByRole('button', { name: 'Co-sponsored' }));
    await screen.findByText('Bill co');
    releaseSponsored(res({ actions: [action('sp')], cursor: null }));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText('Bill co')).toBeInTheDocument();
    expect(screen.queryByText('Bill sp')).not.toBeInTheDocument();
  });
});

describe('paging', () => {
  it('loads more with the cursor, appends, and removes the button at the end', async () => {
    route({
      actions: (url) =>
        url.searchParams.get('cursor') === 'c2'
          ? res({ actions: [action('2')], cursor: null })
          : res({ actions: [action('1')], cursor: 'c2' }),
    });
    renderPage();
    await screen.findByText('Bill 1');
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await screen.findByText('Bill 2');
    expect(screen.getByText('Bill 1')).toBeInTheDocument();
    expect(actionCalls()[1].searchParams.get('cursor')).toBe('c2');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });
});

describe('load more failure', () => {
  it('keeps loaded rows, shows an inline error, and retries the same cursor', async () => {
    let fail = true;
    route({
      actions: (url) => {
        if (url.searchParams.get('cursor') === 'c2') {
          return fail ? res({}, 500) : res({ actions: [action('2')], cursor: null });
        }
        return res({ actions: [action('1')], cursor: 'c2' });
      },
    });
    renderPage();
    await screen.findByText('Bill 1');
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText("Couldn't load more. Try again.")).toBeInTheDocument();
    expect(screen.getByText('Bill 1')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this record.")).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('Bill 2');
    expect(screen.queryByText("Couldn't load more. Try again.")).not.toBeInTheDocument();
    const cursors = actionCalls().map((u) => u.searchParams.get('cursor'));
    expect(cursors).toEqual([null, 'c2', 'c2']);
  });

  it('does not flash the empty message before the first fetch settles', async () => {
    route({ actions: () => new Promise(() => {}) });
    renderPage();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText('No actions match these filters.')).not.toBeInTheDocument();
  });
});

describe('office switcher', () => {
  const twoOffices = () =>
    res(record({
      terms: [
        { office_id: 'us-house-or-1', title: 'U.S. Representative', kind: 'legislator', jurisdiction: 'or', district: '1', start: '2015-01-03', end: '2017-01-03' },
        { office_id: 'us-house-or-1', title: 'U.S. Representative', kind: 'legislator', jurisdiction: 'or', district: '1', start: '2017-01-03', end: '2021-01-03' },
        { office_id: 'us-senate-or', title: 'U.S. Senator', kind: 'legislator', jurisdiction: 'or', district: null, start: '2021-01-03', end: null },
      ],
    }));

  it('is hidden with a single office', async () => {
    renderPage();
    await screen.findByText('Bill 1');
    expect(screen.queryByLabelText('Office')).not.toBeInTheDocument();
  });

  it('sets from and to to the office span', async () => {
    route({ official: twoOffices });
    renderPage();
    await screen.findByText('Bill 1');
    const select = screen.getByLabelText('Office') as HTMLSelectElement;
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'All offices',
      'U.S. Representative (2015–2021)',
      'U.S. Senator (2021–present)',
    ]);
    fireEvent.change(select, { target: { value: 'us-house-or-1' } });
    await waitFor(() => {
      const last = actionCalls()[actionCalls().length - 1];
      expect(last.searchParams.get('from')).toBe('2015-01-03');
      expect(last.searchParams.get('to')).toBe('2021-01-03');
    });
    fireEvent.change(screen.getByLabelText('Office'), { target: { value: 'us-senate-or' } });
    await waitFor(() => {
      const last = actionCalls()[actionCalls().length - 1];
      expect(last.searchParams.get('from')).toBe('2021-01-03');
      expect(last.searchParams.has('to')).toBe(false);
    });
  });
});

describe('errors and redirects', () => {
  it('replaces the URL when the id was redirected, keeping the query', async () => {
    renderPage('/poligraph/official/o_old?preset=sponsored');
    await waitFor(() =>
      expect(screen.getByTestId('loc')).toHaveTextContent('/poligraph/official/o_h?preset=sponsored'),
    );
    expect(await screen.findByText('Bill 1')).toBeInTheDocument();
    expect(actionCalls().every((u) => u.pathname.includes('/officials/o_h/'))).toBe(true);
    const officialCalls = (global.fetch as jest.Mock).mock.calls
      .map((c) => new URL(String(c[0])))
      .filter((u) => !u.pathname.endsWith('/actions'));
    expect(officialCalls[0].pathname).toMatch(/\/officials\/o_old$/);
  });

  it('replaces rather than pushes the redirected URL', async () => {
    function Back() {
      const navigate = useNavigate();
      return <button type="button" onClick={() => navigate(-1)}>test-back</button>;
    }
    render(
      <MemoryRouter initialEntries={['/poligraph', '/poligraph/official/o_old']} initialIndex={1}>
        <Routes>
          <Route path="/poligraph/official/:officialId" element={<PoliGraphOfficial />} />
          <Route path="/poligraph" element={<div>Landing</div>} />
        </Routes>
        <LocationDisplay />
        <Back />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/poligraph/official/o_h'));
    await screen.findByText('Bill 1');
    fireEvent.click(screen.getByRole('button', { name: 'test-back' }));
    await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('/poligraph'));
  });

  it('shows not found with a link back to search', async () => {
    route({ official: () => res({ error: 'official_not_found' }, 404) });
    renderPage();
    expect(await screen.findByText("We couldn't find that official.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to search' })).toHaveAttribute('href', '/poligraph');
  });

  it('shows a retryable error on a 500', async () => {
    route({ official: () => res({}, 500) });
    renderPage();
    expect(await screen.findByText("Couldn't load this record.")).toBeInTheDocument();
    route();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Maxine Three' })).toBeInTheDocument();
  });

  it('shows a retryable error on a network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('down')) as any;
    renderPage();
    expect(await screen.findByText("Couldn't load this record.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
