import { createPostsApiVersionClient } from './postsApiVersionClient';

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.REACT_APP_POSTS_API_BASE_URL;
});

test('listVersions hits the posts-api proxy route with a bearer token', async () => {
  process.env.REACT_APP_POSTS_API_BASE_URL = 'http://test.local';
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ versions: [{ version_id: 'v1' }] }),
  });

  const client = createPostsApiVersionClient('writing', 'hello', 'tok-123');
  const versions = await client.listVersions();

  expect(versions).toEqual([{ version_id: 'v1' }]);
  expect(global.fetch).toHaveBeenCalledWith(
    'http://test.local/api/sections/writing/items/hello/versions',
    { headers: { Authorization: 'Bearer tok-123' } },
  );
});

test('listVersions with no token sends no Authorization header', async () => {
  process.env.REACT_APP_POSTS_API_BASE_URL = 'http://test.local';
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ versions: [] }) });

  const client = createPostsApiVersionClient('diary', 'hello', null);
  await client.listVersions();

  expect(global.fetch).toHaveBeenCalledWith(
    'http://test.local/api/sections/diary/items/hello/versions',
    { headers: {} },
  );
});

test('listVersions returns [] when the base URL is not configured', async () => {
  delete process.env.REACT_APP_POSTS_API_BASE_URL;
  const client = createPostsApiVersionClient('writing', 'hello', null);
  await expect(client.listVersions()).resolves.toEqual([]);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('diff hits the proxy diff route and returns the parsed result', async () => {
  process.env.REACT_APP_POSTS_API_BASE_URL = 'http://test.local';
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ text_diff: '-a\n+b', attachment_changes: [] }),
  });

  const client = createPostsApiVersionClient('writing', 'hello', 'tok-123');
  const result = await client.diff('v1', 'v2');

  expect(result.text_diff).toBe('-a\n+b');
  expect(global.fetch).toHaveBeenCalledWith(
    'http://test.local/api/sections/writing/items/hello/versions/v1/diff/v2',
    { headers: { Authorization: 'Bearer tok-123' } },
  );
});

test('diff throws when the base URL is not configured', async () => {
  delete process.env.REACT_APP_POSTS_API_BASE_URL;
  const client = createPostsApiVersionClient('writing', 'hello', null);
  await expect(client.diff('v1', 'v2')).rejects.toThrow('REACT_APP_POSTS_API_BASE_URL');
});
