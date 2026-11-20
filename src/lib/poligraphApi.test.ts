import {
  fetchActions,
  fetchOfficial,
  fetchSearchIndex,
  lookupAddress,
  PoligraphError,
  shouldUseStub,
} from './poligraphApi.ts';

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number, body: unknown) => ({ ok: false, status, json: async () => body });
const fetchMock = () => global.fetch as jest.Mock;

beforeEach(() => {
  process.env.REACT_APP_POLIGRAPH_API_URL = 'http://pg.test';
  global.fetch = jest.fn().mockResolvedValue(ok({}));
});

afterEach(() => {
  delete process.env.REACT_APP_POLIGRAPH_API_URL;
  jest.restoreAllMocks();
});

it('fetchSearchIndex GETs the search-index and returns the array', async () => {
  fetchMock().mockResolvedValueOnce(ok([{ id: 'o_1' }]));
  expect(await fetchSearchIndex()).toEqual([{ id: 'o_1' }]);
  expect(fetchMock().mock.calls[0][0]).toBe('http://pg.test/api/officials/search-index');
});

it('fetchOfficial GETs the official and maps a 404 to PoligraphError', async () => {
  fetchMock().mockResolvedValueOnce(ok({ official: { id: 'o_1' }, counts: {}, freshness: [] }));
  await fetchOfficial('o_1');
  expect(fetchMock().mock.calls[0][0]).toBe('http://pg.test/api/officials/o_1');

  fetchMock().mockResolvedValueOnce(fail(404, { error: 'official_not_found' }));
  const err = await fetchOfficial('nope').catch((e) => e);
  expect(err).toBeInstanceOf(PoligraphError);
  expect(err.status).toBe(404);
  expect(err.code).toBe('official_not_found');
});

it('uses http_<status> as the code when the body has no error', async () => {
  fetchMock().mockResolvedValueOnce({ ok: false, status: 500, json: async () => { throw new Error('no json'); } });
  const err = await fetchOfficial('o_1').catch((e) => e);
  expect(err.code).toBe('http_500');
  expect(err.status).toBe(500);
});

it('fetchActions builds the query in order and omits unset keys', async () => {
  fetchMock().mockResolvedValueOnce(ok({ actions: [], cursor: null }));
  await fetchActions('o_1', { kind: ['vetoed', 'pocket_veto'], topic: 'Health', from: '2025-01-01' }, 'abc');
  expect(fetchMock().mock.calls[0][0]).toBe(
    'http://pg.test/api/officials/o_1/actions?kind=vetoed%2Cpocket_veto&topic=Health&from=2025-01-01&cursor=abc&limit=50',
  );
});

it('fetchActions sends key_votes=1 for keyVotes', async () => {
  fetchMock().mockResolvedValueOnce(ok({ actions: [], cursor: null }));
  await fetchActions('o_1', { keyVotes: true });
  const url: string = fetchMock().mock.calls[0][0];
  expect(url).toContain('key_votes=1');
  expect(url).not.toContain('cursor=');
});

it('lookupAddress POSTs the address in the body, never in the URL', async () => {
  fetchMock().mockResolvedValueOnce(ok({ federal: [], state: [] }));
  await lookupAddress('1 Main St');
  const [url, init] = fetchMock().mock.calls[0];
  expect(url).toBe('http://pg.test/api/lookup');
  expect(url).not.toContain('?');
  expect(init.method).toBe('POST');
  expect(init.headers['Content-Type']).toBe('application/json');
  expect(init.body).toBe('{"address":"1 Main St"}');
});

it('lookupAddress surfaces lookup_unavailable on 503', async () => {
  fetchMock().mockResolvedValueOnce(fail(503, { error: 'lookup_unavailable' }));
  const err = await lookupAddress('1 Main St').catch((e) => e);
  expect(err).toBeInstanceOf(PoligraphError);
  expect(err.code).toBe('lookup_unavailable');
});

it('never leaks the address into the error message or console', async () => {
  const spies = (['log', 'error', 'warn'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
  console.log('positive control');
  expect(spies[0]).toHaveBeenCalledWith('positive control');
  spies.forEach((spy) => spy.mockClear());
  fetchMock().mockResolvedValueOnce(fail(404, { error: 'address_not_found', address: '1 Main St' }));
  const err = await lookupAddress('1 Main St').catch((e) => e);
  expect(err).toBeInstanceOf(PoligraphError);
  expect(err.code).toBe('address_not_found');
  expect(err.message).not.toContain('1 Main St');
  for (const spy of spies) {
    expect(JSON.stringify(spy.mock.calls)).not.toContain('1 Main St');
  }
});

it('rejects a 200 with a non-JSON body as bad_response', async () => {
  fetchMock().mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } });
  const err = await fetchSearchIndex().catch((e) => e);
  expect(err).toBeInstanceOf(PoligraphError);
  expect(err.code).toBe('bad_response');
  expect(err.status).toBe(200);
});

it('rejects with not_configured, without calling fetch, when the API URL is unset', async () => {
  delete process.env.REACT_APP_POLIGRAPH_API_URL;
  const err = await fetchSearchIndex().catch((e) => e);
  expect(err).toBeInstanceOf(PoligraphError);
  expect(err.code).toBe('not_configured');
  expect(err.status).toBe(0);
  expect(fetchMock()).not.toHaveBeenCalled();
});

it('maps a network failure to PoligraphError status 0 code network', async () => {
  fetchMock().mockRejectedValueOnce(new TypeError('Failed to fetch 1 Main St'));
  const err = await lookupAddress('1 Main St').catch((e) => e);
  expect(err).toBeInstanceOf(PoligraphError);
  expect(err.status).toBe(0);
  expect(err.code).toBe('network');
  expect(err.message).not.toContain('1 Main St');
});

describe('shouldUseStub', () => {
  it('is true only in development with no API URL', () => {
    expect(shouldUseStub({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(true);
    expect(
      shouldUseStub({ NODE_ENV: 'development', REACT_APP_POLIGRAPH_API_URL: 'http://x' } as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(shouldUseStub({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(false);
    expect(shouldUseStub({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe('stub mode', () => {
  const dev = (value: string) => {
    (process.env as Record<string, string | undefined>).NODE_ENV = value;
  };
  let originalEnv: string | undefined;
  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    delete process.env.REACT_APP_POLIGRAPH_API_URL;
    dev('development');
  });
  afterEach(() => dev(originalEnv as string));

  it('serves every fetch function from the stub without calling fetch', async () => {
    const index = await fetchSearchIndex();
    expect(index.length).toBeGreaterThan(0);
    const record = await fetchOfficial(index[0].id);
    expect(record.official.id).toBe(index[0].id);
    const page = await fetchActions(index[0].id, {});
    expect(Array.isArray(page.actions)).toBe(true);
    const found = await lookupAddress('1 Main St');
    expect(found.federal.length).toBeGreaterThan(0);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it('paginates the House member stub by slicing at 50', async () => {
    const index = await fetchSearchIndex();
    const house = index.find((r) => r.state === 'or' && r.district === '3');
    if (!house) throw new Error('stub missing or-3 member');
    const first = await fetchActions(house.id, {});
    expect(first.actions).toHaveLength(50);
    expect(first.cursor).not.toBeNull();
    const second = await fetchActions(house.id, {}, first.cursor);
    expect(second.actions.length).toBeGreaterThan(0);
    expect(second.cursor).toBeNull();
  });

  it('rejects an unknown official with official_not_found', async () => {
    const err = await fetchOfficial('nobody').catch((e) => e);
    expect(err).toBeInstanceOf(PoligraphError);
    expect(err.code).toBe('official_not_found');
  });
});
