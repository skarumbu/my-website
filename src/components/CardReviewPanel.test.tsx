import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CardReviewPanel from './CardReviewPanel.tsx';
import { IndexCard } from '../lib/dailyCardsTypes.ts';

function card(overrides: Partial<IndexCard> = {}): IndexCard {
  return {
    id: 'c1', text: 'The capital of Mongolia is Ulaanbaatar', back: '',
    ease_factor: 2.5, interval_days: 1, next_review_date: '2026-10-13', last_reviewed_date: null,
    ...overrides,
  };
}

function renderPanel(props: Partial<React.ComponentProps<typeof CardReviewPanel>> = {}) {
  const handlers = {
    onReviewed: jest.fn(),
    onAdded: jest.fn(),
    onRemoved: jest.fn(),
    onUnauthorized: jest.fn(),
  };
  render(<CardReviewPanel token="t" cards={[]} {...handlers} {...props} />);
  return { ...handlers, ...props };
}

function openSheet() {
  fireEvent.click(screen.getByRole('button', { name: /\+ new card/i }));
  return screen.getByRole('dialog', { name: /new card/i });
}

function mockCreate(created: IndexCard) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 201, json: async () => created });
}

function postedBody(call: number = 0) {
  return JSON.parse((global.fetch as jest.Mock).mock.calls[call][1].body);
}

beforeEach(() => {
  process.env.REACT_APP_POSTS_API_BASE_URL = 'http://test.local';
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('shows "nothing due" and points at the new card button when there are no cards', () => {
  renderPanel();
  expect(screen.getByText(/nothing due today/i)).toBeInTheDocument();
  expect(screen.getByText(/to add one/i)).toBeInTheDocument();
});

it('reviewing the current card calls reviewCard and onReviewed', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => card() });
  const { onReviewed } = renderPanel({ cards: [card()] });

  fireEvent.click(screen.getByRole('button', { name: /good/i }));
  await waitFor(() => expect(onReviewed).toHaveBeenCalledWith('c1'));
});

it('has no inline add field in the panel body', () => {
  renderPanel({ cards: [card()] });
  expect(screen.queryByPlaceholderText(/something you learned/i)).not.toBeInTheDocument();
});

it('+ New card opens the sheet with focus in Front', () => {
  renderPanel();
  openSheet();
  expect(screen.getByLabelText(/^front/i)).toHaveFocus();
  expect(screen.queryByLabelText(/^back/i)).not.toBeInTheDocument();
});

it('disables both save buttons until Front has non-whitespace text', () => {
  renderPanel();
  openSheet();
  const save = screen.getByRole('button', { name: /^save$/i });
  const another = screen.getByRole('button', { name: /save & add another/i });
  expect(save).toBeDisabled();
  expect(another).toBeDisabled();

  fireEvent.change(screen.getByLabelText(/^front/i), { target: { value: '   ' } });
  expect(save).toBeDisabled();
  expect(another).toBeDisabled();

  fireEvent.change(screen.getByLabelText(/^front/i), { target: { value: 'x' } });
  expect(save).toBeEnabled();
  expect(another).toBeEnabled();
});

