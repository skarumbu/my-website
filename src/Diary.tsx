import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from './components/nav-bar.tsx';
import WritingCursor from './components/WritingCursor.tsx';
import { sectionUrl, isApiConfigured } from './lib/postsApi.ts';
import { useGoogleAuth } from './lib/useGoogleAuth.ts';
import { DiaryEntry } from './lib/diaryTypes.ts';
import './styling/private-theme.css';
import './styling/diary.css';

const CARD_COLORS = ['mint', 'butter', 'sky', 'lilac', 'coral', 'peach', 'rose'] as const;

function cardColor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  return CARD_COLORS[hash % CARD_COLORS.length];
}

function fmtDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function Diary() {
  const navigate = useNavigate();
  const { authState, googleToken, googleBtnRef, signOut } = useGoogleAuth();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authState !== 'authenticated') return;
    if (!isApiConfigured()) {
      setError('REACT_APP_POSTS_API_BASE_URL is not configured');
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(sectionUrl('diary'), {
          headers: { Authorization: `Bearer ${googleToken!}` },
        });
        if (res.status === 401) {
          signOut();
          return;
        }
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        setEntries(json.items ?? []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [authState]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (slug: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      const resp = await fetch(sectionUrl('diary', slug), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${googleToken!}` },
      });
      if (resp.ok || resp.status === 204) {
        setEntries(prev => prev.filter(e => e.slug !== slug));
      } else {
        setError(`Delete failed: ${resp.status}`);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (authState === 'loading') {
    return (
      <div className="diary-page">
        <NavBar />
        <div className="diary-content"><WritingCursor /></div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <div className="diary-page">
        <NavBar />
        <div className="diary-login-view">
          <h1>Sign in to your diary</h1>
          <p>This is your private space. Sign in with your Google account to open it.</p>
          <div ref={googleBtnRef} />
        </div>
      </div>
    );
  }

  return (
    <div className="diary-page">
      <NavBar />
      <div className="diary-content">
        <div className="write-section-switcher">
          <a className="write-section-tab" href="/write">Writing</a>
          <span className="write-section-tab write-section-tab-active">Diary</span>
        </div>
        <div className="diary-header-row">
          <h1 className="diary-heading">Diary</h1>
          <button className="diary-new-btn" onClick={() => navigate('/diary/new')}>
            + New Entry
          </button>
        </div>
        {loading && <WritingCursor />}
        {error && <p className="diary-error">{error}</p>}
        {!loading && !error && entries.length === 0 && (
          <div className="diary-empty">
            <h2>No entries yet</h2>
            <p>Start your first page — it's just for you.</p>
            <button className="diary-new-btn" onClick={() => navigate('/diary/new')}>
              + New Entry
            </button>
          </div>
        )}
        {!loading && !error && entries.length > 0 && (
          <ul className="diary-list">
            {entries.map(entry => (
              <li key={entry.slug} className={`diary-row diary-row-${cardColor(entry.slug)}`}>
                <a className="diary-row-link" href={`/diary/${entry.slug}`}>
                  <span className="diary-row-title">{entry.title}</span>
                  <span className="diary-row-date">{fmtDate(entry.date)}</span>
                </a>
                <button
                  className="diary-row-delete"
                  aria-label="Delete entry"
                  title="Delete entry"
                  onClick={e => {
                    e.stopPropagation();
                    handleDelete(entry.slug, entry.title);
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Diary;
