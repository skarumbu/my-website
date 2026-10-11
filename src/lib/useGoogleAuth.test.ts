import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
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

// Covers the "save says it failed, but a re-check shows everything saved"
// report: a tab left open past the ~1hr Google ID token lifetime shouldn't
// have to make a doomed network request to discover its token is stale.
describe('sessionExpired / ensureFreshSession / markSessionExpired', () => {
  it('ensureFreshSession fails fast when there is no usable token, without needing a network round trip', async () => {
    // No stored token at all — the mount-time restore effect leaves this
    // unauthenticated. A caller that tries to save anyway should get the
    // same "not usable" answer ensureFreshSession gives an expired token,
    // without a save attempt ever reaching the network.
    const { result } = renderHook(() => useGoogleAuth());
    await waitFor(() => expect(result.current.authState).toBe('unauthenticated'));

    let usable = true;
    act(() => {
      usable = result.current.ensureFreshSession();
    });
    expect(usable).toBe(false);
    expect(result.current.sessionExpired).toBe(true);
  });

  it('ensureFreshSession passes for a token with plenty of time left', async () => {
    const freshToken = makeToken(Math.floor(Date.now() / 1000) + 3600);
    sessionStorage.setItem(TOKEN_KEY, freshToken);
    const { result } = renderHook(() => useGoogleAuth());
    await waitFor(() => expect(result.current.authState).toBe('authenticated'));

    let usable = false;
    act(() => {
      usable = result.current.ensureFreshSession();
    });
    expect(usable).toBe(true);
    expect(result.current.sessionExpired).toBe(false);
  });

  it('markSessionExpired flags the session inline without signing out or discarding the token', async () => {
    const freshToken = makeToken(Math.floor(Date.now() / 1000) + 3600);
    sessionStorage.setItem(TOKEN_KEY, freshToken);
    const { result } = renderHook(() => useGoogleAuth());
    await waitFor(() => expect(result.current.authState).toBe('authenticated'));

    act(() => {
      result.current.markSessionExpired();
    });

    expect(result.current.sessionExpired).toBe(true);
    // The whole point: unlike signOut(), this keeps the caller's in-progress
    // view (e.g. the diary editor) intact instead of bouncing to login.
    expect(result.current.authState).toBe('authenticated');
    expect(result.current.googleToken).toBe(freshToken);
  });

  it('signOut clears sessionExpired along with the token', async () => {
    const freshToken = makeToken(Math.floor(Date.now() / 1000) + 3600);
    sessionStorage.setItem(TOKEN_KEY, freshToken);
    const { result } = renderHook(() => useGoogleAuth());
    await waitFor(() => expect(result.current.authState).toBe('authenticated'));

    act(() => {
      result.current.markSessionExpired();
    });
    expect(result.current.sessionExpired).toBe(true);

    act(() => {
      result.current.signOut();
    });
    expect(result.current.sessionExpired).toBe(false);
    expect(result.current.authState).toBe('unauthenticated');
    expect(result.current.googleToken).toBeNull();
  });

  it('a long-idle tab notices its token expired on its own, via the periodic check', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    try {
      // Expires 1 second after mount — short enough that advancing fake
      // timers past the 30s poll interval reliably crosses it.
      const soonToExpire = makeToken(Math.floor(Date.now() / 1000) + 1);
      sessionStorage.setItem(TOKEN_KEY, soonToExpire);
      const { result } = renderHook(() => useGoogleAuth());
      await waitFor(() => expect(result.current.authState).toBe('authenticated'));
      expect(result.current.sessionExpired).toBe(false);

      await act(async () => {
        jest.advanceTimersByTime(31000);
      });

      expect(result.current.sessionExpired).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
