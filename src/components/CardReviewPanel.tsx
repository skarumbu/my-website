import React, { useState } from 'react';
import { IndexCard, ReviewGrade } from '../lib/dailyCardsTypes.ts';
import { createIndexCard, reviewCard } from '../lib/dailyCardsApi.ts';

interface Props {
  token: string;
  cards: IndexCard[];
  onReviewed: (cardId: string) => void;
  onAdded: (card: IndexCard) => void;
  onUnauthorized: () => void;
}

const GRADES: { grade: ReviewGrade; label: string }[] = [
  { grade: 'again', label: 'Again' },
  { grade: 'hard', label: 'Hard' },
  { grade: 'good', label: 'Good' },
  { grade: 'easy', label: 'Easy' },
];

export default function CardReviewPanel({ token, cards, onReviewed, onAdded, onUnauthorized }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);
  const current = cards[0];

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

  const handleAdd = async () => {
    const text = newText.trim();
    if (!text) return;
    setAdding(true);
    setError(null);
    try {
      // New cards come back due today (next_review_date defaults to today),
      // so they join the review queue right away rather than waiting for a
      // refetch — same reasoning as the checklist/links panels' optimistic
      // local updates.
      const created = await createIndexCard(token, text);
      onAdded(created);
      setNewText('');
    } catch (e: any) {
      if (e.message === 'unauthorized') return onUnauthorized();
      setError('Could not add note. Try again.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="daily-panel cards-panel">
      <h2 className="daily-panel-title">Review ({cards.length} due)</h2>
      {error && <p className="daily-panel-error">{error}</p>}
      {!current && <p className="cards-empty">Nothing due today.</p>}
      {current && (
        <div className="cards-current">
          <p className="cards-current-text">{current.text}</p>
          <div className="cards-grade-row">
            {GRADES.map(({ grade, label }) => (
              <button key={grade} type="button" disabled={submitting} onClick={() => handleGrade(grade)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="cards-add-row">
        <input
          type="text"
          placeholder="Something you learned…"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
        />
        <button type="button" disabled={adding || !newText.trim()} onClick={handleAdd}>
          {adding ? 'Adding…' : '+ Add'}
        </button>
      </div>
    </section>
  );
}
