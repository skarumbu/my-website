// Mirrors posts-api's daily/cards.py IndexCard dataclass shape exactly.

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export interface IndexCard {
  id: string;
  text: string;
  ease_factor: number;
  interval_days: number;
  next_review_date: string;
  last_reviewed_date: string | null;
}
