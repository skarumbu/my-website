import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import NavBar from './components/nav-bar.tsx';
import './styling/ideas.css';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { ideasApiRequest } from './authConfig.js';
import { acquireToken } from './auth.ts';

const BASE_URL = process.env.REACT_APP_IDEAS_API_BASE_URL;

const PROJECT_TINTS: Record<string, { fg: string; bg: string }> = {
  'Digits':       { fg: '#A6422F', bg: '#FFC2B0' },
  'NBA Games':    { fg: '#8A5320', bg: '#FCD9A6' },
  'Trail Finder': { fg: '#4E6E1E', bg: '#D4E8A9' },
  'Ideas':        { fg: '#573E89', bg: '#E1D2F2' },
  'Architecture': { fg: '#2D6E47', bg: '#C9EBD1' },
  'Dashboard':    { fg: '#2C5F7E', bg: '#BFE1F2' },
  'Learning':     { fg: '#93384F', bg: '#FFCDD8' },
  'Other':        { fg: '#7A5B16', bg: '#FFE793' },
};

const PROJECTS = ['Digits', 'NBA Games', 'Trail Finder', 'Ideas', 'Other'];

type BotStatus = 'queued' | 'running' | 'completed' | 'failed' | 'needs_info' | 'blocked';

interface Idea {
  id: string;
  project: string;
  project_id: string | null;
  title: string;
  body: string;
  status: 'open' | 'done' | 'dismissed';
  created_at: string;
  source: string;
  bot_status?: BotStatus | null;
  bot_pr_url?: string | null;
  bot_error?: string | null;
  bot_blocked_by?: string | null;
}

interface Project {
  id: string;
  name: string;
  repo?: string;
}

interface Update {
  id: string;
  idea_id: string;
  content: string;
  created_at: string;
  author_email: string;
  author_name: string;
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

const NEW_PROJECT_SENTINEL = '__new__';

interface ComposerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    data: { project: string; project_id: string | null; title: string; body: string; status: Idea['status'] },
    newProjectName?: string,
    newProjectRepo?: string
  ) => void;
  initial: Idea | null;
  projects: Project[];
}

