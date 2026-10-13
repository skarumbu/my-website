import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CardReviewPanel from './CardReviewPanel.tsx';
import { IndexCard } from '../lib/dailyCardsTypes.ts';

function card(overrides: Partial<IndexCard> = {}): IndexCard {
  return {
    id: 'c1', text: 'The capital of Mongolia is Ulaanbaatar',
    ease_factor: 2.5, interval_days: 1, next_review_date: '2026-10-13', last_reviewed_date: null,
    ...overrides,
  };
}

beforeEach(() => {
  process.env.REACT_APP_POSTS_API_BASE_URL = 'http://test.local';
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('shows "nothing due" when there are no cards', () => {
  render(<CardReviewPanel token="t" cards={[]} onReviewed={jest.fn()} onAdded={jest.fn()} onUnauthorized={jest.fn()} />);
  expect(screen.getByText(/nothing due today/i)).toBeInTheDocument();
});

it('reviewing the current card calls reviewCard and onReviewed', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => card() });
  const onReviewed = jest.fn();
  render(<CardReviewPanel token="t" cards={[card()]} onReviewed={onReviewed} onAdded={jest.fn()} onUnauthorized={jest.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: /good/i }));
  await waitFor(() => expect(onReviewed).toHaveBeenCalledWith('c1'));
});

it('adding a note calls createIndexCard and onAdded, then clears the input', async () => {
  const created = card({ id: 'c2', text: 'Octopuses have three hearts' });
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 201, json: async () => created });
  const onAdded = jest.fn();
  render(<CardReviewPanel token="t" cards={[]} onReviewed={jest.fn()} onAdded={onAdded} onUnauthorized={jest.fn()} />);

  const input = screen.getByPlaceholderText(/something you learned/i);
  fireEvent.change(input, { target: { value: 'Octopuses have three hearts' } });
  fireEvent.click(screen.getByRole('button', { name: /\+ add/i }));

  await waitFor(() => expect(onAdded).toHaveBeenCalledWith(created));
  expect(input).toHaveValue('');
});

it('does not submit an empty or whitespace-only note', () => {
  render(<CardReviewPanel token="t" cards={[]} onReviewed={jest.fn()} onAdded={jest.fn()} onUnauthorized={jest.fn()} />);
  const addButton = screen.getByRole('button', { name: /\+ add/i });
  expect(addButton).toBeDisabled();

  fireEvent.change(screen.getByPlaceholderText(/something you learned/i), { target: { value: '   ' } });
  expect(addButton).toBeDisabled();
});
