import {
  listPages,
  getPage,
  getCachedPage,
  clearPageCache,
  listVersions,
  getVersion,
  diff,
} from './historyApi';

beforeEach(() => {
  global.fetch = jest.fn();
  process.env.REACT_APP_HISTORY_API_BASE_URL = 'https://history-api.invalid/api';
  clearPageCache();
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.REACT_APP_HISTORY_API_BASE_URL;
});

function okJson(body: unknown) {
  return { ok: true, json: async () => body };
}

test('listPages fetches the section document list', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce(
    okJson({ documents: [{ slug: 'digits', latest_version_id: 'v1', content_type: 'json', visibility: 'public' }] }),
  );

  const docs = await listPages();

  expect(docs).toEqual([{ slug: 'digits', latest_version_id: 'v1', content_type: 'json', visibility: 'public' }]);
  expect(global.fetch).toHaveBeenCalledWith('https://history-api.invalid/api/sections/architecture/documents');
});

test('getPage parses the version content as JSON', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce(
    okJson({ content: JSON.stringify({ key: 'digits', title: 'digits', description: 'd', relatedPages: [] }) }),
  );

  const page = await getPage('digits');

  expect(page).toEqual({ key: 'digits', title: 'digits', description: 'd', relatedPages: [] });
  expect(global.fetch).toHaveBeenCalledWith('https://history-api.invalid/api/sections/architecture/documents/digits');
});

test('getPage caches by key — a second call makes no fetch', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce(
    okJson({ content: JSON.stringify({ key: 'digits', title: 'digits', description: 'd' }) }),
  );

  await getPage('digits');
  await getPage('digits');

  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(getCachedPage('digits')).toEqual({ key: 'digits', title: 'digits', description: 'd' });
});

test('getCachedPage returns undefined for an uncached key', () => {
  expect(getCachedPage('never-fetched')).toBeUndefined();
});

test('clearPageCache empties the cache', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce(
    okJson({ content: JSON.stringify({ key: 'digits', title: 'digits', description: 'd' }) }),
  );
  await getPage('digits');
  clearPageCache();
  expect(getCachedPage('digits')).toBeUndefined();
});

test('getPage throws with the status code on a non-OK response', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 401 });
  await expect(getPage('digits')).rejects.toThrow('401');
});

test('getPage throws when REACT_APP_HISTORY_API_BASE_URL is not configured', async () => {
  delete process.env.REACT_APP_HISTORY_API_BASE_URL;
  await expect(getPage('digits')).rejects.toThrow('REACT_APP_HISTORY_API_BASE_URL');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('listVersions fetches the document version list', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ versions: [{ version_id: 'v1' }] }));

  const versions = await listVersions('digits');

  expect(versions).toEqual([{ version_id: 'v1' }]);
  expect(global.fetch).toHaveBeenCalledWith(
    'https://history-api.invalid/api/documents/architecture::digits/versions',
  );
});

test('getVersion fetches a single version', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ version_id: 'v1', content: '{}' }));

  const version = await getVersion('digits', 'v1');

  expect(version).toEqual({ version_id: 'v1', content: '{}' });
  expect(global.fetch).toHaveBeenCalledWith(
    'https://history-api.invalid/api/documents/architecture::digits/versions/v1',
  );
});

test('diff fetches the diff between two versions', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ text_diff: '-a\n+b', attachment_changes: [] }));

  const result = await diff('digits', 'v1', 'v2');

  expect(result.text_diff).toBe('-a\n+b');
  expect(global.fetch).toHaveBeenCalledWith(
    'https://history-api.invalid/api/documents/architecture::digits/versions/v1/diff/v2',
  );
});
