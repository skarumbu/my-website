import React, { useState, useEffect, useCallback } from 'react';
import NavBar from './components/nav-bar.tsx';
import './styling/ideas.css';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { ideasApiRequest } from './authConfig.js';

const BASE_URL = process.env.REACT_APP_IDEAS_API_BASE_URL;

const PROJECT_TINTS: Record<string, { fg: string; bg: string }> = {
  'Digits':       { fg: '#1f6b6b', bg: '#cfe3db' },
  'NBA Games':    { fg: '#a86b1f', bg: '#f0dcc4' },
  'Trail Finder': { fg: '#5a7a2e', bg: '#dde6c4' },
  'Ideas':        { fg: '#6b3a8a', bg: '#e2d4ec' },
  'Other':        { fg: '#555555', bg: '#dcdcd6' },
};

const PROJECTS = ['Digits', 'NBA Games', 'Trail Finder', 'Ideas', 'Other'];

interface Idea {
  id: string;
  feature_name: string;
  title: string;
  body: string;
  status: 'open' | 'done' | 'dismissed';
  created_at: string;
  source: string;
}

type StatusFilter = 'open' | 'done' | 'dismissed' | 'all';
type SortOrder = 'newest' | 'oldest' | 'project';

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

function cardRot(id: string): number {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return ((sum % 5) - 2) * 0.18;
}

function tintFor(name: string) {
  return PROJECT_TINTS[name] ?? PROJECT_TINTS['Other'];
}

// ── Composer (slide-over) ─────────────────────────────────────────────

interface ComposerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { feature_name: string; title: string; body: string; status: Idea['status'] }) => void;
  initial: Idea | null;
}

function Composer({ open, onClose, onSubmit, initial }: ComposerProps) {
  const isEdit = !!initial;
  const [project, setProject] = useState(initial?.feature_name || 'Digits');
  const [title, setTitle] = useState(initial?.title || '');
  const [body, setBody] = useState(initial?.body || '');
  const [status, setStatus] = useState<Idea['status']>(initial?.status || 'open');

  useEffect(() => {
    if (open) {
      setProject(initial?.feature_name || 'Digits');
      setTitle(initial?.title || '');
      setBody(initial?.body || '');
      setStatus(initial?.status || 'open');
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ feature_name: project, title: title.trim(), body: body.trim(), status });
    onClose();
  };

  return (
    <>
      <div
        className={`ideas-overlay${open ? ' ideas-overlay--open' : ''}`}
        onClick={onClose}
      />
      <div className={`ideas-composer${open ? ' ideas-composer--open' : ''}`}>
        <div className="ideas-composer-header">
          <span className="ideas-composer-title">{isEdit ? 'Edit idea' : 'New idea'}</span>
          <button className="ideas-composer-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form className="ideas-composer-body" onSubmit={handleSubmit}>
          <label className="ideas-field">
            <span className="ideas-field-label">Project</span>
            <select
              className="ideas-field-input"
              value={project}
              onChange={e => setProject(e.target.value)}
            >
              {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>

          <label className="ideas-field">
            <span className="ideas-field-label">Title</span>
            <input
              autoFocus
              className="ideas-field-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What's the idea?"
            />
          </label>

          <label className="ideas-field">
            <span className="ideas-field-label">Description</span>
            <textarea
              className="ideas-field-input ideas-field-textarea"
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Why does this matter? Any specifics?"
              rows={6}
            />
          </label>

          {isEdit && (
            <label className="ideas-field">
              <span className="ideas-field-label">Status</span>
              <div className="ideas-status-toggle">
                {(['open', 'done', 'dismissed'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    className={`ideas-status-btn${status === s ? ' ideas-status-btn--active' : ''}`}
                    onClick={() => setStatus(s)}
                  >{s}</button>
                ))}
              </div>
            </label>
          )}

          <div style={{ flex: 1 }} />
          <div className="ideas-composer-actions">
            <button type="button" className="ideas-cancel-btn" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="ideas-submit-btn"
              disabled={!title.trim()}
            >{isEdit ? 'Save' : 'Add idea'}</button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Idea['status'] }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    done:      { bg: 'rgba(31,107,107,0.12)',  fg: '#1f6b6b', label: 'Done' },
    dismissed: { bg: 'rgba(120,80,40,0.12)',   fg: '#7a5a3a', label: 'Dismissed' },
  };
  const s = map[status];
  if (!s) return null;
  return (
    <span className="ideas-status-badge" style={{ background: s.bg, color: s.fg }}>
      <span className="ideas-status-dot" style={{ background: s.fg }} />
      {s.label}
    </span>
  );
}

