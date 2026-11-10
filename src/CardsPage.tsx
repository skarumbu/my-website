import React, { useState, useEffect, useRef } from 'react';
import NavBar from './components/nav-bar.tsx';
import WritingCursor from './components/WritingCursor.tsx';
import CardEditor, { EditorTarget } from './components/CardEditor.tsx';
import { useGoogleAuth } from './lib/useGoogleAuth.ts';
import { isApiConfigured } from './lib/dailyApi.ts';
import { fetchAllCards, createIndexCard, updateIndexCard, deleteIndexCard } from './lib/dailyCardsApi.ts';
import { IndexCard } from './lib/dailyCardsTypes.ts';
import './styling/private-theme.css';
import './styling/today.css';
import './styling/cards-page.css';

// Deterministic by index so the grid doesn't reshuffle between renders.
const TILTS = [-1.2, 0.9, -0.6, 1.2, -0.9, 0.6];

export default function CardsPage() {
  const { authState, googleToken, googleBtnRef, signOut } = useGoogleAuth();
  const [cards, setCards] = useState<IndexCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const newRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (authState !== 'authenticated') return;
    if (!isApiConfigured()) {
      setError('REACT_APP_DAILY_API_BASE_URL is not configured');
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        setCards(await fetchAllCards(googleToken!));
      } catch (e: any) {
        if (e.message === 'unauthorized') {
          signOut();
          return;
        }
        setError('Could not load your cards.');
      } finally {
        setLoading(false);
      }
    })();
  }, [authState]); // eslint-disable-line react-hooks/exhaustive-deps

  const openEditor = (target: EditorTarget) => {
    setEditorError(null);
    setEditor(target);
  };

  const closeEditor = () => {
    const prev = editor;
    setEditor(null);
    // After the dialog unmounts, return focus to the card that opened it
    // (or to "+ New card" if that card is gone or the editor was for a new one).
    setTimeout(() => {
      const el = prev?.kind === 'edit' ? cardRefs.current[prev.card.id] : null;
      (el ?? newRef.current)?.focus();
    }, 0);
  };

  const handleSave = async (front: string, back: string) => {
    if (!editor || !front) return;
    setBusy(true);
    setEditorError(null);
    try {
      if (editor.kind === 'new') {
        const created = await createIndexCard(googleToken!, front, back);
        setCards(prev => [...prev, created]);
      } else {
        const id = editor.card.id;
        const updated = await updateIndexCard(googleToken!, id, { text: front, back });
        setCards(prev => prev.map(c => (c.id === id ? { ...c, ...updated } : c)));
      }
      closeEditor();
    } catch (e: any) {
      if (e.message === 'unauthorized') return signOut();
      setEditorError('Could not save card. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!editor || editor.kind !== 'edit') return;
    const id = editor.card.id;
    setBusy(true);
    setEditorError(null);
    try {
      await deleteIndexCard(googleToken!, id);
      setCards(prev => prev.filter(c => c.id !== id));
      closeEditor();
    } catch (e: any) {
      if (e.message === 'unauthorized') return signOut();
      setEditorError('Could not delete card. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (authState === 'loading') {
    return (
      <div className="today-page">
        <NavBar />
        <div className="today-content"><WritingCursor /></div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <div className="today-page">
        <NavBar />
        <div className="today-login-view">
          <h1>Sign in for Cards</h1>
          <p>This is your private space. Sign in with your Google account to open it.</p>
          <div ref={googleBtnRef} />
        </div>
      </div>
    );
  }

  return (
    <div className="today-page">
      <NavBar />
      <div className="today-content cp-content">
        <div className="cp-header">
          <h1 className="today-heading">
            Your cards{!loading && !error && <span className="cp-count">{cards.length}</span>}
          </h1>
          <button type="button" ref={newRef} className="cp-new" onClick={() => openEditor({ kind: 'new' })}>
            + New card
          </button>
        </div>
        {loading && <WritingCursor />}
        {error && <p className="today-error">{error}</p>}
        {!loading && !error && cards.length === 0 && (
          <div className="cp-empty">
            <p>No cards yet. Jot down something you want to remember, a fact or a question, and it will live here.</p>
            <button type="button" className="cp-new" onClick={() => openEditor({ kind: 'new' })}>+ New card</button>
          </div>
        )}
        {!loading && !error && cards.length > 0 && (
          <div className="cp-grid">
            {cards.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className="cp-notecard cp-tile"
                style={{ '--tilt': `${TILTS[i % TILTS.length]}deg` } as React.CSSProperties}
                ref={el => { cardRefs.current[c.id] = el; }}
                onClick={() => openEditor({ kind: 'edit', card: c })}
              >
                <span className="cp-tile-text">{c.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {editor && (
        <CardEditor
          key={editor.kind === 'edit' ? editor.card.id : 'new'}
          target={editor}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={closeEditor}
          error={editorError}
          busy={busy}
        />
      )}
    </div>
  );
}