function Composer({ open, onClose, onSubmit, initial, projects }: ComposerProps) {
  const isEdit = !!initial;
  const [project, setProject] = useState(initial?.project || projects[0]?.name || '');
  const [title, setTitle] = useState(initial?.title || '');
  const [body, setBody] = useState(initial?.body || '');
  const [status, setStatus] = useState<Idea['status']>(initial?.status || 'open');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectRepo, setNewProjectRepo] = useState('');
  const [showNewInput, setShowNewInput] = useState(false);

  useEffect(() => {
    if (open) {
      setProject(initial?.project || projects[0]?.name || '');
      setTitle(initial?.title || '');
      setBody(initial?.body || '');
      setStatus(initial?.status || 'open');
      setNewProjectName('');
      setNewProjectRepo('');
      setShowNewInput(false);
    }
  }, [open, initial, projects]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const effectiveProjectName = showNewInput ? newProjectName.trim() : project;
    if (!effectiveProjectName) return;
    const matched = projects.find(p => p.name === effectiveProjectName);
    onSubmit(
      { project: effectiveProjectName, project_id: matched?.id ?? null, title: title.trim(), body: body.trim(), status },
      showNewInput ? newProjectName.trim() : undefined,
      showNewInput ? newProjectRepo.trim() : undefined
    );
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
              value={showNewInput ? NEW_PROJECT_SENTINEL : project}
              onChange={e => {
                if (e.target.value === NEW_PROJECT_SENTINEL) {
                  setShowNewInput(true);
                  setProject('');
                } else {
                  setShowNewInput(false);
                  setProject(e.target.value);
                }
              }}
            >
              {projects.map(p => <option key={p.id || p.name} value={p.name}>{p.name}</option>)}
              <option value={NEW_PROJECT_SENTINEL}>+ New project…</option>
            </select>
            {showNewInput && (
              <>
                <input
                  autoFocus
                  className="ideas-field-input ideas-new-project-input"
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  placeholder="Project name"
                  maxLength={60}
                />
                <input
                  className="ideas-field-input"
                  value={newProjectRepo}
                  onChange={e => setNewProjectRepo(e.target.value)}
                  placeholder="GitHub repo (e.g. skarumbu/my-website)"
                />
              </>
            )}
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
              disabled={!title.trim() || (showNewInput && !newProjectName.trim())}
            >{isEdit ? 'Save' : 'Add idea'}</button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── BotStatusChip ─────────────────────────────────────────────────────

function BotStatusChip({ idea }: { idea: Idea }) {
  const status = idea.bot_status;
  if (!status) return null;

  const map: Record<BotStatus, { fg: string; bg: string; label: string }> = {
    queued:     { fg: '#92400e', bg: 'rgba(251,191,36,0.18)',   label: 'Queued' },
    running:    { fg: '#1e40af', bg: 'rgba(59,130,246,0.15)',   label: 'Running…' },
    completed:  { fg: '#065f46', bg: 'rgba(16,185,129,0.15)',   label: 'Done' },
    failed:     { fg: '#991b1b', bg: 'rgba(239,68,68,0.15)',    label: 'Failed' },
    needs_info: { fg: '#6d28d9', bg: 'rgba(139,92,246,0.15)',   label: 'Needs info' },
    blocked:    { fg: '#1e40af', bg: 'rgba(59,130,246,0.12)',   label: 'Blocked' },
  };
  const s = map[status];
  if (!s) return null;

  return (
    <span
      className="ideas-bot-chip"
      style={{ color: s.fg, background: s.bg }}
      title={status === 'failed' ? (idea.bot_error ?? undefined) : undefined}
    >
      {status === 'running' && <span className="ideas-bot-spinner" />}
      {status === 'completed' && idea.bot_pr_url ? (
        <a
          className="ideas-bot-pr-link"
          href={idea.bot_pr_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
        >
          {s.label} · View PR
        </a>
      ) : s.label}
    </span>
  );
}

// ── StatusPill ────────────────────────────────────────────────────────

function StatusPill({ status }: { status: Idea['status'] }) {
  const map: Record<string, { cls: string; label: string }> = {
    open:      { cls: 'ideas-status-pill--open',      label: 'Open' },
    done:      { cls: 'ideas-status-pill--done',      label: 'Done' },
    dismissed: { cls: 'ideas-status-pill--dismissed', label: 'Shelved' },
  };
  const s = map[status] ?? map.open;
  return (
    <span className={`ideas-status-pill ${s.cls}`}>
      <span className="ideas-status-dot" />
      {s.label}
    </span>
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

// ── IdeaDetailPanel ───────────────────────────────────────────────────

interface DetailPanelProps {
  open: boolean;
  idea: Idea | null;
  onClose: () => void;
  onEdit: () => void;
  getToken: () => Promise<string>;
}

function IdeaDetailPanel({ open, idea, onClose, onEdit, getToken }: DetailPanelProps) {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!open || !idea) return;
    setUpdates([]);
    setNewContent('');
    setLoadingUpdates(true);
    (async () => {
      try {
        const token = await getToken();
        const resp = await fetch(`${BASE_URL}/api/ideas/${idea.id}/updates`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const json = await resp.json();
          setUpdates(json.updates ?? []);
        }
      } catch {} finally {
        setLoadingUpdates(false);
      }
    })();
  }, [open, idea, getToken]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handlePost = async () => {
    if (!idea || !newContent.trim() || posting) return;
    setPosting(true);
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/api/ideas/${idea.id}/updates`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent.trim() }),
      });
      if (!resp.ok) throw new Error(`${resp.status}`);
      const update: Update = await resp.json();
      setUpdates(prev => [...prev, update]);
      setNewContent('');
    } catch {} finally {
      setPosting(false);
    }
  };

  const handleDeleteUpdate = async (update: Update) => {
    if (!idea) return;
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/api/ideas/${idea.id}/updates/${update.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok || resp.status === 204) {
        setUpdates(prev => prev.filter(u => u.id !== update.id));
      }
    } catch {}
  };

  if (!idea) return null;
  const tint = tintFor(idea.project);

  return (
    <>
      <div
        className={`ideas-overlay${open ? ' ideas-overlay--open' : ''}`}
        onClick={onClose}
      />
      <div className={`ideas-composer${open ? ' ideas-composer--open' : ''}`}>
        <div className="ideas-composer-header">
          <div className="ideas-detail-badges">
            <span className="ideas-project-badge" style={{ background: tint.bg, color: tint.fg }}>
              {idea.project}
            </span>
            {idea.status !== 'open' && <StatusBadge status={idea.status} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="ideas-detail-edit-btn" onClick={onEdit}>
              <svg width="12" height="12" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Edit
            </button>
            <button className="ideas-composer-close" onClick={onClose} aria-label="Close">×</button>
          </div>
        </div>

        <div className="ideas-detail-body">
          <div className="ideas-detail-meta">
            <span className="ideas-card-date">{fmtDate(idea.created_at)}</span>
          </div>
          <h2 className="ideas-detail-title">{idea.title}</h2>
          {idea.body && <p className="ideas-detail-text">{idea.body}</p>}
          {idea.bot_status && (
            <div style={{ marginBottom: 16 }}>
              <BotStatusChip idea={idea} />
              {idea.bot_status === 'needs_info' && (
                <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
                  Answer the bot's question below, then re-trigger.
                </p>
              )}
              {idea.bot_status === 'failed' && idea.bot_error && (
                <p style={{ fontSize: 13, color: '#991b1b', margin: '6px 0 0', lineHeight: 1.5 }}>
                  {idea.bot_error}
                </p>
              )}
              {idea.bot_status === 'blocked' && idea.bot_blocked_by && (() => {
                try {
                  const deps: Array<{id: string; project: string; title: string}> = JSON.parse(idea.bot_blocked_by!);
                  if (!deps.length) return null;
                  return (
                    <p style={{ fontSize: 13, color: '#1e40af', margin: '6px 0 0', lineHeight: 1.6 }}>
                      Waiting on: {deps.map(d => `[${d.project}] ${d.title}`).join(', ')}
                    </p>
                  );
                } catch { return null; }
              })()}
            </div>
          )}

          <div className="ideas-updates-divider">
            <span className="ideas-updates-label">
              Updates
              {updates.length > 0 && (
                <span className="ideas-updates-count">{updates.length}</span>
              )}
            </span>
          </div>

          <div className="ideas-updates-list">
            {loadingUpdates && (
              <p className="ideas-loading" style={{ padding: '8px 0', textAlign: 'center' }}>Loading…</p>
            )}
            {!loadingUpdates && updates.length === 0 && (
              <p className="ideas-updates-empty">No updates yet.</p>
            )}
            {updates.map(u => (
              <div key={u.id} className="ideas-update-item">
                <div className="ideas-update-header">
                  <span className="ideas-update-author">{u.author_name || u.author_email}</span>
                  <span className="ideas-update-date">{fmtDate(u.created_at)}</span>
                  <button
                    className="ideas-update-delete"
                    onClick={() => handleDeleteUpdate(u)}
                    title="Delete update"
                    aria-label="Delete update"
                  >×</button>
                </div>
                <p className="ideas-update-content">{u.content}</p>
              </div>
            ))}
          </div>

          <div className="ideas-update-compose">
            <textarea
              className="ideas-update-input"
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="Post a status update…"
              rows={3}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost();
              }}
            />
            <div className="ideas-update-compose-footer">
              <span className="ideas-update-hint">⌘↵ to post</span>
              <button
                className="ideas-submit-btn"
                onClick={handlePost}
                disabled={!newContent.trim() || posting}
              >
                {posting ? 'Posting…' : 'Post update'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── IdeaCard ──────────────────────────────────────────────────────────

interface CardProps {
  idea: Idea;
  onView: () => void;
  onDelete: () => void;
  onSetState: (s: Idea['status']) => void;
  onRunBot: (model: string) => void;
  updating: boolean;
  botRunning: boolean;
}

function IdeaCard({ idea, onView, onDelete, onSetState, onRunBot, updating, botRunning }: CardProps) {
  const [hover, setHover] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-4.1-mini');
  const isDone = idea.status === 'done';
  const isDismissed = idea.status === 'dismissed';
  const rot = cardRot(idea.id);

  return (
    <div
      className={`ideas-card${isDone ? ' ideas-card--done' : ''}${isDismissed ? ' ideas-card--dismissed' : ''}`}
      data-project={idea.project}
      style={{ transform: hover ? 'translateY(-2px)' : `rotate(${rot}deg)` }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onView}
    >
      <div className="ideas-card-tint" />

      <div className="ideas-card-head">
        {idea.project_id ? (
          <Link
            className="ideas-tag ideas-tag--link"
            to={`/ideas/projects/${idea.project_id}`}
            onClick={e => e.stopPropagation()}
          >
            <span className="ideas-tag-swatch" />
            {idea.project}
          </Link>
        ) : (
          <span className="ideas-tag">
            <span className="ideas-tag-swatch" />
            {idea.project}
          </span>
        )}
        <span className="ideas-card-date">{fmtDate(idea.created_at)}</span>
      </div>

      <div className="ideas-card-title">{idea.title}</div>
      {idea.body && <div className="ideas-card-body">{idea.body}</div>}

      <div className="ideas-card-foot">
        {idea.bot_status && <BotStatusChip idea={idea} />}
        <div style={{ flex: 1 }} />
        <StatusPill status={idea.status} />
      </div>

      <div
        className="ideas-card-actions"
        style={{ opacity: hover ? 1 : 0, transform: hover ? 'translateY(0)' : 'translateY(4px)' }}
        onClick={e => e.stopPropagation()}
      >
        {idea.status === 'open' ? (
          <>
            <button className="ideas-action-btn ideas-action-btn--done" onClick={() => onSetState('done')} disabled={updating}>
              <svg width="11" height="11" viewBox="0 0 24 24">
                <path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Done
            </button>
            <button className="ideas-action-btn ideas-action-btn--dismiss" onClick={() => onSetState('dismissed')} disabled={updating}>Dismiss</button>
          </>
        ) : (
          <button className="ideas-action-btn ideas-action-btn--reopen" onClick={() => onSetState('open')} disabled={updating}>Reopen</button>
        )}
        {idea.status === 'open' && (!idea.bot_status || idea.bot_status === 'needs_info' || idea.bot_status === 'failed' || idea.bot_status === 'blocked') && (
          <>
            <span className="ideas-model-select-wrap" onClick={e => e.stopPropagation()}>
              <select
                className="ideas-model-select"
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
              >
                <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                <option value="gpt-4.1">gpt-4.1</option>
                <option value="gpt-4o">gpt-4o</option>
              </select>
              <span aria-hidden="true">{selectedModel}</span>
            </span>
            <button className="ideas-action-btn ideas-action-btn--bot" onClick={() => onRunBot(selectedModel)} disabled={botRunning || updating} title="Assign AI bot">⚡ Bot</button>
          </>
        )}
        <div style={{ flex: 1 }} />
        <button className="ideas-action-btn ideas-action-btn--delete" onClick={onDelete} title="Delete">
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
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [projects, setProjects] = useState<Project[]>(PROJECTS.map(name => ({ id: '', name })));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<StatusFilter>('open');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [updating, setUpdating] = useState<string | null>(null);
  const [botRunning, setBotRunning] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<Idea | null>(null);
  const [detailIdea, setDetailIdea] = useState<Idea | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [projectsModalOpen, setProjectsModalOpen] = useState(false);
  const [projectRepoEdits, setProjectRepoEdits] = useState<Record<string, string>>({});
  const [projectsSaving, setProjectsSaving] = useState<string | null>(null);

  const getToken = useCallback(
    () => acquireToken(instance, accounts[0], ideasApiRequest, `${window.location.origin}/ideas`),
    [instance, accounts]
  );

  // Silent-only token fetch for background operations — never redirects
  const getTokenSilent = useCallback(async (): Promise<string | null> => {
    try {
      const response = await instance.acquireTokenSilent({ ...ideasApiRequest, account: accounts[0] });
      return response.accessToken;
    } catch {
      return null;
    }
  }, [instance, accounts]);

  const fetchProjects = useCallback(async (): Promise<string[]> => {
    if (!BASE_URL) return PROJECTS;
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return PROJECTS.map(name => ({ id: '', name }));
      const json = await resp.json();
      return json.projects as Project[];
    } catch {
      return PROJECTS.map(name => ({ id: '', name }));
    }
  }, [getToken]);

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
    if (!isAuthenticated || inProgress !== InteractionStatus.None) return;
    fetchIdeas();
    fetchProjects().then(ps => setProjects(ps));
  }, [isAuthenticated, inProgress, fetchIdeas, fetchProjects]);

  const runBot = useCallback(async (idea: Idea, model: string) => {
    if (!BASE_URL || botRunning) return;
    setBotRunning(idea.id);
    setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, bot_status: 'queued' as BotStatus } : i));
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/api/ideas/${idea.id}/run-bot`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      });
      if (!resp.ok) throw new Error(`${resp.status}`);
      const json = await resp.json();
      setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, ...json.idea } : i));
    } catch (e: any) {
      setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, bot_status: null } : i));
      setError('Failed to start bot: ' + e.message);
    } finally {
      setBotRunning(null);
    }
  }, [botRunning, getToken]);

  // Poll for bot status updates while any idea is queued or running
  useEffect(() => {
    const hasPending = ideas.some(i => i.bot_status === 'queued' || i.bot_status === 'running');
    if (!hasPending || !BASE_URL) return;

    const poll = async () => {
      try {
        const token = await getTokenSilent();
        if (!token) return;
        const resp = await fetch(`${BASE_URL}/api/ideas`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) return;
        const json = await resp.json();
        setIdeas(json.ideas ?? []);
      } catch {}
    };

    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [ideas, getTokenSilent]);

  const handleLogin = () => {
    instance.loginRedirect({ ...ideasApiRequest, redirectUri: window.location.origin + '/ideas' });
  };

  const handleCreate = async (data: { project: string; project_id: string | null; title: string; body: string; status: Idea['status'] }) => {
    if (!BASE_URL) return;
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/api/ideas`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: data.project, project_id: data.project_id, title: data.title, body: data.body }),
      });
      if (!resp.ok) throw new Error(`${resp.status}`);
      await fetchIdeas();
    } catch (e: any) {
      setError('Failed to create: ' + e.message);
    }
  };

  const handleEdit = async (idea: Idea, data: { project: string; project_id: string | null; title: string; body: string; status: Idea['status'] }) => {
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
  const openDetail = (idea: Idea) => { setDetailIdea(idea); setDetailOpen(true); };
  const editFromDetail = () => { setDetailOpen(false); setEditing(detailIdea); setComposerOpen(true); };

  const createProject = useCallback(async (name: string, repo?: string): Promise<Project> => {
    if (!BASE_URL) throw new Error('BASE_URL not configured');
    const token = await getToken();
    const resp = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, repo: repo || '' }),
    });
    if (!resp.ok) throw new Error(`${resp.status}`);
    return resp.json() as Promise<Project>;
  }, [getToken]);

  const updateProjectRepo = useCallback(async (projectId: string, repo: string): Promise<Project> => {
    if (!BASE_URL) throw new Error('BASE_URL not configured');
    const token = await getToken();
    const resp = await fetch(`${BASE_URL}/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo }),
    });
    if (!resp.ok) throw new Error(`${resp.status}`);
    return resp.json() as Promise<Project>;
  }, [getToken]);

  const handleComposerSubmit = async (
    data: { project: string; project_id: string | null; title: string; body: string; status: Idea['status'] },
    newProjectName?: string,
    newProjectRepo?: string
  ) => {
    let finalData = data;
    if (newProjectName) {
      try {
        const newProject = await createProject(newProjectName, newProjectRepo);
        setProjects(prev => [...prev, newProject]);
        finalData = { ...data, project_id: newProject.id };
      } catch (e: any) {
        setError('Failed to create project: ' + e.message);
        return;
      }
    }
    if (editing) handleEdit(editing, finalData);
    else handleCreate(finalData);
  };

  // Client-side filter + sort
  let visible = ideas;
  if (tab !== 'all') visible = visible.filter(i => i.status === tab);
  if (query) {
    const q = query.toLowerCase();
    visible = visible.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.body.toLowerCase().includes(q) ||
      i.project.toLowerCase().includes(q)
    );
  }
  visible = [...visible];
  if (sort === 'oldest') visible.sort((a, b) => a.created_at.localeCompare(b.created_at));
  else if (sort === 'project') visible.sort((a, b) => a.project.localeCompare(b.project));
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
          <div className="ideas-eyebrow">The notebook</div>
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
            <div className="ideas-eyebrow">The notebook</div>
            <h1 className="ideas-heading">Feature Ideas</h1>
            <div className="ideas-counts">
              <span><span className="ideas-count-num ideas-count-num--open">{counts.open}</span>open</span>
              <span className="ideas-count-sep">·</span>
              <span><span className="ideas-count-num ideas-count-num--done">{counts.done}</span>done</span>
              <span className="ideas-count-sep">·</span>
              <span><span className="ideas-count-num">{counts.dismissed}</span>shelved</span>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
            </svg>
            <input
              className="ideas-search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search ideas…"
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

          <button className="ideas-manage-projects-btn" onClick={() => {
            setProjectRepoEdits(Object.fromEntries(projects.map(p => [p.id, p.repo || ''])));
            setProjectsModalOpen(true);
          }}>
            Projects
          </button>

          <button className="ideas-add-btn" onClick={openNew}>
            <span className="ideas-add-btn-plus">+</span>
            New idea
          </button>
        </div>

        {error && <p className="ideas-error">{error}</p>}
        {loading && !ideas.length && <p className="ideas-loading">Loading…</p>}

        {/* Card grid */}
        <div className="ideas-grid">
          {!loading && visible.length === 0 ? (
            <EmptyState tab={tab} onAdd={openNew} />
          ) : tab === 'all' ? (
            <>
              {visible.filter(i => i.status === 'open').map(idea => (
                <IdeaCard key={idea.id} idea={idea} onView={() => openDetail(idea)} onDelete={() => handleDelete(idea)} onSetState={s => handleSetState(idea, s)} onRunBot={(model) => runBot(idea, model)} updating={updating === idea.id} botRunning={botRunning === idea.id} />
              ))}
              {visible.some(i => i.status !== 'open') && (
                <div className="ideas-group-label">Recently shipped</div>
              )}
              {visible.filter(i => i.status !== 'open').map(idea => (
                <IdeaCard key={idea.id} idea={idea} onView={() => openDetail(idea)} onDelete={() => handleDelete(idea)} onSetState={s => handleSetState(idea, s)} onRunBot={(model) => runBot(idea, model)} updating={updating === idea.id} botRunning={botRunning === idea.id} />
              ))}
            </>
          ) : (
            visible.map(idea => (
              <IdeaCard key={idea.id} idea={idea} onView={() => openDetail(idea)} onDelete={() => handleDelete(idea)} onSetState={s => handleSetState(idea, s)} onRunBot={(model) => runBot(idea, model)} updating={updating === idea.id} botRunning={botRunning === idea.id} />
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

      <IdeaDetailPanel
        open={detailOpen}
        idea={detailIdea}
        onClose={() => setDetailOpen(false)}
        onEdit={editFromDetail}
        getToken={getToken}
      />

      <Composer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSubmit={handleComposerSubmit}
        initial={editing}
        projects={projects}
      />

      {projectsModalOpen && (
        <>
          <div className="ideas-overlay ideas-overlay--open" onClick={() => setProjectsModalOpen(false)} />
          <div className="ideas-projects-modal">
            <div className="ideas-composer-header">
              <span className="ideas-composer-title">Manage projects</span>
              <button className="ideas-composer-close" onClick={() => setProjectsModalOpen(false)}>×</button>
            </div>
            <div className="ideas-projects-modal-body">
              <p className="ideas-projects-modal-hint">Set the GitHub repo each project maps to (e.g. owner/repo).</p>
              {projects.filter(p => p.id).map(p => (
                <div key={p.id} className="ideas-project-row">
                  <span className="ideas-project-row-name">{p.name}</span>
                  <input
                    className="ideas-field-input ideas-project-repos-input"
                    value={projectRepoEdits[p.id] ?? (p.repo || '')}
                    onChange={e => setProjectRepoEdits(prev => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder="e.g. skarumbu/my-website"
                  />
                  <button
                    className="ideas-project-save-btn"
                    disabled={projectsSaving === p.id}
                    onClick={async () => {
                      setProjectsSaving(p.id);
                      try {
                        const updated = await updateProjectRepo(p.id, projectRepoEdits[p.id] || '');
                        setProjects(prev => prev.map(x => x.id === p.id ? updated : x));
                      } catch (e: any) {
                        setError('Failed to save: ' + e.message);
                      } finally {
                        setProjectsSaving(null);
                      }
                    }}
                  >
                    {projectsSaving === p.id ? 'Saving…' : 'Save'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Ideas;
