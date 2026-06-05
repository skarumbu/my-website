import React, { useState, useEffect } from 'react';
import NavBar from './components/nav-bar.tsx';
import Spinner from './components/Spinner.tsx';
import './styling/posts.css';

interface Post {
  title: string;
  slug: string;
  date: string;
  description: string;
  updatedAt: string;
}

function fmtDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function Posts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const BASE_URL = process.env.REACT_APP_POSTS_API_BASE_URL;
    if (!BASE_URL) {
      setError('REACT_APP_POSTS_API_BASE_URL is not configured');
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`${BASE_URL}/api/posts`)
      .then(res => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(json => setPosts(json.posts ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="posts-page">
      <NavBar />
      <div className="posts-content">
        <h1 className="posts-heading">Writing</h1>
        {loading && <Spinner />}
        {error && <p className="posts-error">{error}</p>}
        {!loading && !error && posts.length === 0 && (
          <p className="posts-empty">No posts yet. Check back soon.</p>
        )}
        {!loading && !error && posts.length > 0 && (
          <ul className="posts-list">
            {posts.map(post => (
              <li key={post.slug}>
                <a className="posts-row" href={`/posts/${post.slug}`}>
                  <span className="posts-row-title">{post.title}</span>
                  <span className="posts-row-date">{fmtDate(post.date)}</span>
                  <span className="posts-row-desc">{post.description}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Posts;
