import React, { useState, useEffect } from 'react';
import NavBar from './components/nav-bar.tsx';
import WritingCursor from './components/WritingCursor.tsx';
import ChecklistPanel from './components/ChecklistPanel.tsx';
import DailyLinksPanel from './components/DailyLinksPanel.tsx';
import CardReviewPanel from './components/CardReviewPanel.tsx';
import { useGoogleAuth } from './lib/useGoogleAuth.ts';
import { isApiConfigured, todayIso } from './lib/dailyApi.ts';
import { loadTodayView } from './lib/useTodayView.ts';
import { ChecklistItem } from './lib/dailyChecklistTypes.ts';
import { DailyLinkConfig } from './lib/dailyLinksTypes.ts';
import './styling/private-theme.css';
import './styling/today.css';

export default function TodayPage() {
  const { authState, googleToken, googleBtnRef, signOut } = useGoogleAuth();
  const dateIso = todayIso();

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [links, setLinks] = useState<{ config: DailyLinkConfig; openedToday: boolean }[]>([]);
  const [dueCards, setDueCards] = useState<Awaited<ReturnType<typeof loadTodayView>>['dueCards']>([]);
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
        const view = await loadTodayView(googleToken!, dateIso);
        setChecklist(view.checklist);
        setLinks(view.links);
        setDueCards(view.dueCards);
      } catch (e: any) {
        if (e.message === 'unauthorized') {
          signOut();
          return;
        }
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [authState]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLinkOpened = (linkId: string) => {
    setLinks(prev => prev.map(l => (l.config.id === linkId ? { ...l, openedToday: true } : l)));
  };

  const handleCardReviewed = (cardId: string) => {
    setDueCards(prev => prev.filter(c => c.id !== cardId));
  };

  const handleCardAdded = (card: typeof dueCards[number]) => {
    setDueCards(prev => [...prev, card]);
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
          <h1>Sign in for Today</h1>
          <p>This is your private space. Sign in with your Google account to open it.</p>
          <div ref={googleBtnRef} />
        </div>
      </div>
    );
  }

  return (
    <div className="today-page">
      <NavBar />
      <div className="today-content">
        <h1 className="today-heading">Today</h1>
        {loading && <WritingCursor />}
        {error && <p className="today-error">{error}</p>}
        {!loading && !error && (
          <div className="today-panels">
            <ChecklistPanel
              token={googleToken!}
              dateIso={dateIso}
              items={checklist}
              onItemsChange={setChecklist}
              onUnauthorized={signOut}
            />
            <DailyLinksPanel
              token={googleToken!}
              dateIso={dateIso}
              links={links}
              onOpened={handleLinkOpened}
            />
            <CardReviewPanel
              token={googleToken!}
              cards={dueCards}
              onReviewed={handleCardReviewed}
              onAdded={handleCardAdded}
              onUnauthorized={signOut}
            />
          </div>
        )}
      </div>
    </div>
  );
}
