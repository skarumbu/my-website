import React, { useState, useEffect, useCallback } from 'react';
import MicrosoftLogo from './components/MicrosoftLogo.tsx';
import { useParams, Link } from 'react-router-dom';
import NavBar from './components/nav-bar.tsx';
import './styling/ideas.css';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { ideasApiRequest } from './authConfig.js';
import { acquireToken } from './auth.ts';

const BASE_URL = process.env.REACT_APP_IDEAS_API_BASE_URL;

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

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const BOT_MAP: Record<BotStatus, { fg: string; bg: string; label: string }> = {
  queued:     { fg: '#92400e', bg: 'rgba(251,191,36,0.18)',  label: 'Queued' },
  running:    { fg: '#1e40af', bg: 'rgba(59,130,246,0.15)',  label: 'Running…' },
  completed:  { fg: '#065f46', bg: 'rgba(16,185,129,0.15)',  label: 'Done' },
  failed:     { fg: '#991b1b', bg: 'rgba(239,68,68,0.15)',   label: 'Failed' },
  needs_info: { fg: '#6d28d9', bg: 'rgba(139,92,246,0.15)',  label: 'Needs info' },
  blocked:    { fg: '#1e40af', bg: 'rgba(59,130,246,0.12)',  label: 'Blocked' },
};

