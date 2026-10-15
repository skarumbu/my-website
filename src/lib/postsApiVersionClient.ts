import type { VersionHistoryClient } from '../VersionHistoryPanel.tsx';
import type { VersionSummary, DiffResult } from './versionTypes.ts';

/**
 * VersionHistoryClient adapter for posts-api's proxy routes (used by
 * WriteEditor and DiaryEditor). Owns the REACT_APP_POSTS_API_BASE_URL /
 * bearer-token logic that VersionHistoryPanel itself no longer knows about.
 *
 * Reads REACT_APP_POSTS_API_BASE_URL at call time, not module load time, so
 * tests can set process.env before rendering (same convention as
 * src/lib/postsApi.ts).
 */
export function createPostsApiVersionClient(
  section: string,
  slug: string,
  token: string | null,
): VersionHistoryClient {
  const headers = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

  return {
    async listVersions(): Promise<VersionSummary[]> {
      const baseUrl = process.env.REACT_APP_POSTS_API_BASE_URL;
      if (!baseUrl) return [];
      const res = await fetch(`${baseUrl}/api/sections/${section}/items/${slug}/versions`, { headers: headers() });
      if (!res.ok) return [];
      const data = await res.json();
      return data.versions || [];
    },
    async diff(v1: string, v2: string): Promise<DiffResult> {
      const baseUrl = process.env.REACT_APP_POSTS_API_BASE_URL;
      if (!baseUrl) throw new Error('REACT_APP_POSTS_API_BASE_URL is not configured');
      const res = await fetch(
        `${baseUrl}/api/sections/${section}/items/${slug}/versions/${v1}/diff/${v2}`,
        { headers: headers() },
      );
      if (!res.ok) throw new Error(`diff fetch failed: ${res.status}`);
      return res.json();
    },
  };
}
