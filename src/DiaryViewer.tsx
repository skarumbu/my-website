import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import NavBar from './components/nav-bar.tsx';
import Spinner from './components/Spinner.tsx';
import { sectionUrl } from './lib/postsApi.ts';
import { useGoogleAuth } from './lib/useGoogleAuth.ts';
import { DiaryEntry } from './lib/diaryTypes.ts';
import { fmtDate } from './lib/formatDate.ts';
import './styling/private-theme.css';
import './styling/diary-viewer.css';

function DiaryViewer() {
  const { slug } = useParams<{ slug: string }>();
  const { authState, googleToken, googleBtnRef, signOut } = useGoogleAuth();
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authState !== 'authenticated') return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(sectionUrl('diary', slug), {
          headers: { Authorization: `Bearer ${googleToken!}` },
        });
        if (res.status === 401) {
          signOut();
          return;
        }
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        setEntry(await res.json());
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, authState]); // eslint-disable-line react-hooks/exhaustive-deps

  if (authState === 'loading') {
    return (
      <div className="diary-viewer-page">
        <NavBar />
        <div className="diary-viewer-content"><Spinner /></div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <div className="diary-viewer-page">
        <NavBar />
        <div className="diary-viewer-login-view">
          <h1>Sign in to your diary</h1>
          <p>This is your private space. Sign in with your Google account to open it.</p>
          <div ref={googleBtnRef} />
        </div>
      </div>
    );
  }

  return (
    <div className="diary-viewer-page">
      <NavBar />
      <div className="diary-viewer-content">
        {loading && <Spinner />}
        {error && (
          <p className="diary-viewer-error">
            Could not load this entry. Return to <a href="/diary">Diary</a>.
          </p>
        )}
        {entry && (
          <>
            <a className="diary-viewer-back" href="/diary">&#8592; Diary</a>
            <div className="diary-viewer-header">
              <h1 className="diary-viewer-title">{entry.title}</h1>
              <p className="diary-viewer-date">{fmtDate(entry.date)}</p>
              <a className="diary-viewer-edit-link" href={`/diary/${entry.slug}/edit`}>Edit</a>
            </div>
            <div className="diary-viewer-page-surface">
              {entry.blocks.map((block, index) => (
                <div
                  key={index}
                  className={`diary-viewer-block diary-viewer-block-${block.type}`}
                  style={{
                    transform: `rotate(${block.style.rotation ?? 0}deg)`,
                    backgroundColor: block.style.background,
                    color: block.style.color,
                    fontFamily: block.style.font,
                  }}
                >
                  {block.type === 'text' ? block.content : <span className="diary-viewer-sticker">{block.emoji}</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default DiaryViewer;
