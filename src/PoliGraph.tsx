import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import NavBar from './components/nav-bar.tsx';
import { AddressForm } from './PoliGraphLookup.tsx';
import { fetchSearchIndex } from './lib/poligraphApi.ts';
import { searchOfficials, stateName } from './lib/poligraphFormat.ts';
import type { IndexRow } from './lib/poligraphTypes.ts';
import './styling/poligraph.css';

type Status = 'loading' | 'ready' | 'error';

function officialPath(row: IndexRow): string {
  return `/poligraph/official/${row.id}`;
}

function districtOrder(row: IndexRow): number {
  if (row.district === null || row.district === 'at-large') return 0;
  const n = Number(row.district);
  return Number.isNaN(n) ? 0 : n;
}

function congressMembers(index: IndexRow[], state: string): IndexRow[] {
  const inState = index.filter((r) => r.current && r.state === state);
  const senators = inState
    .filter((r) => r.office_id?.startsWith('us-senate-'))
    .sort((a, b) => a.name.localeCompare(b.name));
  const house = inState
    .filter((r) => r.office_id?.startsWith('us-house-'))
    .sort((a, b) => districtOrder(a) - districtOrder(b));
  return [...senators, ...house];
}

function ResultLink({ row }: { row: IndexRow }) {
  return (
    <li>
      <Link to={officialPath(row)}>
        <span className="poligraph-result-name">{row.name}</span>
        {row.office && <span className="poligraph-result-office"> {row.office}</span>}
      </Link>
    </li>
  );
}

const PoliGraph: React.FC = () => {
  const [index, setIndex] = useState<IndexRow[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [state, setState] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetchSearchIndex()
      .then((rows) => {
        if (cancelled) return;
        setIndex(rows);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const empty = status === 'ready' && index.length === 0;
  const trimmed = query.trim();
  const results = useMemo(() => searchOfficials(index, query), [index, query]);
  const president = useMemo(
    () => index.find((r) => r.current && r.office_id === 'us-president'),
    [index],
  );
  const states = useMemo(() => {
    const codes = new Set<string>();
    for (const r of index) {
      if (r.current && r.state && r.office_id?.match(/^us-(senate|house)-/)) codes.add(r.state);
    }
    return Array.from(codes)
      .map((code) => ({ code, name: stateName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [index]);
  const members = useMemo(() => (state ? congressMembers(index, state) : []), [index, state]);

  return (
    <div className="poligraph-page">
      <NavBar />
      <main className="poligraph-content">
        <h1>PoliGraph</h1>
        <p className="poligraph-subhead">
          See what officials have signed, sponsored and voted on, with a link to the source for every entry.
        </p>

        <section className="poligraph-search">
          <label htmlFor="poligraph-search-box">Search officials</label>
          <input
            id="poligraph-search-box"
            type="search"
            role="searchbox"
            placeholder="Name, state or office"
            value={query}
            disabled={status !== 'ready' || empty}
            onChange={(e) => setQuery(e.target.value)}
          />
          {status === 'error' && (
            <div className="poligraph-error" role="alert">
              <p>Couldn't load officials.</p>
              <button type="button" onClick={retry}>Retry</button>
            </div>
          )}
          {empty && <p className="poligraph-note">Officials are still being loaded. Check back soon.</p>}
          {status === 'ready' && !empty && trimmed !== '' &&
            (results.length > 0 ? (
              <ul className="poligraph-results">
                {results.map((r) => (
                  <ResultLink key={r.id} row={r} />
                ))}
              </ul>
            ) : (
              <p className="poligraph-note">No officials match “{trimmed}”.</p>
            ))}
        </section>

        <section data-testid="find-my-officials" className="poligraph-find">
          <h2>Find my officials</h2>
          <AddressForm onResult={(result) => navigate('/poligraph/lookup', { state: { result } })} />
          <p className="poligraph-note">Your address is used once to find your districts and isn't saved.</p>
        </section>

        {status === 'ready' && !empty && (
          <section className="poligraph-browse">
            <h2>Browse</h2>
            {president && (
              <p>
                <Link to={officialPath(president)}>President</Link>
              </p>
            )}
            <label htmlFor="poligraph-state">State</label>
            <select id="poligraph-state" value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">Congress by state</option>
              {states.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
            {state && (
              <ul className="poligraph-results" aria-label={`${stateName(state)} members of Congress`}>
                {members.map((r) => (
                  <ResultLink key={r.id} row={r} />
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default PoliGraph;
