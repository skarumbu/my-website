// Runtime client for the architecture wiki's history-api documents.
//
// Step 5 of the architecture-wiki -> history-api migration: the frontend no
// longer imports the bundled src/architecture-pages.json at build time — it
// fetches the current effective page (already template-merged server-side,
// see arch_effective_page.py) directly from history-api on every visit. See
// docs/design/2026-09-01-architecture-wiki-history-migration-design.md (in
// the history-api repo) for the full design.
//
// The `architecture` section is public, so every call here is an
// unauthenticated GET — no token, no Authorization header.

import type { Page, PackagePage } from './pageTypes.ts';
import type { VersionSummary, DiffResult } from '../lib/versionTypes.ts';

const SECTION = 'architecture';

// Read at call time, not module load time, so tests can set process.env
// before rendering (same convention as src/lib/postsApi.ts).
function baseUrl(): string {
  const url = process.env.REACT_APP_HISTORY_API_BASE_URL;
  if (!url) throw new Error('REACT_APP_HISTORY_API_BASE_URL is not configured');
  return url;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`);
  if (!res.ok) {
    throw new Error(`history-api ${path} -> ${res.status}`);
  }
  return res.json();
}

export type DocumentSummary = {
  slug: string;
  latest_version_id: string;
  content_type: string;
  visibility: string;
};

export async function listPages(): Promise<DocumentSummary[]> {
  const data = await getJson<{ documents: DocumentSummary[] }>(`/sections/${SECTION}/documents`);
  return data.documents;
}

// Pages rarely change mid-session; the index view's N+1 (listPages() then
// getPage() per page) and a PageDetail visit for the same page both hit this
// cache, so navigating from the index into a page it already fetched costs
// no extra round trip.
const pageCache = new Map<string, Page | PackagePage>();

export async function getPage(key: string): Promise<Page | PackagePage> {
  const cached = pageCache.get(key);
  if (cached) return cached;
  const version = await getJson<{ content: string }>(`/sections/${SECTION}/documents/${key}`);
  const page = JSON.parse(version.content) as Page | PackagePage;
  pageCache.set(key, page);
  return page;
}

// Synchronous cache peek — used where a fallback (e.g. the raw key) is
// acceptable while the real title loads.
export function getCachedPage(key: string): Page | PackagePage | undefined {
  return pageCache.get(key);
}

export function clearPageCache(): void {
  pageCache.clear();
}

export async function listVersions(key: string): Promise<VersionSummary[]> {
  const data = await getJson<{ versions: VersionSummary[] }>(`/documents/${SECTION}::${key}/versions`);
  return data.versions;
}

export async function getVersion(key: string, versionId: string): Promise<VersionSummary & { content: string }> {
  return getJson(`/documents/${SECTION}::${key}/versions/${versionId}`);
}

export async function diff(key: string, v1: string, v2: string): Promise<DiffResult> {
  return getJson(`/documents/${SECTION}::${key}/versions/${v1}/diff/${v2}`);
}
