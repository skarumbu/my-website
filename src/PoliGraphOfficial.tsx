import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import NavBar from './components/nav-bar.tsx';
import RecordFilters, { DEFAULT_FILTERS, queryFor } from './components/poligraph/RecordFilters.tsx';
import type { FilterState } from './components/poligraph/RecordFilters.tsx';
import Timeline from './components/poligraph/Timeline.tsx';
import { fetchActions, fetchOfficial, PoligraphError } from './lib/poligraphApi.ts';
import {
  freshnessSummary,
  isExecutive,
  latestTerm,
  longDate,
  officeLabel,
  sinceYear,
  stateName,
} from './lib/poligraphFormat.ts';
import { TOPICS } from './lib/poligraphTypes.ts';
import type { Action, OfficialRecord } from './lib/poligraphTypes.ts';
import './styling/poligraph.css';

type LoadError = 'not_found' | 'failed';

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function sum(counts: Record<string, number>, keys: string[]): number {
  return keys.reduce((total, k) => total + (counts[k] ?? 0), 0);
}

function countsLine(record: OfficialRecord): string {
  const c = record.counts;
  const parts: [number, string, string][] = isExecutive(record.official)
    ? [
        [c.signed ?? 0, 'signed', 'signed'],
        [sum(c, ['vetoed', 'line_item_veto', 'pocket_veto']), 'vetoed', 'vetoed'],
        [c.executive_order ?? 0, 'executive order', 'executive orders'],
      ]
    : [
        [c.sponsored ?? 0, 'sponsored', 'sponsored'],
        [c.cosponsored ?? 0, 'co-sponsored', 'co-sponsored'],
        [sum(c, ['vote_yes', 'vote_no', 'vote_present', 'vote_not_voting']), 'vote', 'votes'],
      ];
  return parts
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => plural(n, one, many))
    .join(' · ');
}

function jurisdictionName(code: string): string {
  return code.toLowerCase() === 'us' ? 'United States' : stateName(code);
}

function validDate(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : '';
}

function validTopic(value: string | null): string {
  return value && TOPICS.includes(value) ? value : '';
}

