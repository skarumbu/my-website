import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useBeforeUnload, useBlocker } from 'react-router-dom';
import NavBar from './components/nav-bar.tsx';
import WritingCursor from './components/WritingCursor.tsx';
import BlockEditorRow from './components/BlockEditorRow.tsx';
import { sectionUrl } from './lib/postsApi.ts';
import { useGoogleAuth } from './lib/useGoogleAuth.ts';
import { Block } from './lib/diaryTypes.ts';
import { VersionHistoryPanel } from './VersionHistoryPanel.tsx';
import './styling/private-theme.css';
import './styling/diary-editor.css';

export default function DiaryEditor() {
  const BASE_URL = process.env.REACT_APP_POSTS_API_BASE_URL;
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { authState, googleToken, googleBtnRef, signOut } = useGoogleAuth();

  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(!!slug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState('');
  const [unsavedSinceApi, setUnsavedSinceApi] = useState(false);

  const localTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestDraft = useRef({ title, blocks });
  const loadedSlugRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    latestDraft.current = { title, blocks };
  }, [title, blocks]);

  const markDirty = () => {
    setUnsavedSinceApi(true);
    setAutosaveStatus('Unsaved changes');
  };

  // localStorage restore — runs once on mount
  useEffect(() => {
    if (authState !== 'authenticated') return;
    const key = slug ? `diary-draft-${slug}` : 'diary-new-draft';
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      if (draft.title !== undefined) setTitle(draft.title);
      if (draft.blocks !== undefined) setBlocks(draft.blocks);
    } catch {
      // corrupt draft — ignore
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing entry — runs on first auth per slug
  useEffect(() => {
    if (authState !== 'authenticated') return;
    if (!slug) {
      setLoading(false);
      return;
    }
    if (loadedSlugRef.current === slug) return;
    loadedSlugRef.current = slug;
    if (!BASE_URL) {
      setError('API not configured');
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(sectionUrl('diary', slug), {
          headers: { Authorization: `Bearer ${googleToken!}` },
        });
        if (res.status === 401) {
          signOut();
          return;
        }
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        setTitle(json.title ?? '');
        setBlocks(json.blocks ?? []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, authState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Local-storage autosave — only when authenticated
  useEffect(() => {
    if (authState !== 'authenticated') return;
    const lsKey = slug ? `diary-draft-${slug}` : 'diary-new-draft';

    localTimerRef.current = setInterval(() => {
      localStorage.setItem(lsKey, JSON.stringify({ ...latestDraft.current, savedAt: Date.now() }));
    }, 2000);

    return () => {
      if (localTimerRef.current) clearInterval(localTimerRef.current);
    };
  }, [slug, authState]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const token = googleToken;
      if (!token) throw new Error('Not signed in');
      if (!slug) {
        const resp = await fetch(sectionUrl('diary'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, blocks }),
        });
        if (resp.status === 401) {
          signOut();
          setAutosaveStatus('Unsaved changes');
          return;
        }
        if (!resp.ok) throw new Error(`Save failed: ${resp.status}`);
        const { slug: newSlug } = await resp.json();
        localStorage.removeItem('diary-new-draft');
        setUnsavedSinceApi(false);
        navigate(`/diary/${newSlug}/edit`, { replace: true });
      } else {
        const resp = await fetch(sectionUrl('diary', slug), {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, blocks }),
        });
        if (resp.status === 401) {
          signOut();
          setAutosaveStatus('Unsaved changes');
          return;
        }
        if (!resp.ok) throw new Error(`Save failed: ${resp.status}`);
        const lsKey = `diary-draft-${slug}`;
        localStorage.setItem(lsKey, JSON.stringify({ title, blocks, savedAt: Date.now() }));
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
    if (!window.confirm('Delete this entry? This cannot be undone.')) return;
    if (!BASE_URL) { setError('API not configured'); return; }
    try {
      const token = googleToken;
      if (!token) throw new Error('Not signed in');
      const resp = await fetch(sectionUrl('diary', slug), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok || resp.status === 204) {
        localStorage.removeItem(`diary-draft-${slug}`);
        navigate('/diary');
      } else {
        setError(`Delete failed: ${resp.status}`);
      }
    } catch {
      setError('Delete failed. Try again.');
    }
  };

  const addTextBlock = () => {
    setBlocks(prev => [...prev, { type: 'text', content: '', style: { rotation: (Math.random() * 6 - 3) } }]);
    markDirty();
  };

  const addStickerBlock = () => {
    setBlocks(prev => [...prev, { type: 'sticker', emoji: '🌻', style: { rotation: (Math.random() * 10 - 5) } }]);
    markDirty();
  };

  const updateBlock = (index: number, updated: Block) => {
    setBlocks(prev => prev.map((b, i) => (i === index ? updated : b)));
    markDirty();
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    setBlocks(prev => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    markDirty();
  };

  const deleteBlock = (index: number) => {
    setBlocks(prev => prev.filter((_, i) => i !== index));
    markDirty();
  };

  if (authState === 'loading') {
    return (
      <div className="diary-editor-page">
        <NavBar />
        <div className="diary-editor-content"><WritingCursor /></div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <div className="diary-editor-page">
        <NavBar />
        <div className="diary-editor-login-view">
          <h1>Sign in to your diary</h1>
          <p>This is your private space. Sign in with your Google account to open it.</p>
          <div ref={googleBtnRef} />
        </div>
      </div>
    );
  }

  return (
    <div className="diary-editor-page">
      <NavBar />
      <div className="diary-editor-content">
        {error && <p className="diary-editor-error">{error}</p>}
        {loading && <WritingCursor />}
        {!loading && (
          <>
            {blocker.state === 'blocked' && (
              <div className="diary-editor-unsaved-modal-backdrop">
                <div className="diary-editor-unsaved-modal">
                  <h2>Leave without saving?</h2>
                  <p>Your changes will be lost. They&rsquo;re saved locally, but not synced.</p>
                  <div className="diary-editor-unsaved-modal-actions">
                    <button onClick={() => blocker.proceed?.()}>Leave</button>
                    <button onClick={() => blocker.reset?.()}>Stay here</button>
                  </div>
                </div>
              </div>
            )}
            <div className="diary-editor-toolbar">
              <a href="/diary" className="diary-editor-back">&larr; Diary</a>
              <span className="diary-editor-autosave">{autosaveStatus}</span>
              <div className="diary-editor-actions">
                <button className="diary-editor-save-btn" disabled={saving} onClick={handleSave}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {slug && (
                  <button className="diary-editor-delete-btn" onClick={handleDelete}>
                    Delete Entry
                  </button>
                )}
              </div>
            </div>
            <hr className="diary-editor-divider" />
            <input
              type="text"
              className="diary-editor-field-title"
              placeholder="Give this page a title…"
              value={title}
              onChange={e => { setTitle(e.target.value); markDirty(); }}
            />
            <div className="diary-editor-blocks">
              {blocks.map((block, index) => (
                <BlockEditorRow
                  key={index}
                  block={block}
                  onChange={updated => updateBlock(index, updated)}
                  onMoveUp={() => moveBlock(index, -1)}
                  onMoveDown={() => moveBlock(index, 1)}
                  onDelete={() => deleteBlock(index)}
                  isFirst={index === 0}
                  isLast={index === blocks.length - 1}
                />
              ))}
            </div>
            <div className="diary-editor-add-row">
              <button type="button" onClick={addTextBlock}>+ Text</button>
              <button type="button" onClick={addStickerBlock}>+ Sticker</button>
            </div>
            {slug && <VersionHistoryPanel section="diary" slug={slug} token={googleToken} />}
          </>
        )}
      </div>
    </div>
  );
}
