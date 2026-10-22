import React, { useEffect, useRef, useState } from 'react';
import { IndexCard, ReviewGrade } from '../lib/dailyCardsTypes.ts';
import { createIndexCard, deleteIndexCard, reviewCard } from '../lib/dailyCardsApi.ts';
import NewCardSheet, { EMPTY_SHEET, SheetState } from './NewCardSheet.tsx';

interface Props {
  token: string;
  cards: IndexCard[];
  onReviewed: (cardId: string) => void;
  onAdded: (card: IndexCard) => void;
  onRemoved: (cardId: string) => void;
  onUnauthorized: () => void;
}

type Toast = null | { message: string; undoCardId?: string };

const TOAST_MS = 5000;

const GRADES: { grade: ReviewGrade; label: string }[] = [
  { grade: 'again', label: 'Again' },
  { grade: 'hard', label: 'Hard' },
  { grade: 'good', label: 'Good' },
  { grade: 'easy', label: 'Easy' },
];

export default function CardReviewPanel({ token, cards, onReviewed, onAdded, onRemoved, onUnauthorized }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sheet, setSheet] = useState<SheetState>({ kind: 'closed' });
  const [toast, setToast] = useState<Toast>(null);
  // Keyed by card id so the flip resets on its own when the queue advances.
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const newCardRef = useRef<HTMLButtonElement>(null);
  const current = cards[0];

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleGrade = async (grade: ReviewGrade) => {
    if (!current) return;
    setSubmitting(true);
    setError(null);
    try {
      await reviewCard(token, current.id, grade);
      onReviewed(current.id);
    } catch (e: any) {
      if (e.message === 'unauthorized') return onUnauthorized();
      setError('Could not save review. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const openSheet = () => {
    setToast(null);
    setSheet(EMPTY_SHEET);
  };

  const closeSheet = (added: IndexCard[]) => {
    setSheet({ kind: 'closed' });
    newCardRef.current?.focus();
    if (added.length === 1) setToast({ message: 'Card added. Due today.', undoCardId: added[0].id });
    else if (added.length > 1) setToast({ message: `${added.length} cards added. Due today.` });
  };

  const handleSave = async (andAnother: boolean) => {
    if (sheet.kind !== 'open' || !sheet.front.trim() || sheet.status === 'saving') return;
    setSheet({ ...sheet, status: 'saving' });
    try {
      // New cards come back due today (next_review_date defaults to today),
      // so they join the review queue right away rather than waiting for a
      // refetch.
      const created = await createIndexCard(token, sheet.front.trim(), sheet.backShown ? sheet.back.trim() : '');
      onAdded(created);
      const added = [...sheet.added, created];
      if (andAnother) setSheet({ ...EMPTY_SHEET, added });
      else closeSheet(added);
    } catch (e: any) {
      if (e.message === 'unauthorized') return onUnauthorized();
      setSheet(s => (s.kind === 'open' ? { ...s, status: 'error' } : s));
    }
  };

  const handleUndo = async (cardId: string) => {
    setToast(null);
    try {
      await deleteIndexCard(token, cardId);
      onRemoved(cardId);
    } catch (e: any) {
      if (e.message === 'unauthorized') return onUnauthorized();
      setError('Could not undo. Try again.');
    }
  };

  const flipped = current !== undefined && flippedId === current.id;
  const toggleFlip = () => setFlippedId(flipped ? null : current.id);

  return (
    <section
      className={`daily-panel cards-panel${sheet.kind === 'open' ? ' cards-panel-sheet-open' : ''}${toast ? ' cards-panel-toast' : ''}`}
    >
      <div className="cards-head-row">
        <h2 className="daily-panel-title">Review <span className="cards-due-count">({cards.length} due)</span></h2>
        <button type="button" ref={newCardRef} className="cards-new-pill" onClick={openSheet}>+ New card</button>
      </div>
      {error && <p className="daily-panel-error">{error}</p>}
      {!current && (
        <p className="cards-empty">
          Nothing due today.<br />Tap <b>+ New card</b> to add one.
        </p>
      )}
      {current && (
        <div className="cards-current">
          {current.back ? (
            <div
              className="cards-flip-wrap"
              role="button"
              tabIndex={0}
              aria-pressed={flipped}
              onClick={toggleFlip}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleFlip();
                }
              }}
            >
              <div className={`cards-flip${flipped ? ' cards-flip-flipped' : ''}`}>
                <div className="cards-face" aria-hidden={flipped}>
                  <small>Front</small>
                  <span className="cards-face-text">{current.text}</span>
                  <span className="cards-flip-hint">Tap to show answer</span>
                </div>
                <div className="cards-face cards-face-back" aria-hidden={!flipped}>
                  <small>Back</small>
                  <span className="cards-face-text">{current.back}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="cards-current-text">{current.text}</p>
          )}
          <div className="cards-grade-row">
            {GRADES.map(({ grade, label }) => (
              <button key={grade} type="button" disabled={submitting} onClick={() => handleGrade(grade)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {sheet.kind === 'open' && (
        <NewCardSheet
          sheet={sheet}
          onChange={patch => setSheet(s => (s.kind === 'open' ? { ...s, ...patch, status: s.status === 'error' ? 'idle' : s.status } : s))}
          onSave={handleSave}
          onClose={() => closeSheet(sheet.added)}
        />
      )}
      <div className="cards-toast-region" role="status">
        {toast && (
          <div className="cards-toast">
            <span>{toast.message}</span>
            {toast.undoCardId && (
              <button type="button" onClick={() => handleUndo(toast.undoCardId!)}>Undo</button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
