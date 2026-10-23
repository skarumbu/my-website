import { DailyLinkConfig } from './dailyLinksTypes.ts';

// One editable row in the links editor. The id is fixed when the row is
// created (an existing link's id, or a fresh one), so it doubles as the
// React key and survives reordering.
export interface DraftRow {
  id: string;
  label: string;
  url: string;
}

export type RowErrors = { label?: string; url?: string };

export type ValidationResult =
  | { ok: true; links: DailyLinkConfig[] }
  | { ok: false; errors: Record<string, RowErrors> };

export function newLinkId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyRow(): DraftRow {
  return { id: newLinkId(), label: '', url: '' };
}

export function toDraftRows(links: DailyLinkConfig[]): DraftRow[] {
  return links.map(({ id, label, url }) => ({ id, label, url }));
}

// A colon followed by a digit is a port ("localhost:3000"), not a scheme.
const SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/i;

// Returns the URL to store, or null when it isn't a usable http(s) link.
export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  // Chrome's URL parser percent-encodes a space in the host instead of
  // throwing, so "not a url" would otherwise pass.
  if (!trimmed || /\s/.test(trimmed)) return null;
  const withScheme = SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return withScheme;
  } catch {
    return null;
  }
}

export function validateRows(rows: DraftRow[]): ValidationResult {
  const errors: Record<string, RowErrors> = {};
  const links: DailyLinkConfig[] = [];
  for (const row of rows) {
    const label = row.label.trim();
    const rawUrl = row.url.trim();
    if (!label && !rawUrl) continue;
    const rowErrors: RowErrors = {};
    if (!label) rowErrors.label = 'Add a label.';
    const url = normalizeUrl(rawUrl);
    if (!rawUrl) rowErrors.url = 'Add a URL.';
    else if (!url) rowErrors.url = 'Use a web address, like example.com.';
    if (rowErrors.label || rowErrors.url) errors[row.id] = rowErrors;
    else links.push({ id: row.id, label, url: url! });
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, links };
}
