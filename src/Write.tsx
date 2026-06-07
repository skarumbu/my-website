import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { postsApiRequest } from './authConfig.js';
import { acquireToken } from './auth.ts';
import NavBar from './components/nav-bar.tsx';
import Spinner from './components/Spinner.tsx';
import './styling/write.css';

const BASE_URL = process.env.REACT_APP_POSTS_API_BASE_URL;

interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
  published: boolean;
  updatedAt?: string;
}

function Write() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = useCallback(
    () => acquireToken(instance, accounts[0], postsApiRequest, `${window.location.origin}/write`),
    [instance, accounts]
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!BASE_URL) {
      setError('REACT_APP_POSTS_API_BASE_URL is not configured');
      return;
    }
    setLoading(true);
    setError(null);
    getToken()
      .then(token =>
        fetch(`${BASE_URL}/api/posts`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(json => setPosts(json.posts ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (slug: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/api/posts/${slug}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
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

  if (!isAuthenticated) {
    return (
      <div className="write-page">
        <NavBar />
        <div className="write-login-view">
          <h1>Sign in to write</h1>
          <p>This area is private. Sign in with your Microsoft account to access the editor.</p>
          <button
            className="write-login-btn"
            onClick={() =>
              instance.loginRedirect({
                ...postsApiRequest,
                redirectUri: window.location.origin + '/write',
              })
            }
          >
            Sign in with Microsoft
          </button>
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
