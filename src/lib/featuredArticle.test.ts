import { fetchFeaturedArticle } from './featuredArticle.ts';

beforeEach(() => {
  global.fetch = jest.fn();
  sessionStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
});

it('fetches and parses today’s featured article from the Wikipedia feed', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({
      tfa: {
        titles: { normalized: 'Example Article' },
        extract: 'A short summary of the article.',
        content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Example_Article' } },
      },
    }),
  });

  const article = await fetchFeaturedArticle();
  expect(article).toEqual({
    title: 'Example Article',
    extract: 'A short summary of the article.',
    url: 'https://en.wikipedia.org/wiki/Example_Article',
  });
});

it('caches the result in sessionStorage so a second call in the same day skips the fetch', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({
      tfa: {
        titles: { normalized: 'Cached Article' },
        extract: 'Cached.',
        content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Cached_Article' } },
      },
    }),
  });

  await fetchFeaturedArticle();
  await fetchFeaturedArticle();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it('throws when the feed has no featured article for today', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
  await expect(fetchFeaturedArticle()).rejects.toThrow();
});
