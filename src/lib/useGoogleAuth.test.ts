import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { useGoogleAuth } from './useGoogleAuth';

const TOKEN_KEY = 'write_google_token';

function makeToken(exp: number): string {
  const header = btoa(JSON.stringify({ alg: 'RS256' }));
  const payload = btoa(JSON.stringify({ sub: '123', exp }));
  return `${header}.${payload}.fakesig`;
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

it('restores authState to authenticated under StrictMode double-invoked effects, given a valid stored token', async () => {
  const token = makeToken(Math.floor(Date.now() / 1000) + 3600);
  sessionStorage.setItem(TOKEN_KEY, token);

  const { result } = renderHook(() => useGoogleAuth(), {
    wrapper: React.StrictMode,
  });

  await waitFor(() => expect(result.current.authState).toBe('authenticated'));
  expect(sessionStorage.getItem(TOKEN_KEY)).toBe(token);
});

it('leaves authState unauthenticated when no token is stored', async () => {
  const { result } = renderHook(() => useGoogleAuth(), {
    wrapper: React.StrictMode,
  });

  await waitFor(() => expect(result.current.authState).toBe('unauthenticated'));
  expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
});
