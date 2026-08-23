import { useEffect, useState } from 'react';
import type { VersionSummary, DiffResult } from './lib/versionTypes.ts';
import './styling/version-history.css';

type Props = {
  section: string;
  slug: string;
  token: string | null;
};

export function VersionHistoryPanel({ section, slug, token }: Props) {
  const BASE_URL = process.env.REACT_APP_POSTS_API_BASE_URL;
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [selected, setSelected] = useState<[string, string] | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!BASE_URL) return;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${BASE_URL}/api/sections/${section}/items/${slug}/versions`, { headers })
      .then((r) => (r.ok ? r.json() : { versions: [] }))
      .then((data) => setVersions(data.versions || []))
      .finally(() => setLoading(false));
  }, [BASE_URL, section, slug, token]);

  useEffect(() => {
    if (!selected || !BASE_URL) return;
    setDiff(null);
    const [v1, v2] = selected;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${BASE_URL}/api/sections/${section}/items/${slug}/versions/${v1}/diff/${v2}`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then(setDiff)
      .catch(() => setDiff(null));
  }, [BASE_URL, selected, section, slug, token]);

  if (loading) return null;
  if (versions.length === 0) return null;

  return (
    <details className="version-history-panel">
      <summary>Version history ({versions.length})</summary>
      <ul className="version-history-list">
        {versions.map((v, i) => (
          <li key={v.version_id} className="version-history-entry">
            <span className="version-history-date">{new Date(v.created_at).toLocaleString()}</span>
            {v.author && <span className="version-history-author">{v.author}</span>}
            <span className="version-history-message">{v.message}</span>
            {i < versions.length - 1 && (
              <button
                className="version-history-diff-btn"
                aria-label={`Compare ${versions[i + 1].version_id} to ${v.version_id}`}
                onClick={() => setSelected([versions[i + 1].version_id, v.version_id])}
              >
                Diff vs previous
              </button>
            )}
          </li>
        ))}
      </ul>
      {diff && (
        <pre className="version-history-diff">{diff.text_diff}</pre>
      )}
    </details>
  );
}