// ── IdeaCard ──────────────────────────────────────────────────────────

interface CardProps {
  idea: Idea;
  onEdit: () => void;
  onDelete: () => void;
  onSetState: (s: Idea['status']) => void;
  updating: boolean;
}

function IdeaCard({ idea, onEdit, onDelete, onSetState, updating }: CardProps) {
  const [hover, setHover] = useState(false);
  const tint = tintFor(idea.feature_name);
  const isDone = idea.status === 'done';
  const isDismissed = idea.status === 'dismissed';
  const rot = cardRot(idea.id);

  return (
    <div
      className="ideas-card"
      style={{
        transform: hover ? 'translateY(-3px) rotate(0deg)' : `translateY(0) rotate(${rot}deg)`,
        opacity: isDismissed ? 0.55 : 1,
        boxShadow: hover
          ? '0 18px 36px -12px rgba(20,40,40,0.28), 0 4px 10px rgba(20,40,40,0.08)'
          : '0 4px 10px -2px rgba(20,40,40,0.08), 0 1px 2px rgba(20,40,40,0.04)',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onEdit}
    >
      <div className="ideas-card-tint" style={{ background: tint.fg }} />

      <div className="ideas-card-top">
        <div className="ideas-card-badges">
          <span className="ideas-project-badge" style={{ background: tint.bg, color: tint.fg }}>
            {idea.feature_name}
          </span>
          {idea.status !== 'open' && <StatusBadge status={idea.status} />}
        </div>
        <span className="ideas-card-date">{fmtDate(idea.created_at)}</span>
      </div>

      <div
        className="ideas-card-title"
        style={{
          textDecoration: isDone ? 'line-through' : 'none',
          textDecorationColor: 'rgba(31,107,107,0.5)',
        }}
      >
        {idea.title}
      </div>

      {idea.body && (
        <div className="ideas-card-body">{idea.body}</div>
      )}

      <div
        className="ideas-card-actions"
        style={{
          opacity: hover ? 1 : 0,
          transform: hover ? 'translateY(0)' : 'translateY(4px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {idea.status === 'open' ? (
          <>
            <button
              className="ideas-action-btn ideas-action-btn--done"
              onClick={() => onSetState('done')}
              disabled={updating}
            >
              <svg width="11" height="11" viewBox="0 0 24 24">
                <path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Done
            </button>
            <button
              className="ideas-action-btn ideas-action-btn--dismiss"
              onClick={() => onSetState('dismissed')}
              disabled={updating}
            >Dismiss</button>
          </>
        ) : (
          <button
            className="ideas-action-btn ideas-action-btn--reopen"
            onClick={() => onSetState('open')}
            disabled={updating}
          >Reopen</button>
        )}
        <div style={{ flex: 1 }} />
        <button
          className="ideas-action-btn ideas-action-btn--delete"
          onClick={onDelete}
          title="Delete"
        >
          <svg width="11" height="11" viewBox="0 0 24 24">
            <path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────

function EmptyState({ tab, onAdd }: { tab: StatusFilter; onAdd: () => void }) {
  const messages: Record<string, { head: string; sub: string }> = {
    open:      { head: 'No open ideas yet',   sub: 'A backlog starts with one small bet. Add the first.' },
    done:      { head: 'Nothing shipped yet', sub: 'Completed ideas will land here.' },
    dismissed: { head: 'No dismissed ideas',  sub: 'Ideas you set aside show up here.' },
    all:       { head: 'Empty backlog',        sub: 'Get started by adding your first idea.' },
  };
  const msg = messages[tab];

  return (
    <div className="ideas-empty">
      <div className="ideas-empty-cards">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="ideas-empty-card"
            style={{
              transform: `translate(${i * 4}px, ${-i * 4}px) rotate(${(i - 1) * -3}deg)`,
              background: i === 2 ? '#fbfaf3' : 'rgba(255,255,255,0.6)',
            }}
          />
        ))}
      </div>
      <div className="ideas-empty-head">{msg.head}</div>
      <div className="ideas-empty-sub">{msg.sub}</div>
      {tab !== 'done' && tab !== 'dismissed' && (
        <button className="ideas-empty-btn" onClick={onAdd}>
          <svg width="13" height="13" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
          </svg>
          Add an idea
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

function Ideas() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<StatusFilter>('open');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [updating, setUpdating] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<Idea | null>(null);

  const getToken = useCallback(async (): Promise<string> => {
    try {
      const response = await instance.acquireTokenSilent({ ...ideasApiRequest, account: accounts[0] });
      return response.accessToken;
    } catch {
      instance.acquireTokenRedirect({ ...ideasApiRequest, redirectUri: window.location.origin + '/ideas' });
      throw new Error('Redirecting for auth...');
    }
  }, [instance, accounts]);

  const fetchIdeas = useCallback(async () => {
    if (!BASE_URL) { setError('REACT_APP_IDEAS_API_BASE_URL is not configured'); return; }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/api/ideas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
      const json = await resp.json();
      setIdeas(json.ideas ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (isAuthenticated) fetchIdeas();
  }, [isAuthenticated, fetchIdeas]);

  const handleLogin = () => {
    instance.loginRedirect({ ...ideasApiRequest, redirectUri: window.location.origin + '/ideas' });
  };

  const handleCreate = async (data: { feature_name: string; title: string; body: string; status: Idea['status'] }) => {
    if (!BASE_URL) return;
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/api/ideas`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature_name: data.feature_name, title: data.title, body: data.body }),
      });
      if (!resp.ok) throw new Error(`${resp.status}`);
      await fetchIdeas();
    } catch (e: any) {
      setError('Failed to create: ' + e.message);
    }
  };

  const handleEdit = async (idea: Idea, data: { feature_name: string; title: string; body: string; status: Idea['status'] }) => {
    if (!BASE_URL || updating) return;
    setUpdating(idea.id);
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/api/ideas/${idea.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!resp.ok) throw new Error(`${resp.status}`);
      setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, ...data } : i));
    } catch (e: any) {
      setError('Failed to update: ' + e.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleSetState = async (idea: Idea, newStatus: Idea['status']) => {
    if (!BASE_URL || updating) return;
    setUpdating(idea.id);
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/api/ideas/${idea.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!resp.ok) throw new Error(`${resp.status}`);
      setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, status: newStatus } : i));
    } catch (e: any) {
      setError('Failed to update status: ' + e.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (idea: Idea) => {
    if (!BASE_URL || !window.confirm(`Delete "${idea.title}"?`)) return;
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/api/ideas/${idea.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`${resp.status}`);
      setIdeas(prev => prev.filter(i => i.id !== idea.id));
    } catch (e: any) {
      setError('Failed to delete: ' + e.message);
    }
  };

  const openNew = () => { setEditing(null); setComposerOpen(true); };
  const openEdit = (idea: Idea) => { setEditing(idea); setComposerOpen(true); };

  const handleComposerSubmit = (data: { feature_name: string; title: string; body: string; status: Idea['status'] }) => {
    if (editing) handleEdit(editing, data);
    else handleCreate(data);
  };

  // Client-side filter + sort
  let visible = ideas;
  if (tab !== 'all') visible = visible.filter(i => i.status === tab);
  if (query) {
    const q = query.toLowerCase();
    visible = visible.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.body.toLowerCase().includes(q) ||
      i.feature_name.toLowerCase().includes(q)
    );
  }
  visible = [...visible];
  if (sort === 'oldest') visible.sort((a, b) => a.created_at.localeCompare(b.created_at));
  else if (sort === 'project') visible.sort((a, b) => a.feature_name.localeCompare(b.feature_name));
  else visible.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const counts = {
    open:      ideas.filter(i => i.status === 'open').length,
    done:      ideas.filter(i => i.status === 'done').length,
    dismissed: ideas.filter(i => i.status === 'dismissed').length,
    all:       ideas.length,
  };

  if (!isAuthenticated) {
    return (
      <div className="ideas-page">
        <NavBar />
        <div className="ideas-login-view">
          <div className="ideas-eyebrow">Backlog</div>
          <h1 className="ideas-heading">Feature Ideas</h1>
          <p className="ideas-login-sub">Sign in to view and manage the feature backlog</p>
          <button className="ideas-login-btn" onClick={handleLogin}>Sign in with Microsoft</button>
          {error && <p className="ideas-error">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="ideas-page">
      <NavBar />

      <div className="ideas-content">
        {/* Header */}
        <div className="ideas-header">
          <div>
            <div className="ideas-eyebrow">Backlog</div>
            <h1 className="ideas-heading">Feature Ideas</h1>
            <div className="ideas-counts">
              {counts.open} open · {counts.done} done · {counts.dismissed} dismissed
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="ideas-toolbar">
          <div className="ideas-tabs">
            {([
              ['open', 'Open'],
              ['done', 'Done'],
              ['dismissed', 'Dismissed'],
              ['all', 'All'],
            ] as [StatusFilter, string][]).map(([k, label]) => (
              <button
                key={k}
                className={`ideas-tab${tab === k ? ' ideas-tab--active' : ''}`}
                onClick={() => setTab(k)}
              >
                {label}
                <span className={`ideas-tab-count${tab === k ? ' ideas-tab-count--active' : ''}`}>
                  {counts[k]}
                </span>
              </button>
            ))}
          </div>

          <div className="ideas-search">
            <svg width="14" height="14" viewBox="0 0 24 24">
              <circle cx="10" cy="10" r="6" stroke="#1f3a3a" strokeWidth="2" fill="none" />
              <line x1="15" y1="15" x2="20" y2="20" stroke="#1f3a3a" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              className="ideas-search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search ideas"
            />
          </div>

          <div style={{ flex: 1 }} />

          <select
            className="ideas-sort-select"
            value={sort}
            onChange={e => setSort(e.target.value as SortOrder)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="project">Project</option>
          </select>

          <button className="ideas-add-btn" onClick={openNew}>
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
            </svg>
            New idea
          </button>
        </div>

        {error && <p className="ideas-error">{error}</p>}
        {loading && !ideas.length && <p className="ideas-loading">Loading…</p>}

        {/* Card grid */}
        <div className="ideas-grid">
          {!loading && visible.length === 0 ? (
            <div className="ideas-grid-empty">
              <EmptyState tab={tab} onAdd={openNew} />
            </div>
          ) : (
            visible.map(idea => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onEdit={() => openEdit(idea)}
                onDelete={() => handleDelete(idea)}
                onSetState={s => handleSetState(idea, s)}
                updating={updating === idea.id}
              />
            ))
          )}
        </div>
      </div>

      {/* Floating action button */}
      <button className="ideas-fab" onClick={openNew} title="New idea" aria-label="New idea">
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
        </svg>
      </button>

      <Composer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSubmit={handleComposerSubmit}
        initial={editing}
      />
    </div>
  );
}

export default Ideas;
