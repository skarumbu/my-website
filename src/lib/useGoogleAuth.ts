import { useState, useEffect, useCallback, useRef } from 'react';

export type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

const TOKEN_KEY = 'write_google_token';

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return {};
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  const exp = payload['exp'] as number | undefined;
  if (!exp) return false;
  return Date.now() / 1000 > exp;
}

/**
 * Shared Google Identity Services auth state machine for the private
 * writer/diary areas. Extracted from Write.tsx/WriteEditor.tsx, which
 * duplicated this verbatim — reused as-is by the new diary components.
 */
export function useGoogleAuth() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  // True once we've noticed the current token has expired, without tearing
  // down authState/googleToken. Kept separate from signOut() so a caller
  // mid-edit (e.g. the diary editor) can prompt re-auth inline instead of
  // being bounced to the full sign-in screen and losing sight of their draft.
  const [sessionExpired, setSessionExpired] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const googleTokenRef = useRef<string | null>(null);

  const handleCredentialResponse = useCallback((response: { credential: string }) => {
    setGoogleToken(response.credential);
    setAuthState('authenticated');
    setSessionExpired(false);
  }, []);

  useEffect(() => {
    googleTokenRef.current = googleToken;
  }, [googleToken]);

  // Google ID tokens last ~1hr. A tab left open longer than that carries a
  // stale token in state with nothing to notice until some action tries to
  // use it. Poll periodically so a long-idle tab surfaces "please sign in
  // again" on its own rather than only after a write fails.
  useEffect(() => {
    if (authState !== 'authenticated') return;
    const check = () => {
      const current = googleTokenRef.current;
      if (current && isTokenExpired(current)) setSessionExpired(true);
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [authState]);

  // Callers should run this immediately before any write that requires a
  // fresh token. It avoids sending a request we already know will be
  // rejected, and routes the failure through the same sessionExpired banner
  // instead of a generic save-failed message that invites a useless retry.
  const ensureFreshSession = useCallback((): boolean => {
    const current = googleTokenRef.current;
    if (!current || isTokenExpired(current)) {
      setSessionExpired(true);
      return false;
    }
    return true;
  }, []);

  // Server-side rejection (expired, revoked, or otherwise invalid token)
  // discovered despite the token looking unexpired locally — e.g. clock
  // skew, or Google invalidating it early. Same inline prompt, not a full
  // sign-out, so in-progress edits stay visible.
  const markSessionExpired = useCallback(() => {
    setSessionExpired(true);
  }, []);

  const initGoogleSignIn = useCallback(() => {
    const g = (window as any).google;
    if (!g?.accounts) return;
    g.accounts.id.initialize({
      client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
    });
    if (googleBtnRef.current) {
      g.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        width: 280,
      });
    }
  }, [handleCredentialResponse]);

  // Restore token from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(TOKEN_KEY);
    if (stored && !isTokenExpired(stored)) {
      setGoogleToken(stored);
      setAuthState('authenticated');
      return;
    }
    sessionStorage.removeItem(TOKEN_KEY);
    setAuthState('unauthenticated');
  }, []);

  // Persist token to sessionStorage when it changes. Only writes on a
  // truthy token — clearing storage is handled explicitly by the restore
  // effect above (no valid token found) and by signOut() below. An
  // unconditional removeItem() here raced with the restore effect's
  // setGoogleToken() on mount: this effect would still see the
  // pre-update `null` closure value and delete the token the restore
  // effect had just found, before the state update had a chance to
  // commit — most visible under StrictMode's double-invoked effects.
  useEffect(() => {
    if (googleToken) {
      sessionStorage.setItem(TOKEN_KEY, googleToken);
    }
  }, [googleToken]);

  // Load GIS and render button when unauthenticated, or when a caller needs
  // an inline re-auth button while sessionExpired is true (googleBtnRef may
  // be mounted in either the full sign-in screen or an inline banner).
  const needsSignInUi = authState === 'unauthenticated' || sessionExpired;
  useEffect(() => {
    if (!needsSignInUi) return;
    const g = (window as any).google;
    if (g?.accounts) {
      initGoogleSignIn();
      return;
    }
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', initGoogleSignIn);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGoogleSignIn;
    document.head.appendChild(script);
  }, [needsSignInUi, initGoogleSignIn]);

  // Re-render button when ref is available
  useEffect(() => {
    if (needsSignInUi && (window as any).google?.accounts) {
      initGoogleSignIn();
    }
  }, [needsSignInUi, googleBtnRef.current, initGoogleSignIn]); // eslint-disable-line

  const signOut = useCallback(() => {
    setGoogleToken(null);
    setSessionExpired(false);
    sessionStorage.removeItem(TOKEN_KEY);
    setAuthState('unauthenticated');
  }, []);

  return { authState, googleToken, googleBtnRef, signOut, sessionExpired, ensureFreshSession, markSessionExpired };
}
