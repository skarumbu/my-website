import { useEffect, useState } from 'react';
import type { VersionSummary, DiffResult } from './lib/versionTypes.ts';
import './styling/version-history.css';

// Injected-client shape so this component has no knowledge of which backend
// (posts-api's proxy routes + bearer token, or history-api's public routes)
// it's talking to — see src/lib/postsApiVersionClient.ts for the posts/diary
// adapter and src/architecture/historyApi.ts for the architecture-wiki one.
export type VersionHistoryClient = {
  listVersions: () => Promise<VersionSummary[]>;
  diff: (v1: string, v2: string) => Promise<DiffResult>;
};

type Props = {
  client: VersionHistoryClient;
  // Architecture versions are all written with the machine key (author is
  // always "machine" — see save_version.go), so the author column carries no
  // signal there. posts/diary versions have real per-user authors.
  showAuthor?: boolean;
};

export function VersionHistoryPanel({ client, showAuthor = true }: Props) {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [selected, setSelected] = useState<[string, string] | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    client
      .listVersions()
      .then((v) => setVersions(v))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, [client]);

  useEffect(() => {
    if (!selected) return;
    setDiff(null);
    const [v1, v2] = selected;
    client
      .diff(v1, v2)
      .then(setDiff)
      .catch(() => setDiff(null));
  }, [client, selected]);

  if (loading) return null;
  if (versions.length === 0) return null;

  return (
    <details className="version-history-panel">
      <summary>Version history ({versions.length})</summary>
      <ul className="version-history-list">
        {versions.map((v, i) => (
          <li key={v.version_id} className="version-history-entry">
            <span className="version-history-date">{new Date(v.created_at).toLocaleString()}</span>
            {showAuthor && v.author && <span className="version-history-author">{v.author}</span>}
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
