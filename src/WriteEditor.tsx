import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useBeforeUnload, useBlocker } from 'react-router-dom';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { postsApiRequest } from './authConfig.js';
import { acquireToken } from './auth.ts';
import NavBar from './components/nav-bar.tsx';
import Spinner from './components/Spinner.tsx';
import './styling/write-editor.css';

export default function WriteEditor() {
  // Read at render time so tests can set process.env before rendering
  const BASE_URL = process.env.REACT_APP_POSTS_API_BASE_URL;
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { instance, inProgress, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(!!slug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState('');
  const [unsavedSinceApi, setUnsavedSinceApi] = useState(false);

  const localTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const apiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestDraft = useRef({ title, description, body, published });
  const unsavedSinceApiRef = useRef(false);

  // Sync latestDraft ref on every field change (no re-render cost)
  useEffect(() => {
    latestDraft.current = { title, description, body, published };
  }, [title, description, body, published]);

  // Sync unsavedSinceApiRef so background timers can read it without stale closure
  useEffect(() => {
    unsavedSinceApiRef.current = unsavedSinceApi;
  }, [unsavedSinceApi]);

  // getToken: user-triggered, interactive redirect fallback
  const getToken = useCallback(
    () => acquireToken(instance, accounts[0], postsApiRequest,
      `${window.location.origin}${slug ? `/write/${slug}` : '/write/new'}`),
    [instance, accounts, slug]
  );

  // getTokenSilent: background autosave — NEVER redirects
  const getTokenSilent = useCallback(async (): Promise<string | null> => {
    try {
      const response = await instance.acquireTokenSilent({ ...postsApiRequest, account: accounts[0] });
      return response.accessToken;
    } catch {
      return null;
    }
  }, [instance, accounts]);

  // localStorage restore effect — runs once on mount
  useEffect(() => {
    if (!isAuthenticated) return; // only restore when auth'd
    const key = slug ? `write-draft-${slug}` : 'write-new-draft';
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      if (draft.title !== undefined) setTitle(draft.title);
      if (draft.description !== undefined) setDescription(draft.description);
      if (draft.body !== undefined) setBody(draft.body);
      if (draft.published !== undefined) setPublished(draft.published);
    } catch {
      // corrupt draft — ignore
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing post effect — runs when slug changes (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!slug) {
      setLoading(false);
      return;
    }
    if (!BASE_URL) {
      setError('API not configured');
      setLoading(false);
      return;
    }
    setLoading(true);
    getToken()
      .then(token =>
        fetch(`${BASE_URL}/api/posts/${slug}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(json => {
        const post = json.post ?? json;
        setTitle(post.title ?? '');
        setDescription(post.description ?? '');
        setBody(post.body ?? '');
        setPublished(post.published ?? false);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Two-tier autosave — only when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    const lsKey = slug ? `write-draft-${slug}` : 'write-new-draft';

    // Tier 1: localStorage every 2s — reads latestDraft.current to avoid stale closure
    localTimerRef.current = setInterval(() => {
      localStorage.setItem(lsKey, JSON.stringify({ ...latestDraft.current, savedAt: Date.now() }));
    }, 2000);

    // Tier 2: API save every 45s — getTokenSilent only, never redirects from background
    if (slug && BASE_URL) {
      apiTimerRef.current = setInterval(async () => {
        if (!unsavedSinceApiRef.current) return;
        const token = await getTokenSilent();
        if (!token) return;
        try {
          setAutosaveStatus('Saving…');
          const resp = await fetch(`${BASE_URL}/api/posts/${slug}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(latestDraft.current),
          });
          if (resp.ok) {
            setUnsavedSinceApi(false);
            setAutosaveStatus('Saved');
            setTimeout(() => setAutosaveStatus(''), 3000);
          }
        } catch {
          setAutosaveStatus('Unsaved changes');
        }
      }, 45000);
    }

    return () => {
      if (localTimerRef.current) clearInterval(localTimerRef.current);
      if (apiTimerRef.current) clearInterval(apiTimerRef.current);
    };
  }, [slug, isAuthenticated, BASE_URL, getTokenSilent]); // eslint-disable-line react-hooks/exhaustive-deps

  const blocker = useBlocker(unsavedSinceApi);

  useBeforeUnload(useCallback((e: BeforeUnloadEvent) => {
    if (unsavedSinceApi) e.preventDefault();
  }, [unsavedSinceApi]));

  const handleSave = async () => {
    if (!BASE_URL) {
      setError('API not configured');
      return;
    }
    setSaving(true);
    setError(null);
    setAutosaveStatus('Saving…');
    try {
      const token = await getToken();
      if (!slug) {
        // New post: POST
        const resp = await fetch(`${BASE_URL}/api/posts`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title, description, body, published }),
        });
        if (!resp.ok) throw new Error(`Save failed: ${resp.status}`);
        const { slug: newSlug } = await resp.json();
        localStorage.removeItem('write-new-draft');
        navigate(`/write/${newSlug}`, { replace: true });
      } else {
        // Existing post: PUT
        const resp = await fetch(`${BASE_URL}/api/posts/${slug}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title, description, body, published }),
        });
        if (!resp.ok) throw new Error(`Save failed: ${resp.status}`);
        // Write updated draft to localStorage
        const lsKey = `write-draft-${slug}`;
        localStorage.setItem(lsKey, JSON.stringify({ title, description, body, published, savedAt: Date.now() }));
      }
      setUnsavedSinceApi(false);
      setAutosaveStatus('Saved');
      setTimeout(() => setAutosaveStatus(''), 3000);
    } catch (e: any) {
      setError('Save failed. Your work is preserved locally — try again.');
      setAutosaveStatus('Unsaved changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!slug) return;
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    if (!BASE_URL) { setError('API not configured'); return; }
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/api/posts/${slug}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      // CRITICAL: never call resp.json() on DELETE — 204 has no body
      if (resp.ok || resp.status === 204) {
        localStorage.removeItem(`write-draft-${slug}`);
        navigate('/write');
      } else {
        setError(`Delete failed: ${resp.status}`);
      }
    } catch {
      setError('Delete failed. Try again.');
    }
  };

  // Auth gate — AFTER all hooks, BEFORE render
  if (!isAuthenticated) {
    return (
      <div className="editor-page">
        <NavBar />
        <div className="editor-login-view">
          <h1>Sign in to write</h1>
          <p>This area is private. Sign in with your Microsoft account to access the editor.</p>
          <button
            className="editor-login-btn"
            onClick={() =>
              instance.loginRedirect({
                ...postsApiRequest,
                redirectUri: window.location.origin + (slug ? `/write/${slug}` : '/write/new'),
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
    <div className="editor-page">
      <NavBar />
      <div className="editor-content">
        {error && <p className="editor-error">{error}</p>}
        {loading && <Spinner />}
        {!loading && (
          <>
            {blocker.state === 'blocked' && (
              <div className="editor-unsaved-banner">
                <span>You have unsaved changes.</span>
                <button onClick={() => blocker.proceed?.()}>Leave anyway</button>
                <button onClick={() => blocker.reset?.()}>Stay</button>
              </div>
            )}
            <div className="editor-toolbar">
              <a href="/write" className="editor-back">
                &larr; All posts
              </a>
              <span className="editor-autosave">{autosaveStatus}</span>
              <div className="editor-actions">
                <button
                  className="editor-save-btn"
                  disabled={saving}
                  onClick={handleSave}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <label className="editor-publish-group">
                  <input
                    type="checkbox"
                    checked={published}
                    onChange={e => {
                      setPublished(e.target.checked);
                      setUnsavedSinceApi(true);
                      setAutosaveStatus('Unsaved changes');
                    }}
                  />
                  <span>Published</span>
                </label>
                {slug && (
                  <button className="editor-delete-btn" onClick={handleDelete}>
                    Delete Post
                  </button>
                )}
              </div>
            </div>
            <hr className="editor-divider" />
            <input
              type="text"
              className="editor-field-title"
              placeholder="Title"
              value={title}
              onChange={e => {
                setTitle(e.target.value);
                setUnsavedSinceApi(true);
                setAutosaveStatus('Unsaved changes');
              }}
            />
            <input
              type="text"
              className="editor-field-desc"
              placeholder="Description"
              value={description}
              onChange={e => {
                setDescription(e.target.value);
                setUnsavedSinceApi(true);
                setAutosaveStatus('Unsaved changes');
              }}
            />
            <hr className="editor-divider" />
            <textarea
              className="editor-field-body"
              placeholder="Write in markdown…"
              value={body}
              rows={12}
              onChange={e => {
                setBody(e.target.value);
                setUnsavedSinceApi(true);
                setAutosaveStatus('Unsaved changes');
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
