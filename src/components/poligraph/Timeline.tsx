import React, { useEffect, useMemo, useRef } from 'react';
import {
  actionLabel,
  groupByMonth,
  itemNumber,
  latestTerm,
  longDate,
  officeAt,
  shortDate,
} from '../../lib/poligraphFormat.ts';
import type { Action, Official } from '../../lib/poligraphTypes.ts';

interface TimelineProps {
  actions: Action[];
  official: Official;
  hasMore: boolean;
  loading: boolean;
  loadMoreError?: boolean;
  onLoadMore: () => void;
}

function Row({ action, latestOfficeId, official }: { action: Action; latestOfficeId: string | undefined; official: Official }) {
  return (
    <li className="poligraph-row">
      <span className="poligraph-row-date">{shortDate(action.date)}</span>
      <span className="poligraph-row-kind">{actionLabel(action.kind)}</span>
      <span className="poligraph-row-item">
        <span className="poligraph-row-number">{itemNumber(action.item_id)}</span>
        {action.item_title && <span className="poligraph-row-title">{action.item_title}</span>}
        {action.overridden_on && (
          <span className="poligraph-row-note">Overridden {longDate(action.overridden_on)}</span>
        )}
        {action.office_id !== latestOfficeId && (
          <span className="poligraph-row-note">as {officeAt(official, action.office_id)}</span>
        )}
        {action.topics.length > 0 && (
          <span className="poligraph-chips">
            {action.topics.map((t) => (
              <span key={t} className="poligraph-chip">{t}</span>
            ))}
          </span>
        )}
      </span>
      <a
        className="poligraph-row-source"
        href={action.source_url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Source
      </a>
    </li>
  );
}

const Timeline: React.FC<TimelineProps> = ({ actions, official, hasMore, loading, loadMoreError = false, onLoadMore }) => {
  // Every row links to its source: an entry without an http(s) one is never shown.
  const sourced = useMemo(() => actions.filter((a) => /^https?:\/\//i.test(a.source_url)), [actions]);
  const groups = useMemo(() => groupByMonth(sourced), [sourced]);
  const latestOfficeId = latestTerm(official)?.office_id;

  const sentinel = useRef<HTMLDivElement | null>(null);
  const loadMore = useRef(onLoadMore);
  loadMore.current = onLoadMore;

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || loading || loadMoreError || typeof window.IntersectionObserver === 'undefined') return;
    const observer = new window.IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore.current();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMoreError, actions.length]);

  return (
    <div className="poligraph-timeline">
      {groups.map((g) => (
        <section key={g.month} className="poligraph-month">
          <h2>{g.label}</h2>
          <ul className="poligraph-rows">
            {g.actions.map((a, i) => (
              <Row key={`${a.item_id}-${a.kind}-${a.date}-${i}`} action={a} latestOfficeId={latestOfficeId} official={official} />
            ))}
          </ul>
        </section>
      ))}
      {loading && <p role="status" className="poligraph-note">Loading…</p>}
      {!loading && groups.length === 0 && <p className="poligraph-note">No actions match these filters.</p>}
      {loadMoreError && (
        <div className="poligraph-error" role="alert">
          <p>Couldn't load more. Try again.</p>
          <button type="button" onClick={onLoadMore}>Retry</button>
        </div>
      )}
      {hasMore && (
        <>
          <div ref={sentinel} aria-hidden="true" />
          <button type="button" className="poligraph-more" disabled={loading} onClick={onLoadMore}>
            Load more
          </button>
        </>
      )}
    </div>
  );
};

export default Timeline;