it('Save posts text with an empty back, calls onAdded, closes the sheet and shows the toast', async () => {
  const created = card({ id: 'c2', text: 'Octopuses have three hearts' });
  mockCreate(created);
  const { onAdded } = renderPanel();
  openSheet();

  fireEvent.change(screen.getByLabelText(/^front/i), { target: { value: '  Octopuses have three hearts ' } });
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

  await waitFor(() => expect(onAdded).toHaveBeenCalledWith(created));
  expect(postedBody()).toEqual({ text: 'Octopuses have three hearts', back: '' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByText('Card added. Due today.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
});

it('Save & add another keeps the sheet open, clears it, and counts the adds', async () => {
  mockCreate(card({ id: 'c2' }));
  mockCreate(card({ id: 'c3' }));
  const { onAdded } = renderPanel();
  openSheet();

  fireEvent.change(screen.getByLabelText(/^front/i), { target: { value: 'first' } });
  fireEvent.click(screen.getByRole('button', { name: /add an answer/i }));
  fireEvent.change(screen.getByLabelText(/^back/i), { target: { value: 'answer' } });
  fireEvent.click(screen.getByRole('button', { name: /save & add another/i }));

  await waitFor(() => expect(screen.getByText(/✓ 1 added/)).toBeInTheDocument());
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByLabelText(/^front/i)).toHaveValue('');
  await waitFor(() => expect(screen.getByLabelText(/^front/i)).toHaveFocus());
  expect(screen.queryByLabelText(/^back/i)).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/^front/i), { target: { value: 'second' } });
  fireEvent.click(screen.getByRole('button', { name: /save & add another/i }));
  await waitFor(() => expect(screen.getByText(/✓ 2 added/)).toBeInTheDocument());
  expect(onAdded).toHaveBeenCalledTimes(2);

  fireEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(screen.getByText('2 cards added. Due today.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
});

it('revealing Back sends it with the card', async () => {
  mockCreate(card({ id: 'c2', back: 'Ulaanbaatar' }));
  const { onAdded } = renderPanel();
  openSheet();

  fireEvent.change(screen.getByLabelText(/^front/i), { target: { value: 'Capital of Mongolia?' } });
  fireEvent.click(screen.getByRole('button', { name: /add an answer/i }));
  expect(screen.getByLabelText(/^back/i)).toHaveFocus();
  fireEvent.change(screen.getByLabelText(/^back/i), { target: { value: 'Ulaanbaatar' } });
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

  await waitFor(() => expect(onAdded).toHaveBeenCalled());
  expect(postedBody()).toEqual({ text: 'Capital of Mongolia?', back: 'Ulaanbaatar' });
});

it('keeps the sheet open with the text and an error when saving fails', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
  const { onAdded } = renderPanel();
  openSheet();

  fireEvent.change(screen.getByLabelText(/^front/i), { target: { value: 'keep me' } });
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

  await waitFor(() => expect(screen.getByText(/could not save card/i)).toBeInTheDocument());
  expect(screen.getByLabelText(/^front/i)).toHaveValue('keep me');
  expect(onAdded).not.toHaveBeenCalled();
});

it('calls onUnauthorized when saving returns 401', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
  const { onUnauthorized } = renderPanel();
  openSheet();

  fireEvent.change(screen.getByLabelText(/^front/i), { target: { value: 'x' } });
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
  await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
});

it('Ctrl+Enter saves', async () => {
  mockCreate(card({ id: 'c2' }));
  const { onAdded } = renderPanel();
  openSheet();

  fireEvent.change(screen.getByLabelText(/^front/i), { target: { value: 'quick' } });
  fireEvent.keyDown(screen.getByLabelText(/^front/i), { key: 'Enter', ctrlKey: true });
  await waitFor(() => expect(onAdded).toHaveBeenCalled());
});

it('Undo deletes the card and calls onRemoved', async () => {
  mockCreate(card({ id: 'c2' }));
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 204 });
  const { onRemoved } = renderPanel();
  openSheet();

  fireEvent.change(screen.getByLabelText(/^front/i), { target: { value: 'oops' } });
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
  fireEvent.click(await screen.findByRole('button', { name: /undo/i }));

  await waitFor(() => expect(onRemoved).toHaveBeenCalledWith('c2'));
  const [url, init] = (global.fetch as jest.Mock).mock.calls[1];
  expect(url).toBe('http://test.local/api/daily/cards/c2');
  expect(init.method).toBe('DELETE');
});

it('Esc closes the sheet without saving', () => {
  renderPanel();
  openSheet();
  fireEvent.change(screen.getByLabelText(/^front/i), { target: { value: 'never mind' } });
  fireEvent.keyDown(screen.getByLabelText(/^front/i), { key: 'Escape' });

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(screen.queryByRole('status')).toBeEmptyDOMElement();
});

it('a card with a back flips to show it', () => {
  renderPanel({ cards: [card({ text: 'Capital of Mongolia?', back: 'Ulaanbaatar' })] });
  const flip = screen.getByRole('button', { name: /capital of mongolia/i });
  expect(flip).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByText(/tap to show answer/i)).toBeInTheDocument();
  expect(screen.getByText('Ulaanbaatar').closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'true');

  fireEvent.click(flip);
  expect(flip).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('Ulaanbaatar').closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'false');

  fireEvent.keyDown(flip, { key: ' ' });
  expect(flip).toHaveAttribute('aria-pressed', 'false');
});

it('a card without a back has no flip affordance', () => {
  renderPanel({ cards: [card()] });
  expect(screen.getByText(/capital of mongolia is ulaanbaatar/i)).toBeInTheDocument();
  expect(screen.queryByText(/tap to show answer/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { pressed: false })).not.toBeInTheDocument();
});
