import { isApiConfigured } from './dailyApi.ts';
import { fetchDueCards } from './dailyCardsApi.ts';

beforeEach(() => {
  process.env.REACT_APP_POSTS_API_BASE_URL = 'http://posts.test';
  process.env.REACT_APP_DAILY_API_BASE_URL = 'http://daily.test';
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: [] }) });
});

afterEach(() => {
  delete process.env.REACT_APP_POSTS_API_BASE_URL;
  delete process.env.REACT_APP_DAILY_API_BASE_URL;
});

it('sends daily calls to the daily-api base URL, not the posts-api one', async () => {
  await fetchDueCards('t', '2026-10-16');
  const [url] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe('http://daily.test/api/daily/cards/due?date=2026-10-16&limit=20');
});

it('is not configured when only the posts-api base URL is set', () => {
  delete process.env.REACT_APP_DAILY_API_BASE_URL;
  expect(isApiConfigured()).toBe(false);
});

it('fetchAllCards GETs /cards and unwraps items', async () => {
  const { fetchAllCards } = await import('./dailyCardsApi.ts');
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [{ id: 'a' }] }) });
  expect(await fetchAllCards('t')).toEqual([{ id: 'a' }]);
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('http://daily.test/api/daily/cards');
});

it('updateIndexCard PATCHes text/back and throws unauthorized on 401', async () => {
  const { updateIndexCard } = await import('./dailyCardsApi.ts');
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'a' }) });
  await updateIndexCard('t', 'a', { text: 'x', back: 'y' });
  const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe('http://daily.test/api/daily/cards/a');
  expect(init.method).toBe('PATCH');
  expect(JSON.parse(init.body)).toEqual({ text: 'x', back: 'y' });

  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
  await expect(updateIndexCard('t', 'a', { text: 'x' })).rejects.toThrow('unauthorized');
});
