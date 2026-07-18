import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import NavBar from './components/nav-bar.tsx';
import Spinner from './components/Spinner.tsx';
import './styling/post-reader.css';

interface Post {
  title: string;
  slug: string;
  date: string;
  description: string;
  updatedAt: string;
  body: string;
}

function fmtDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function PostReader() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
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
    fetch(`${BASE_URL}/api/posts/${slug}`)
      .then(res => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(setPost)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="post-reader-page">
      <NavBar />
      <div className="post-reader-content">
        {loading && <Spinner />}
        {error && (
          <p className="posts-error">
            Could not load this post. It may have been moved or removed.{' '}
            Return to <a href="/posts">Writing</a>.
          </p>
        )}
        {post && (
          <>
            <a className="post-reader-back" href="/posts">&#8592; Writing</a>
            <div className="post-reader-header">
              <h1 className="post-reader-title">{post.title}</h1>
              <p className="post-reader-date">{fmtDate(post.date)}</p>
              <p className="post-reader-desc">{post.description}</p>
            </div>
            <div className="post-reader-body">
              <Markdown remarkPlugins={[remarkGfm]}>{post.body}</Markdown>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PostReader;
