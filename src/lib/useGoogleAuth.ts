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
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const handleCredentialResponse = useCallback((response: { credential: string }) => {
    setGoogleToken(response.credential);
    setAuthState('authenticated');
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

  // Persist token to sessionStorage when it changes
  useEffect(() => {
    if (googleToken) {
      sessionStorage.setItem(TOKEN_KEY, googleToken);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  }, [googleToken]);

  // Load GIS and render button when unauthenticated
  useEffect(() => {
    if (authState !== 'unauthenticated') return;
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
  }, [authState, initGoogleSignIn]);

  // Re-render button when ref is available
  useEffect(() => {
    if (authState === 'unauthenticated' && (window as any).google?.accounts) {
      initGoogleSignIn();
    }
  }, [authState, googleBtnRef.current, initGoogleSignIn]); // eslint-disable-line

  const signOut = useCallback(() => {
    setGoogleToken(null);
    sessionStorage.removeItem(TOKEN_KEY);
    setAuthState('unauthenticated');
  }, []);

  return { authState, googleToken, googleBtnRef, signOut };
}
