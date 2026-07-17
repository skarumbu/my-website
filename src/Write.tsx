import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from './components/nav-bar.tsx';
import Spinner from './components/Spinner.tsx';
import './styling/write.css';

const BASE_URL = process.env.REACT_APP_POSTS_API_BASE_URL;

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
  published: boolean;
  updatedAt?: string;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return {};
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  const exp = payload['exp'] as number | undefined;
  if (!exp) return false;
  return Date.now() / 1000 > exp;
}

function Write() {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const handleCredentialResponse = useCallback((response: { credential: string }) => {
    const token = response.credential;
    setGoogleToken(token);
    setAuthState('authenticated');
  }, []);

  const initGoogleSignIn = useCallback(() => {
    const g = (window as any).google;
    if (!g?.accounts) return;
    g.accounts.id.initialize({
      client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
    });
    if (googleBtnRef.current) {
      g.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        width: 280,
      });
    }
  }, [handleCredentialResponse]);

  // Restore token from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('write_google_token');
    if (stored && !isTokenExpired(stored)) {
      setGoogleToken(stored);
      setAuthState('authenticated');
      return;
    }
    sessionStorage.removeItem('write_google_token');
    setAuthState('unauthenticated');
  }, []);

  // Persist token to sessionStorage when it changes
  useEffect(() => {
    if (googleToken) {
      sessionStorage.setItem('write_google_token', googleToken);
    } else {
      sessionStorage.removeItem('write_google_token');
    }
  }, [googleToken]);

  // Load GIS and render button when unauthenticated
  useEffect(() => {
    if (authState !== 'unauthenticated') return;
    const g = (window as any).google;
    if (g?.accounts) {
      initGoogleSignIn();
      return;
    }
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', initGoogleSignIn);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGoogleSignIn;
    document.head.appendChild(script);
  }, [authState, initGoogleSignIn]);

  // Re-render button when ref is available
  useEffect(() => {
    if (authState === 'unauthenticated' && (window as any).google?.accounts) {
      initGoogleSignIn();
    }
  }, [authState, googleBtnRef.current, initGoogleSignIn]); // eslint-disable-line

  // Load posts when authenticated
  useEffect(() => {
    if (authState !== 'authenticated') return;
    if (!BASE_URL) {
      setError('REACT_APP_POSTS_API_BASE_URL is not configured');
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/posts`, {
          headers: { Authorization: `Bearer ${googleToken!}` },
        });
        if (res.status === 401) {
          setGoogleToken(null);
          sessionStorage.removeItem('write_google_token');
          setAuthState('unauthenticated');
          return;
        }
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        setPosts(json.posts ?? []);
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
      const resp = await fetch(`${BASE_URL}/api/posts/${slug}`, {
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
        <div className="write-content"><Spinner /></div>
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
        <div className="write-header-row">
          <h1 className="write-heading">Your posts</h1>
          <button className="write-new-btn" onClick={() => navigate('/write/new')}>
            + New Post
          </button>
        </div>
        {loading && <Spinner />}
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
                <span className="write-row-date">{post.date}</span>
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
