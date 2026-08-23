import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from './components/nav-bar.tsx';
import WritingCursor from './components/WritingCursor.tsx';
import StudioSummary from './components/StudioSummary.tsx';
import { sectionUrl, isApiConfigured } from './lib/postsApi.ts';
import { useGoogleAuth } from './lib/useGoogleAuth.ts';
import { Post } from './lib/writeTypes.ts';
import { DiaryEntry } from './lib/diaryTypes.ts';
import { fmtDate } from './lib/formatDate.ts';
import './styling/private-theme.css';
import './styling/write.css';

function Write() {
  const navigate = useNavigate();
  const { authState, googleToken, googleBtnRef, signOut } = useGoogleAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diaryError, setDiaryError] = useState(false);

  // Load posts when authenticated
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
        const res = await fetch(sectionUrl('writing'), {
          headers: { Authorization: `Bearer ${googleToken!}` },
        });
        if (res.status === 401) {
          signOut();
          return;
        }
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        setPosts(json.items ?? []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [authState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load diary entries alongside posts, for the studio summary cards. Kept
  // in its own error/loading state so a diary outage never blocks or
  // clears the posts list above.
  useEffect(() => {
    if (authState !== 'authenticated') return;
    if (!isApiConfigured()) {
      setDiaryError(true);
      return;
    }
    setDiaryLoading(true);
    setDiaryError(false);
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
        setDiaryEntries(json.items ?? []);
      } catch {
        setDiaryError(true);
      } finally {
        setDiaryLoading(false);
      }
    })();
  }, [authState]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (slug: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      const resp = await fetch(sectionUrl('writing', slug), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${googleToken!}` },
      });
      if (resp.ok || resp.status === 204) {
        setPosts(prev => prev.filter(p => p.slug !== slug));
      } else {
        setError(`Delete failed: ${resp.status}`);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (authState === 'loading') {
    return (
      <div className="write-page">
        <NavBar />
        <div className="write-content"><WritingCursor /></div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <div className="write-page">
        <NavBar />
        <div className="write-login-view">
          <h1>Sign in to write</h1>
          <p>This area is private. Sign in with your Google account to access the editor.</p>
          <div ref={googleBtnRef} />
        </div>
      </div>
    );
  }

  return (
    <div className="write-page">
      <NavBar />
      <div className="write-content">
        <StudioSummary
          posts={posts}
          diaryEntries={diaryEntries}
          diaryLoading={diaryLoading}
          diaryError={diaryError}
          onNewPost={() => navigate('/write/new')}
          onNewEntry={() => navigate('/diary/new')}
        />
        <div className="write-header-row">
          <h1 className="write-heading">Your posts</h1>
          <button className="write-new-btn" onClick={() => navigate('/write/new')}>
            + New Post
          </button>
        </div>
        {loading && <WritingCursor />}
        {error && <p className="write-error">{error}</p>}
        {!loading && !error && posts.length === 0 && (
          <div className="write-empty">
            <h2>No posts yet</h2>
            <p>Start writing — your first post will appear here.</p>
            <button className="write-new-btn" onClick={() => navigate('/write/new')}>
              + New Post
            </button>
          </div>
        )}
        {!loading && !error && posts.length > 0 && (
          <ul className="write-list">
            {posts.map(post => (
              <li key={post.slug} className="write-row">
                <div className="write-row-top">
                  <a className="write-row-title" href={`/write/${post.slug}`}>
                    {post.title}
                  </a>
                  <span
                    className={`write-row-badge ${post.published ? 'badge-published' : 'badge-draft'}`}
                  >
                    {post.published ? 'Published' : 'Draft'}
                  </span>
                </div>
                <span className="write-row-date">{fmtDate(post.date)}</span>
                <p className="write-row-desc">{post.description}</p>
                <button
                  className="write-row-delete"
                  aria-label="Delete post"
                  title="Delete post"
                  onClick={e => {
                    e.stopPropagation();
                    handleDelete(post.slug, post.title);
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

export default Write;
