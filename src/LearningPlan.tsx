import React, { useCallback, useEffect, useRef, useState } from 'react';
import NavBar from './components/nav-bar.tsx';
import './styling/learning-plan.css';

const API_BASE = process.env.REACT_APP_LEARNING_PLAN_API_BASE_URL ?? '';

// ── Types ─────────────────────────────────────────────────────────────────────

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';
type View = 'list' | 'create' | 'viewing';
type Duration = '1 week' | '1 month' | '3 months';
type Depth = 'beginner' | 'intermediate' | 'advanced';

interface CurrentUser {
  userId: string;
  email: string;
  name: string;
}

interface PlanMeta {
  id: string;
  topic: string;
  duration: string;
  depth: string;
  created_at: string;
}

interface PlanFull extends PlanMeta {
  plan_markdown: string;
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

function renderMarkdown(text: string): JSX.Element {
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let listItems: string[] = [];
  let orderedItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length) {
      elements.push(
        <ul key={key++}>
          {listItems.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: applyInline(item) }} />
          ))}
        </ul>
      );
      listItems = [];
    }
    if (orderedItems.length) {
      elements.push(
        <ol key={key++}>
          {orderedItems.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: applyInline(item) }} />
          ))}
        </ol>
      );
      orderedItems = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flushList();
      elements.push(<h2 key={key++}>{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      flushList();
      elements.push(<h3 key={key++}>{line.slice(4)}</h3>);
    } else if (/^[-*] /.test(line)) {
      orderedItems.length && flushList();
      listItems.push(line.slice(2));
    } else if (/^\d+\. /.test(line)) {
      listItems.length && flushList();
      orderedItems.push(line.replace(/^\d+\. /, ''));
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      elements.push(
        <p key={key++} dangerouslySetInnerHTML={{ __html: applyInline(line) }} />
      );
    }
  }
  flushList();

  return <div className="lp-plan-body">{elements}</div>;
}

function applyInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

// ── JWT payload decode (client-side only, no verification) ────────────────────

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

// ── Date formatting ───────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ── Main component ────────────────────────────────────────────────────────────

