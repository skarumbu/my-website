import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import CardsPage from './CardsPage.tsx';
import { IndexCard } from './lib/dailyCardsTypes.ts';

const mockSignOut = jest.fn();
jest.mock('./lib/useGoogleAuth.ts', () => ({
  useGoogleAuth: () => ({
    authState: 'authenticated',
    googleToken: 't',
    googleBtnRef: { current: null },
    signOut: mockSignOut,
  }),
}));

function card(overrides: Partial<IndexCard> = {}): IndexCard {
  return {
    id: 'c1', text: 'Capital of Mongolia?', back: 'Ulaanbaatar',
    ease_factor: 2.5, interval_days: 6, next_review_date: '2026-10-13', last_reviewed_date: null,
    ...overrides,
  };
}

function res(body: any, status = 200) {
  return { ok: status < 400, status, json: async () => body };
}

function mockFetch(...responses: any[]) {
  global.fetch = jest.fn();
  responses.forEach(r => (global.fetch as jest.Mock).mockResolvedValueOnce(r));
}

function sentBody(call: number) {
  return JSON.parse((global.fetch as jest.Mock).mock.calls[call][1].body);
}

async function renderPage(cards: IndexCard[]) {
  mockFetch(res({ items: cards }));
  render(<CardsPage />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
}

beforeEach(() => {
  process.env.REACT_APP_DAILY_API_BASE_URL = 'http://test.local';
  mockSignOut.mockClear();
});

const two = () => [card(), card({ id: 'c2', text: 'Octopuses have three hearts', back: 'True' })];

it('renders every front and no scheduling info', async () => {
  await renderPage(two());
  expect(await screen.findByText('Capital of Mongolia?')).toBeInTheDocument();
  expect(screen.getByText('Octopuses have three hearts')).toBeInTheDocument();
  expect(screen.queryByText('Ulaanbaatar')).not.toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/due|interval|ease|2026-10-13/i);
  expect(global.fetch).toHaveBeenCalledWith('http://test.local/api/daily/cards', expect.anything());
});

it('shows an invitation when there are no cards', async () => {
  await renderPage([]);
  expect(await screen.findByText(/no cards yet/i)).toBeInTheDocument();
});

it('clicking a card opens the editor with its front, and Back shows the back', async () => {
  await renderPage(two());
  fireEvent.click(await screen.findByRole('button', { name: /capital of mongolia/i }));
  const dialog = screen.getByRole('dialog', { name: /edit card/i });
  expect(within(dialog).getByLabelText('Front text')).toHaveValue('Capital of Mongolia?');

  fireEvent.click(within(dialog).getByRole('button', { name: 'Back' }));
  expect(within(dialog).getByLabelText('Back text')).toHaveValue('Ulaanbaatar');
});

it('Save calls updateIndexCard and updates the grid', async () => {
  await renderPage(two());
  fireEvent.click(await screen.findByRole('button', { name: /capital of mongolia/i }));
  (global.fetch as jest.Mock).mockResolvedValueOnce(res(card({ text: 'Mongolia capital?', back: 'UB' })));

  fireEvent.change(screen.getByLabelText('Front text'), { target: { value: ' Mongolia capital? ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  fireEvent.change(screen.getByLabelText('Back text'), { target: { value: 'UB' } });
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  const [url, init] = (global.fetch as jest.Mock).mock.calls[1];
  expect(url).toBe('http://test.local/api/daily/cards/c1');
  expect(init.method).toBe('PATCH');
  expect(sentBody(1)).toEqual({ text: 'Mongolia capital?', back: 'UB' });
  expect(screen.getByText('Mongolia capital?')).toBeInTheDocument();
  expect(screen.queryByText('Capital of Mongolia?')).not.toBeInTheDocument();
});

it('an empty front blocks save', async () => {
  await renderPage(two());
  fireEvent.click(await screen.findByRole('button', { name: /capital of mongolia/i }));
  fireEvent.change(screen.getByLabelText('Front text'), { target: { value: '   ' } });
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  fireEvent.keyDown(screen.getByLabelText('Front text'), { key: 'Enter', ctrlKey: true });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it('shows an inline error and keeps the editor open when save fails', async () => {
  await renderPage(two());
  fireEvent.click(await screen.findByRole('button', { name: /capital of mongolia/i }));
  (global.fetch as jest.Mock).mockResolvedValueOnce(res({}, 500));
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
  expect(await screen.findByText(/could not save card/i)).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

it('Escape closes the editor and returns focus to the card', async () => {
  await renderPage(two());
  const tile = await screen.findByRole('button', { name: /capital of mongolia/i });
  fireEvent.click(tile);
  fireEvent.keyDown(screen.getByLabelText('Front text'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => expect(tile).toHaveFocus());
});

it('delete with confirm removes the card', async () => {
  await renderPage(two());
  fireEvent.click(await screen.findByRole('button', { name: /capital of mongolia/i }));
  fireEvent.click(screen.getByRole('button', { name: /delete card/i }));
  expect(screen.getByText('Delete this card?')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(1);

  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 204 });
  fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  const [url, init] = (global.fetch as jest.Mock).mock.calls[1];
  expect(url).toBe('http://test.local/api/daily/cards/c1');
  expect(init.method).toBe('DELETE');
  expect(screen.queryByText('Capital of Mongolia?')).not.toBeInTheDocument();
  expect(screen.getByText('Octopuses have three hearts')).toBeInTheDocument();
});

it('new card flow calls createIndexCard and adds to the grid', async () => {
  await renderPage([]);
  fireEvent.click((await screen.findAllByRole('button', { name: /\+ new card/i }))[0]);
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  (global.fetch as jest.Mock).mockResolvedValueOnce(res(card({ id: 'n1', text: 'Fresh', back: '' }), 201));

  fireEvent.change(screen.getByLabelText('Front text'), { target: { value: 'Fresh' } });
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  const [url, init] = (global.fetch as jest.Mock).mock.calls[1];
  expect(url).toBe('http://test.local/api/daily/cards');
  expect(init.method).toBe('POST');
  expect(sentBody(1)).toEqual({ text: 'Fresh', back: '' });
  expect(screen.getByRole('button', { name: 'Fresh' })).toBeInTheDocument();
});

it('a 401 on load signs out', async () => {
  mockFetch(res({}, 401));
  render(<CardsPage />);
  await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
});

it('a 401 on save signs out', async () => {
  await renderPage(two());
  fireEvent.click(await screen.findByRole('button', { name: /capital of mongolia/i }));
  (global.fetch as jest.Mock).mockResolvedValueOnce(res({}, 401));
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
  await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
});
