import React, { useState, useEffect, useCallback } from 'react';
import NavBar from './components/nav-bar.tsx';
import './styling/ideas.css';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { ideasApiRequest } from './authConfig.js';

const BASE_URL = process.env.REACT_APP_IDEAS_API_BASE_URL;

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

function Ideas() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [loginLoading, setLoginLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const getToken = useCallback(async (): Promise<string> => {
    const response = await instance
      .acquireTokenSilent({ ...ideasApiRequest, account: accounts[0] })
      .catch(() => instance.acquireTokenPopup(ideasApiRequest));
    return response.accessToken;
  }, [instance, accounts]);

  const fetchIdeas = useCallback(async () => {
    if (!BASE_URL) {
      setError('REACT_APP_IDEAS_API_BASE_URL is not configured');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const url = statusFilter === 'all'
        ? `${BASE_URL}/api/ideas`
        : `${BASE_URL}/api/ideas?status=${statusFilter}`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
      const json = await resp.json();
      setIdeas(json.ideas ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [getToken, statusFilter]);

  useEffect(() => {
    if (isAuthenticated) fetchIdeas();
  }, [isAuthenticated, fetchIdeas]);

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      await instance.loginPopup(ideasApiRequest);
    } catch (e: any) {
      if (e.errorCode !== 'user_cancelled') {
        setError('Sign-in failed: ' + e.message);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleStatusChange = async (idea: Idea, newStatus: Idea['status']) => {
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

  if (!isAuthenticated) {
    return (
      <div className="main ideas-page">
        <header className="Main-text"><NavBar /></header>
        <div className="ideas-content ideas-centered">
          <h1 className="ideas-title">Feature Ideas</h1>
          <p className="ideas-subtitle">Sign in to view and manage the feature backlog</p>
          <button className="ideas-login-btn" onClick={handleLogin} disabled={loginLoading}>
            {loginLoading ? 'Signing in…' : 'Sign in with Microsoft'}
          </button>
          {error && <p className="ideas-error">{error}</p>}
        </div>
      </div>
    );
  }

  const visibleIdeas = statusFilter === 'all'
    ? ideas
    : ideas.filter(i => i.status === statusFilter);

  return (
    <div className="main ideas-page">
      <header className="Main-text"><NavBar /></header>
      <div className="ideas-content">
        <div className="ideas-header">
          <div>
            <h1 className="ideas-title">Feature Ideas</h1>
            <p className="ideas-subtitle">{ideas.length} idea{ideas.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="ideas-actions">
            <div className="ideas-filter-group">
              {(['open', 'done', 'dismissed', 'all'] as StatusFilter[]).map(s => (
                <button
                  key={s}
                  className={`ideas-filter-btn${statusFilter === s ? ' ideas-filter-btn--active' : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <button className="ideas-refresh-btn" onClick={fetchIdeas} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && <p className="ideas-error">{error}</p>}
        {loading && <p className="ideas-note">Loading…</p>}
        {!loading && visibleIdeas.length === 0 && !error && (
          <p className="ideas-note">No {statusFilter !== 'all' ? statusFilter : ''} ideas.</p>
        )}

        <ul className="ideas-list">
          {visibleIdeas.map(idea => (
            <li key={idea.id} className="ideas-card">
              <div className="ideas-card-header">
                <span className="ideas-card-title">{idea.title}</span>
                <span className={`ideas-state-pill ideas-state-pill--${idea.status}`}>
                  {idea.status}
                </span>
              </div>
              <div className="ideas-card-meta">
                <span className="ideas-card-date">
                  {new Date(idea.created_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric',
                  })}
                </span>
                <span className={`ideas-source-badge ideas-source-badge--${idea.source}`}>
                  {idea.source}
                </span>
              </div>
              {idea.body && (
                <p className="ideas-card-body">
                  {idea.body.length > 300 ? idea.body.slice(0, 300) + '…' : idea.body}
                </p>
              )}
              <div className="ideas-action-row">
                {idea.status !== 'done' && (
                  <button
                    className="ideas-action-btn ideas-action-btn--done"
                    onClick={() => handleStatusChange(idea, 'done')}
                    disabled={updating === idea.id}
                  >
                    Mark done
                  </button>
                )}
                {idea.status !== 'open' && (
                  <button
                    className="ideas-action-btn ideas-action-btn--reopen"
                    onClick={() => handleStatusChange(idea, 'open')}
                    disabled={updating === idea.id}
                  >
                    Reopen
                  </button>
                )}
                {idea.status !== 'dismissed' && (
                  <button
                    className="ideas-action-btn ideas-action-btn--dismiss"
                    onClick={() => handleStatusChange(idea, 'dismissed')}
                    disabled={updating === idea.id}
                  >
                    Dismiss
                  </button>
                )}
                <button
                  className="ideas-action-btn ideas-action-btn--delete"
                  onClick={() => handleDelete(idea)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Ideas;
