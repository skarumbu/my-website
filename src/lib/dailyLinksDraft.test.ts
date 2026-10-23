import { emptyRow, newLinkId, normalizeUrl, toDraftRows, validateRows } from './dailyLinksDraft.ts';

it('normalizeUrl prepends https:// when there is no scheme', () => {
  expect(normalizeUrl('news.ycombinator.com')).toBe('https://news.ycombinator.com');
  expect(normalizeUrl('  example.com/a?b=1  ')).toBe('https://example.com/a?b=1');
  expect(normalizeUrl('localhost:3000')).toBe('https://localhost:3000');
});

it('normalizeUrl keeps http and https URLs as typed', () => {
  expect(normalizeUrl('http://example.com')).toBe('http://example.com');
  expect(normalizeUrl('https://example.com/x')).toBe('https://example.com/x');
});

it('normalizeUrl rejects other schemes and garbage', () => {
  expect(normalizeUrl('javascript:alert(1)')).toBeNull();
  expect(normalizeUrl('ftp://example.com')).toBeNull();
  expect(normalizeUrl('mailto:a@b.com')).toBeNull();
  expect(normalizeUrl('not a url')).toBeNull();
  expect(normalizeUrl('https://')).toBeNull();
  expect(normalizeUrl('   ')).toBeNull();
});

it('validateRows silently drops rows with both fields blank', () => {
  const result = validateRows([
    { id: 'a', label: 'HN', url: 'news.ycombinator.com' },
    { id: 'b', label: '  ', url: '' },
  ]);
  expect(result).toEqual({ ok: true, links: [{ id: 'a', label: 'HN', url: 'https://news.ycombinator.com' }] });
});

it('validateRows requires a trimmed label and a URL', () => {
  const result = validateRows([
    { id: 'a', label: '   ', url: 'example.com' },
    { id: 'b', label: 'Docs', url: '' },
    { id: 'c', label: 'Bad', url: 'javascript:alert(1)' },
  ]);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(Object.keys(result.errors)).toEqual(['a', 'b', 'c']);
  expect(result.errors.a.label).toBeTruthy();
  expect(result.errors.a.url).toBeUndefined();
  expect(result.errors.b.url).toBeTruthy();
  expect(result.errors.c.url).toBeTruthy();
});

it('validateRows keeps existing ids, order and trims labels', () => {
  const rows = toDraftRows([
    { id: 'x1', label: 'One', url: 'https://one.example' },
    { id: 'x2', label: 'Two', url: 'https://two.example' },
  ]);
  const result = validateRows([rows[1], { ...rows[0], label: ' One edited ' }]);
  expect(result).toEqual({
    ok: true,
    links: [
      { id: 'x2', label: 'Two', url: 'https://two.example' },
      { id: 'x1', label: 'One edited', url: 'https://one.example' },
    ],
  });
});

it('new rows get distinct ids that carry through validation', () => {
  const a = emptyRow();
  const b = emptyRow();
  expect(a.id).not.toBe(b.id);
  const result = validateRows([{ ...a, label: 'New', url: 'new.example' }]);
  expect(result.ok && result.links[0].id).toBe(a.id);
});

// jsdom has no Web Crypto, so the fallback is what runs unless a test stubs it.
it('newLinkId falls back when crypto.randomUUID is unavailable', () => {
  const a = newLinkId();
  const b = newLinkId();
  expect(a).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
  expect(a).not.toBe(b);
});

it('newLinkId uses crypto.randomUUID when available', () => {
  const g = globalThis as any;
  const original = g.crypto;
  g.crypto = { randomUUID: () => 'uuid-1' };
  try {
    expect(newLinkId()).toBe('uuid-1');
  } finally {
    g.crypto = original;
  }
});