function BotChip({ idea }: { idea: Idea }) {
  const s = idea.bot_status ? BOT_MAP[idea.bot_status] : null;
  if (!s) return null;
  return (
    <span className="ideas-bot-chip" style={{ color: s.fg, background: s.bg }}>
      {idea.bot_status === 'running' && <span className="ideas-bot-spinner" />}
      {idea.bot_status === 'completed' && idea.bot_pr_url ? (
        <a className="ideas-bot-pr-link" href={idea.bot_pr_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
          {s.label} · View PR
        </a>
      ) : s.label}
    </span>
  );
}

// ── Idea detail panel ─────────────────────────────────────────────────────────

interface DetailPanelProps {
  open: boolean;
  idea: Idea | null;
  onClose: () => void;
  getToken: () => Promise<string>;
}

function DetailPanel({ open, idea, onClose, getToken }: DetailPanelProps) {
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
        if (resp.ok) setUpdates((await resp.json()).updates ?? []);
      } catch {} finally { setLoadingUpdates(false); }
    })();
  }, [open, idea, getToken]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
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
    } catch {} finally { setPosting(false); }
  };

  if (!idea) return null;

  return (
    <>
      <div className={`ideas-overlay${open ? ' ideas-overlay--open' : ''}`} onClick={onClose} />
      <div className={`ideas-composer${open ? ' ideas-composer--open' : ''}`}>
        <div className="ideas-composer-header">
          <div className="ideas-detail-badges">
            <span className="ideas-project-badge" style={{ background: 'var(--c-lilac)', color: 'var(--c-lilac-ink)' }}>
              {idea.project}
            </span>
          </div>
          <button className="ideas-composer-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="ideas-detail-body">
          <div className="ideas-detail-meta">
            <span className="ideas-card-date">{fmtDate(idea.created_at)}</span>
          </div>
          <h2 className="ideas-detail-title">{idea.title}</h2>
          {idea.body && <p className="ideas-detail-text">{idea.body}</p>}
          {idea.bot_status && (
            <div style={{ marginBottom: 16 }}>
              <BotChip idea={idea} />
              {idea.bot_status === 'failed' && idea.bot_error && (
                <p style={{ fontSize: 13, color: '#991b1b', margin: '6px 0 0', lineHeight: 1.5 }}>
                  {idea.bot_error}
                </p>
              )}
              {idea.bot_status === 'blocked' && idea.bot_blocked_by && (() => {
                try {
                  const deps: Array<{ id: string; project: string; title: string }> = JSON.parse(idea.bot_blocked_by!);
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
              {updates.length > 0 && <span className="ideas-updates-count">{updates.length}</span>}
            </span>
          </div>

          <div className="ideas-updates-list">
            {loadingUpdates && <p className="ideas-loading" style={{ padding: '8px 0', textAlign: 'center' }}>Loading…</p>}
            {!loadingUpdates && updates.length === 0 && <p className="ideas-updates-empty">No updates yet.</p>}
            {updates.map(u => (
              <div key={u.id} className="ideas-update-item">
                <div className="ideas-update-header">
                  <span className="ideas-update-author">{u.author_name || u.author_email}</span>
                  <span className="ideas-update-date">{fmtDate(u.created_at)}</span>
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
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost(); }}
            />
            <div className="ideas-update-compose-footer">
              <span className="ideas-update-hint">⌘↵ to post</span>
              <button className="ideas-submit-btn" onClick={handlePost} disabled={!newContent.trim() || posting}>
                {posting ? 'Posting…' : 'Post update'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── ProjectPage ───────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const [project, setProject] = useState<Project | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailIdea, setDetailIdea] = useState<Idea | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const redirectUri = `${window.location.origin}/ideas/projects/${projectId}`;

  const getToken = useCallback(
    () => acquireToken(instance, accounts[0], ideasApiRequest, redirectUri),
    [instance, accounts, redirectUri]
  );

  useEffect(() => {
    if (!isAuthenticated || inProgress !== InteractionStatus.None) return;
    if (!BASE_URL) { setError('REACT_APP_IDEAS_API_BASE_URL is not configured'); setLoading(false); return; }
    (async () => {
      try {
        const token = await getToken();
        const headers = { Authorization: `Bearer ${token}` };
        const [projResp, ideasResp] = await Promise.all([
          fetch(`${BASE_URL}/api/projects`, { headers }),
          fetch(`${BASE_URL}/api/ideas`, { headers }),
        ]);
        if (!projResp.ok) throw new Error(`projects ${projResp.status}`);
        if (!ideasResp.ok) throw new Error(`ideas ${ideasResp.status}`);

        const allProjects: Project[] = (await projResp.json()).projects ?? [];
        const allIdeas: Idea[] = (await ideasResp.json()).ideas ?? [];

        const found = allProjects.find(p => p.id === projectId) ?? null;
        setProject(found);

        const filtered = allIdeas
          .filter(i => (i.project_id ? i.project_id === projectId : i.project === found?.name))
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        setIdeas(filtered);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, inProgress, getToken, projectId]);

  const openDetail = (idea: Idea) => { setDetailIdea(idea); setDetailOpen(true); };

  if (!isAuthenticated) {
    return (
      <div className="ideas-page">
        <NavBar />
        <div className="ideas-login-view">
          <div className="ideas-eyebrow">The notebook</div>
          <h1 className="ideas-heading">Project</h1>
          <p className="ideas-login-sub">Sign in to view this project</p>
          <button
            className="ideas-login-btn"
            onClick={() => instance.loginRedirect({ ...ideasApiRequest, redirectUri })}
          >
            <MicrosoftLogo />
            Sign in with Microsoft
          </button>
        </div>
      </div>
    );
  }

  const open = ideas.filter(i => i.status === 'open');
  const done = ideas.filter(i => i.status === 'done');
  const dismissed = ideas.filter(i => i.status === 'dismissed');

  return (
    <div className="ideas-page">
      <NavBar />
      <div className="ideas-content">

        <div className="proj-page-back">
          <Link to="/ideas" className="proj-page-back-link">← Ideas board</Link>
        </div>

        {loading && <p className="ideas-loading">Loading…</p>}
        {error && <p className="ideas-error">{error}</p>}

        {!loading && !project && !error && (
          <p className="ideas-updates-empty" style={{ marginTop: 40 }}>Project not found.</p>
        )}

        {!loading && project && (
          <>
            <div className="proj-page-header">
              <div>
                <div className="ideas-eyebrow">Project</div>
                <h1 className="ideas-heading">{project.name}</h1>
                {project.repo && (
                  <a
                    className="proj-page-repo"
                    href={`https://github.com/${project.repo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    {project.repo}
                  </a>
                )}
              </div>
              <div className="proj-page-stats">
                <div className="proj-page-stat">
                  <span className="proj-page-stat-num" style={{ color: 'var(--accent)' }}>{open.length}</span>
                  <span className="proj-page-stat-lbl">open</span>
                </div>
                <div className="proj-page-stat">
                  <span className="proj-page-stat-num" style={{ color: 'var(--good)' }}>{done.length}</span>
                  <span className="proj-page-stat-lbl">done</span>
                </div>
                <div className="proj-page-stat">
                  <span className="proj-page-stat-num">{dismissed.length}</span>
                  <span className="proj-page-stat-lbl">shelved</span>
                </div>
              </div>
            </div>

            {ideas.length === 0 ? (
              <p className="ideas-updates-empty" style={{ marginTop: 40 }}>No ideas in this project yet.</p>
            ) : (
              <div className="proj-idea-list">
                {ideas.map(idea => (
                  <div key={idea.id} className="proj-idea-row" onClick={() => openDetail(idea)}>
                    <span className={`proj-idea-dot proj-idea-dot--${idea.status}`} />
                    <span className="proj-idea-title">{idea.title}</span>
                    {(idea.source || '').startsWith('bot:subtask:') && (
                      <span className="proj-idea-tag">subtask</span>
                    )}
                    {(idea.source || '').startsWith('bot:cross-repo:') && (
                      <span className="proj-idea-tag proj-idea-tag--cross">dependency</span>
                    )}
                    <BotChip idea={idea} />
                    <span className="proj-idea-date">{fmtDate(idea.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <DetailPanel
        open={detailOpen}
        idea={detailIdea}
        onClose={() => setDetailOpen(false)}
        getToken={getToken}
      />
    </div>
  );
}