function LearningPlan() {
  // Auth
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  // Navigation
  const [view, setView] = useState<View>('list');

  // Form
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState<Duration>('1 month');
  const [depth, setDepth] = useState<Depth>('beginner');

  // Generation
  const [generating, setGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Saving
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Plans list
  const [plans, setPlans] = useState<PlanMeta[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);

  // Viewing a plan
  const [viewingPlan, setViewingPlan] = useState<PlanFull | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);

  const googleBtnRef = useRef<HTMLDivElement>(null);

  // ── Google sign-in setup ────────────────────────────────────────────

  const handleCredentialResponse = useCallback((response: { credential: string }) => {
    const token = response.credential;
    const payload = decodeJwtPayload(token);
    setGoogleToken(token);
    setCurrentUser({
      userId: payload['sub'] as string ?? '',
      email: payload['email'] as string ?? '',
      name: payload['name'] as string ?? payload['email'] as string ?? '',
    });
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
        width: 280,
      });
    }
  }, [handleCredentialResponse]);

  useEffect(() => {
    // Check for an existing token in sessionStorage
    const stored = sessionStorage.getItem('lp_google_token');
    if (stored && !isTokenExpired(stored)) {
      const payload = decodeJwtPayload(stored);
      setGoogleToken(stored);
      setCurrentUser({
        userId: payload['sub'] as string ?? '',
        email: payload['email'] as string ?? '',
        name: payload['name'] as string ?? payload['email'] as string ?? '',
      });
      setAuthState('authenticated');
      return;
    }
    sessionStorage.removeItem('lp_google_token');
    setAuthState('unauthenticated');
  }, []);

  // Persist token to sessionStorage when it changes
  useEffect(() => {
    if (googleToken) {
      sessionStorage.setItem('lp_google_token', googleToken);
    } else {
      sessionStorage.removeItem('lp_google_token');
    }
  }, [googleToken]);

  // Load GIS script and render button when unauthenticated
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

  // ── API helpers ─────────────────────────────────────────────────────

  const apiFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    if (!googleToken) throw new Error('Not signed in');
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${googleToken}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
    if (res.status === 401) {
      setGoogleToken(null);
      setCurrentUser(null);
      setAuthState('unauthenticated');
      throw new Error('Session expired — please sign in again');
    }
    return res;
  }, [googleToken]);

  // ── Load plans ──────────────────────────────────────────────────────

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const res = await apiFetch('/api/plans');
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setPlans(data.plans ?? []);
    } catch (e: any) {
      setPlansError(e.message);
    } finally {
      setPlansLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (authState === 'authenticated' && view === 'list') {
      loadPlans();
    }
  }, [authState, view, loadPlans]);

  // ── Generate ────────────────────────────────────────────────────────

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setGenerating(true);
    setGeneratedPlan(null);
    setGenerateError(null);
    try {
      const res = await apiFetch('/api/plans/generate', {
        method: 'POST',
        body: JSON.stringify({ topic: topic.trim(), duration, depth }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setGeneratedPlan(data.plan_markdown);
    } catch (e: any) {
      setGenerateError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Save ────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!generatedPlan) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await apiFetch('/api/plans', {
        method: 'POST',
        body: JSON.stringify({ topic: topic.trim(), duration, depth, plan_markdown: generatedPlan }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `${res.status}`);
      }
      // Return to list and reload
      setGeneratedPlan(null);
      setTopic('');
      setView('list');
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── View plan ───────────────────────────────────────────────────────

  const handleViewPlan = async (plan: PlanMeta) => {
    setView('viewing');
    setViewingPlan(null);
    setViewError(null);
    setViewLoading(true);
    try {
      const res = await apiFetch(`/api/plans/${plan.id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setViewingPlan(data);
    } catch (e: any) {
      setViewError(e.message);
    } finally {
      setViewLoading(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────

  const handleDelete = async (planId: string, topic: string) => {
    if (!window.confirm(`Delete "${topic}"?`)) return;
    try {
      await apiFetch(`/api/plans/${planId}`, { method: 'DELETE' });
      setPlans(prev => prev.filter(p => p.id !== planId));
      if (view === 'viewing') setView('list');
    } catch (e: any) {
      // silently fail — plan list will be stale at worst
    }
  };

  // ── Render ──────────────────────────────────────────────────────────

  if (authState === 'loading') {
    return (
      <div className="lp-page">
        <NavBar />
        <div className="lp-splash"><div className="lp-spinner" /></div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <div className="lp-page">
        <NavBar />
        <div className="lp-content">
          <div className="lp-login-view">
            <div className="lp-eyebrow">Learning Plan Builder</div>
            <h1 className="lp-heading">What do you want<br />to understand?</h1>
            <p className="lp-login-sub">
              Sign in with Google to generate and save personalised study plans.
            </p>
            <div className="lp-google-signin-wrap">
              <div ref={googleBtnRef} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Create view ─────────────────────────────────────────────────────

  if (view === 'create') {
    return (
      <div className="lp-page">
        <NavBar />
        <div className="lp-content">
          <div className="lp-header">
            <button className="lp-btn-ghost" onClick={() => { setView('list'); setGeneratedPlan(null); setGenerateError(null); }}>
              ← Back to plans
            </button>
          </div>

          {!generatedPlan && !generating && (
            <form className="lp-form-card" onSubmit={handleGenerate}>
              <div>
                <span className="lp-kicker">New Plan</span>
                <h2 className="lp-form-headline">What do you want<br />to understand?</h2>
              </div>

              <div className="lp-field">
                <label className="lp-field-label">Topic</label>
                <textarea
                  className="lp-textarea"
                  value={topic}
                  onChange={e => setTopic(e.target.value.slice(0, 200))}
                  placeholder="e.g. Rust programming language, machine learning fundamentals, classical music theory…"
                  autoFocus
                  rows={3}
                />
                <div className="lp-char-count">{topic.length} / 200</div>
              </div>

              <div className="lp-field">
                <span className="lp-field-label">Duration</span>
                <div className="lp-segment">
                  {(['1 week', '1 month', '3 months'] as Duration[]).map(d => (
                    <button
                      key={d}
                      type="button"
                      className={`lp-segment-btn${duration === d ? ' lp-segment-btn--active' : ''}`}
                      onClick={() => setDuration(d)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lp-field">
                <span className="lp-field-label">Depth</span>
                <div className="lp-segment">
                  {(['beginner', 'intermediate', 'advanced'] as Depth[]).map(d => (
                    <button
                      key={d}
                      type="button"
                      className={`lp-segment-btn${depth === d ? ' lp-segment-btn--active' : ''}`}
                      onClick={() => setDepth(d)}
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {generateError && <div className="lp-error">{generateError}</div>}

              <button
                type="submit"
                className="lp-btn-primary"
                disabled={!topic.trim()}
              >
                Generate →
              </button>
            </form>
          )}

          {generating && (
            <div className="lp-generating">
              <div className="lp-generating-spinner" />
              <div className="lp-generating-text">Generating your plan…</div>
            </div>
          )}

          {generatedPlan && !generating && (
            <div className="lp-plan-preview">
              <div>
                <p className="lp-plan-preview-topic">{topic}</p>
                <div className="lp-plan-preview-meta">
                  <span className="lp-badge">{duration}</span>
                  <span className="lp-badge">{depth}</span>
                </div>
              </div>

              <div className="lp-plan-card">
                {renderMarkdown(generatedPlan)}
              </div>

              {saveError && <div className="lp-error">{saveError}</div>}

              <div className="lp-action-row">
                <button className="lp-btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Plan'}
                </button>
                <button
                  className="lp-btn-secondary"
                  onClick={() => { setGeneratedPlan(null); setGenerateError(null); }}
                  disabled={saving}
                >
                  Regenerate
                </button>
                <button
                  className="lp-btn-ghost"
                  onClick={() => { setView('list'); setGeneratedPlan(null); setTopic(''); }}
                  disabled={saving}
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Viewing a saved plan ────────────────────────────────────────────

  if (view === 'viewing') {
    return (
      <div className="lp-page">
        <NavBar />
        <div className="lp-content">
          <button className="lp-btn-ghost" onClick={() => { setView('list'); setViewingPlan(null); setViewError(null); }}>
            ← Back to plans
          </button>

          {viewLoading && (
            <div className="lp-generating" style={{ marginTop: 32 }}>
              <div className="lp-generating-spinner" />
            </div>
          )}

          {viewError && !viewLoading && (
            <div className="lp-error" style={{ marginTop: 24 }}>{viewError}</div>
          )}

          {viewingPlan && !viewLoading && (
            <>
              <div style={{ marginTop: 24 }}>
                <span className="lp-kicker">Learning Plan</span>
                <div className="lp-detail-header">
                  <div>
                    <h1 className="lp-detail-title">{viewingPlan.topic}</h1>
                    <div className="lp-detail-meta">
                      {viewingPlan.duration && <span className="lp-badge">{viewingPlan.duration}</span>}
                      {viewingPlan.depth && <span className="lp-badge">{viewingPlan.depth}</span>}
                      <span className="lp-detail-date">{fmtDate(viewingPlan.created_at)}</span>
                    </div>
                  </div>
                  <button
                    className="lp-btn-danger"
                    onClick={() => handleDelete(viewingPlan.id, viewingPlan.topic)}
                  >
                    Delete
                  </button>
                </div>
                <hr className="lp-detail-rule" />
              </div>
              <div className="lp-plan-card">
                {renderMarkdown(viewingPlan.plan_markdown)}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── List view (default) ─────────────────────────────────────────────

  return (
    <div className="lp-page">
      <NavBar />
      <div className="lp-content">
        <div className="lp-header">
          <div className="lp-header-row">
            <div>
              <div className="lp-eyebrow">Learning Plan Builder</div>
              <h1 className="lp-heading">Your Plans</h1>
              <div className="lp-header-meta">{currentUser?.email}</div>
            </div>
            <button
              className="lp-btn-primary"
              onClick={() => { setView('create'); setGeneratedPlan(null); setGenerateError(null); }}
            >
              + New Plan
            </button>
          </div>
          <hr className="lp-header-rule" />
        </div>

        {plansError && <div className="lp-error">{plansError}</div>}

        {plansLoading && (
          <div className="lp-splash" style={{ minHeight: 200 }}>
            <div className="lp-spinner" />
          </div>
        )}

        {!plansLoading && plans.length === 0 && (
          <div className="lp-empty">
            <div className="lp-empty-head">No plans yet</div>
            <div className="lp-empty-sub">
              Create your first learning plan and it'll appear here.
            </div>
            <button
              className="lp-btn-primary"
              style={{ marginTop: 8 }}
              onClick={() => setView('create')}
            >
              + New Plan
            </button>
          </div>
        )}

        {!plansLoading && plans.length > 0 && (
          <div className="lp-plans-grid">
            {plans.map(plan => (
              <div
                key={plan.id}
                className="lp-saved-card"
                onClick={() => handleViewPlan(plan)}
              >
                <div className="lp-saved-card-body">
                  <div className="lp-saved-card-topic">{plan.topic}</div>
                  <div className="lp-saved-card-meta">
                    {plan.duration && <span className="lp-badge">{plan.duration}</span>}
                    {plan.depth && <span className="lp-badge">{plan.depth}</span>}
                    <span className="lp-saved-card-date">{fmtDate(plan.created_at)}</span>
                  </div>
                </div>
                <div
                  className="lp-saved-card-actions"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    className="lp-btn-ghost"
                    onClick={() => handleViewPlan(plan)}
                  >
                    View
                  </button>
                  <button
                    className="lp-btn-danger"
                    onClick={() => handleDelete(plan.id, plan.topic)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LearningPlan;
