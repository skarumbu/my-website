import type {
  ActionPage,
  ActionQuery,
  IndexRow,
  LookupResult,
  OfficialRecord,
} from './poligraphTypes.ts';
import { stubActions, stubIndex, stubLookup, stubOfficial } from './poligraphStub.ts';

export function poligraphUrl(path: string): string {
  return `${process.env.REACT_APP_POLIGRAPH_API_URL}/api/${path}`;
}

export function isApiConfigured(): boolean {
  return !!process.env.REACT_APP_POLIGRAPH_API_URL;
}

/** Stubs are for local development only; setting the API URL points dev at a real API. */
export function shouldUseStub(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'development' && !env.REACT_APP_POLIGRAPH_API_URL;
}

export class PoligraphError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    // The message carries only the code: nothing from a request or response body.
    super(`PoliGraph request failed: ${code}`);
    this.name = 'PoligraphError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(poligraphUrl(path), init);
  } catch {
    throw new PoligraphError(0, 'network');
  }
  if (!res.ok) {
    let code = `http_${res.status}`;
    try {
      const body = await res.json();
      if (body && typeof body.error === 'string') code = body.error;
    } catch {
      // keep the http_<status> code
    }
    throw new PoligraphError(res.status, code);
  }
  return (await res.json()) as T;
}

function orNotFound<T>(value: T | null): T {
  if (value === null) throw new PoligraphError(404, 'official_not_found');
  return value;
}

export async function fetchSearchIndex(): Promise<IndexRow[]> {
  if (shouldUseStub()) return stubIndex();
  return request<IndexRow[]>('officials/search-index');
}

export async function fetchOfficial(id: string): Promise<OfficialRecord> {
  if (shouldUseStub()) return orNotFound(stubOfficial(id));
  return request<OfficialRecord>(`officials/${encodeURIComponent(id)}`);
}

export async function fetchActions(
  id: string,
  q: ActionQuery,
  cursor?: string | null,
  limit = 50,
): Promise<ActionPage> {
  if (shouldUseStub()) return orNotFound(stubActions(id, q, cursor, limit));
  const params = new URLSearchParams();
  if (q.kind?.length) params.set('kind', q.kind.join(','));
  if (q.topic) params.set('topic', q.topic);
  if (q.from) params.set('from', q.from);
  if (q.to) params.set('to', q.to);
  if (q.keyVotes) params.set('key_votes', '1');
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));
  return request<ActionPage>(`officials/${encodeURIComponent(id)}/actions?${params.toString()}`);
}

/** The address goes only in the POST body: never in the URL, an error message or a log. */
export async function lookupAddress(address: string): Promise<LookupResult> {
  if (shouldUseStub()) return stubLookup();
  return request<LookupResult>('lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });
}
