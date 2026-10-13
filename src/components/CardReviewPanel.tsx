import React, { useState } from 'react';
import { IndexCard, ReviewGrade } from '../lib/dailyCardsTypes.ts';
import { reviewCard } from '../lib/dailyCardsApi.ts';

interface Props {
  token: string;
  cards: IndexCard[];
  onReviewed: (cardId: string) => void;
  onUnauthorized: () => void;
}

const GRADES: { grade: ReviewGrade; label: string }[] = [
  { grade: 'again', label: 'Again' },
  { grade: 'hard', label: 'Hard' },
  { grade: 'good', label: 'Good' },
  { grade: 'easy', label: 'Easy' },
];

export default function CardReviewPanel({ token, cards, onReviewed, onUnauthorized }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
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
    </section>
  );
}