const PoliGraphOfficial: React.FC = () => {
  const { officialId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [record, setRecord] = useState<OfficialRecord | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [actions, setActions] = useState<Action[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [moreError, setMoreError] = useState(false);
  const [actionsError, setActionsError] = useState(false);
  const [actionsAttempt, setActionsAttempt] = useState(0);
  const requestId = useRef<number>(0);

  const filters: FilterState = {
    preset: searchParams.get('preset') || DEFAULT_FILTERS.preset,
    topic: validTopic(searchParams.get('topic')),
    from: validDate(searchParams.get('from')),
    to: validDate(searchParams.get('to')),
  };

  useEffect(() => {
    let cancelled = false;
    setRecord(null);
    setError(null);
    setLoading(true);
    fetchOfficial(officialId)
      .then((r) => {
        if (cancelled) return;
        if (r.official.id !== officialId) {
          // The API followed a redirect to the canonical id: show that id in the URL.
          navigate(`/poligraph/official/${encodeURIComponent(r.official.id)}${location.search}`, { replace: true });
          return;
        }
        setRecord(r);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof PoligraphError && e.code === 'official_not_found' ? 'not_found' : 'failed');
      });
    return () => {
      cancelled = true;
    };
    // location.search is read for the redirect only; filter changes must not refetch the official.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officialId, attempt, navigate]);

  const official = record?.official ?? null;
  const { preset, topic, from, to } = filters;

  useEffect(() => {
    if (!official) return;
    const id = ++requestId.current;
    setActions([]);
    setCursor(null);
    setMoreError(false);
    setActionsError(false);
    setLoading(true);
    fetchActions(official.id, queryFor(official, { preset, topic, from, to }))
      .then((page) => {
        if (id !== requestId.current) return;
        setActions(page.actions);
        setCursor(page.cursor);
        setLoading(false);
      })
      .catch(() => {
        if (id !== requestId.current) return;
        setLoading(false);
        setActionsError(true);
      });
  }, [official, preset, topic, from, to, actionsAttempt]);

  const retryActions = useCallback(() => setActionsAttempt((n) => n + 1), []);

  const loadMore = useCallback(() => {
    if (!official || !cursor) return;
    const id = ++requestId.current;
    setMoreError(false);
    setLoading(true);
    fetchActions(official.id, queryFor(official, { preset, topic, from, to }), cursor)
      .then((page) => {
        if (id !== requestId.current) return;
        setActions((prev) => [...prev, ...page.actions]);
        setCursor(page.cursor);
        setLoading(false);
      })
      .catch(() => {
        if (id !== requestId.current) return;
        setLoading(false);
        setMoreError(true);
      });
  }, [official, cursor, preset, topic, from, to]);

  useEffect(() => {
    if (!official) return;
    const previous = document.title;
    document.title = `${official.name} · PoliGraph`;
    return () => {
      document.title = previous;
    };
  }, [official]);

  const onFiltersChange = useCallback(
    (next: FilterState) => {
      const params = new URLSearchParams();
      if (next.preset && next.preset !== 'default') params.set('preset', next.preset);
      if (next.topic) params.set('topic', next.topic);
      if (next.from) params.set('from', next.from);
      if (next.to) params.set('to', next.to);
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const freshness = useMemo(() => (record ? freshnessSummary(record.freshness) : null), [record]);

  let body: React.ReactNode;
  if (error === 'not_found') {
    body = (
      <div className="poligraph-error" role="alert">
        <p>We couldn't find that official.</p>
        <Link to="/poligraph">Back to search</Link>
      </div>
    );
  } else if (error === 'failed') {
    body = (
      <div className="poligraph-error" role="alert">
        <p>Couldn't load this record.</p>
        <button type="button" onClick={retry}>Retry</button>
      </div>
    );
  } else if (!record || !official || !freshness) {
    body = <p role="status" className="poligraph-note">Loading…</p>;
  } else {
    const term = latestTerm(official);
    const since = official.current ? sinceYear(official) : null;
    const counts = countsLine(record);
    body = (
      <>
        <header className="poligraph-profile">
          <h1>{official.name}</h1>
          {official.party && <p className="poligraph-party">{official.party}</p>}
          {term && (
            <p className="poligraph-term">
              {officeLabel(term.title, term.office_id) !== term.title ? (
                <span>{officeLabel(term.title, term.office_id)}</span>
              ) : (
                <>
                  <span>{term.title}</span> · <span>{jurisdictionName(term.jurisdiction)}</span>
                </>
              )}
            </p>
          )}
          {since && <p className="poligraph-since">Since {since}</p>}
          {counts && <p className="poligraph-counts">{counts}</p>}
        </header>

        <div className="poligraph-freshness">
          {freshness.updated ? (
            <p>Data last updated {longDate(freshness.updated)}</p>
          ) : (
            <p>This record hasn't synced yet.</p>
          )}
          {freshness.updated && freshness.stale.length > 0 && (
            <p className="poligraph-stale" role="alert">
              {freshness.stale.join(' and ')} data hasn't updated in over 2 days, so this record may be
              missing recent actions.
            </p>
          )}
        </div>

        <RecordFilters official={official} value={filters} onChange={onFiltersChange} />
        {actionsError ? (
          <div className="poligraph-error" role="alert">
            <p>Couldn't load actions.</p>
            <button type="button" onClick={retryActions}>Retry</button>
          </div>
        ) : (
          <Timeline
            actions={actions}
            official={official}
            hasMore={cursor !== null}
            loading={loading}
            loadMoreError={moreError}
            onLoadMore={loadMore}
          />
        )}
      </>
    );
  }

  return (
    <div className="poligraph-page">
      <NavBar />
      <main className="poligraph-content">{body}</main>
    </div>
  );
};

export default PoliGraphOfficial;
