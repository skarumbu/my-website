import React, { useEffect, useRef, useState } from 'react';
import { DailyLinkConfig } from '../lib/dailyLinksTypes.ts';
import { markLinkOpened, setLinksConfig } from '../lib/dailyLinksApi.ts';
import { DraftRow, RowErrors, emptyRow, toDraftRows, validateRows } from '../lib/dailyLinksDraft.ts';
import { fetchFeaturedArticle, FeaturedArticle } from '../lib/featuredArticle.ts';

type LinkView = { config: DailyLinkConfig; openedToday: boolean };

interface Props {
  token: string;
  dateIso: string;
  links: LinkView[];
  onOpened: (linkId: string) => void;
  onLinksChange: (links: LinkView[]) => void;
  onUnauthorized: () => void;
}

type EditorState =
  | { kind: 'viewing' }
  | {
      kind: 'editing';
      rows: DraftRow[];
      status: 'idle' | 'saving' | 'error';
      // Keyed by row id; only filled by a Save attempt.
      errors: Record<string, RowErrors>;
    };

function readTodayKey(dateIso: string): string {
  return `wiki-featured-read-${dateIso}`;
}

export default function DailyLinksPanel({ token, dateIso, links, onOpened, onLinksChange, onUnauthorized }: Props) {
  const [article, setArticle] = useState<FeaturedArticle | null>(null);
  const [articleError, setArticleError] = useState<string | null>(null);
  const [articleRead, setArticleRead] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ kind: 'viewing' });
  const [focusRowId, setFocusRowId] = useState<string | null>(null);
  const labelInputs = useRef(new Map<string, HTMLInputElement>());
  const toggleRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  useEffect(() => {
    // Purely client-side, no auth/backend round trip — Wikipedia's own feed
    // already returns the same article all day for a given UTC date, and a
    // new one tomorrow, with no caching logic needed on our end beyond what
    // featuredArticle.ts already does in sessionStorage.
    try {
      setArticleRead(localStorage.getItem(readTodayKey(dateIso)) === 'true');
    } catch {
      // localStorage unavailable — just starts unread every load, harmless
    }
    fetchFeaturedArticle()
      .then(setArticle)
      .catch(e => setArticleError(e.message));
  }, [dateIso]);

  // Runs after the row's input has mounted, so a new row can be focused.
  useEffect(() => {
    if (!focusRowId) return;
    labelInputs.current.get(focusRowId)?.focus();
    setFocusRowId(null);
  }, [focusRowId]);

  // Leaving the editor unmounts whatever had focus, so hand it back to the
  // button that opened it.
  useEffect(() => {
    if (wasEditing.current && editor.kind === 'viewing') toggleRef.current?.focus();
    wasEditing.current = editor.kind === 'editing';
  }, [editor.kind]);

  const handleReadArticle = () => {
    if (!article) return;
    window.open(article.url, '_blank', 'noopener,noreferrer');
    setArticleRead(true);
    try {
      localStorage.setItem(readTodayKey(dateIso), 'true');
    } catch {
      // not persisted across reloads, but the open already happened
    }
  };

  const handleOpen = (link: DailyLinkConfig) => {
    // Fire-and-forget: the tab opens immediately, marking it opened is a
    // background best-effort write that shouldn't block navigation.
    window.open(link.url, '_blank', 'noopener,noreferrer');
    onOpened(link.id);
    markLinkOpened(token, link.id, dateIso).catch(() => {
      // Best-effort — a failed mark doesn't block the link from opening,
      // and will just show as "not opened" again next load.
    });
  };

  const startEditing = () => {
    if (links.length) {
      setEditor({ kind: 'editing', rows: toDraftRows(links.map(l => l.config)), status: 'idle', errors: {} });
    } else {
      const row = emptyRow();
      setEditor({ kind: 'editing', rows: [row], status: 'idle', errors: {} });
      setFocusRowId(row.id);
    }
  };

  const updateRows = (rows: DraftRow[], errors?: Record<string, RowErrors>) => {
    setEditor(e => (e.kind === 'editing' ? { ...e, rows, errors: errors ?? e.errors } : e));
  };

  const addRow = () => {
    if (editor.kind !== 'editing') return;
    const row = emptyRow();
    updateRows([...editor.rows, row]);
    setFocusRowId(row.id);
  };

  const handleSave = async () => {
    if (editor.kind !== 'editing' || editor.status === 'saving') return;
    const result = validateRows(editor.rows);
    if (!result.ok) {
      setEditor({ ...editor, status: 'idle', errors: result.errors });
      return;
    }
    setEditor({ ...editor, status: 'saving', errors: {} });
    try {
      const saved = await setLinksConfig(token, result.links);
      // Opened flags are keyed by link id, so an edited link that kept its
      // id stays ticked for today.
      const opened = new Set(links.filter(l => l.openedToday).map(l => l.config.id));
      onLinksChange(saved.links.map(config => ({ config, openedToday: opened.has(config.id) })));
      setEditor({ kind: 'viewing' });
    } catch (e: any) {
      if (e.message === 'unauthorized') return onUnauthorized();
      setEditor(s => (s.kind === 'editing' ? { ...s, status: 'error' } : s));
    }
  };

  return (
    <section className="daily-panel links-panel">
      <div className="links-head-row">
        <h2 className="daily-panel-title">Daily Links</h2>
        {editor.kind === 'viewing' && links.length > 0 && (
          <button type="button" ref={toggleRef} className="links-edit-toggle" onClick={startEditing}>Edit</button>
        )}
      </div>

      {articleError && <p className="daily-panel-error">Couldn't load today's article: {articleError}</p>}
      {article && (
        <button
          type="button"
          className={`wiki-featured-card${articleRead ? ' wiki-featured-read' : ''}`}
          onClick={handleReadArticle}
        >
          <span className="wiki-featured-label">Today's Featured Article{articleRead && ' ✓'}</span>
          <span className="wiki-featured-title">{article.title}</span>
          <span className="wiki-featured-extract">{article.extract}</span>
        </button>
      )}

      {editor.kind === 'editing' ? (
        <LinksEditor
          rows={editor.rows}
          errors={editor.errors}
          status={editor.status}
          labelInputs={labelInputs.current}
          onRowsChange={updateRows}
          onAdd={addRow}
          onSave={handleSave}
          onCancel={() => setEditor({ kind: 'viewing' })}
        />
      ) : links.length === 0 ? (
        <div className="links-empty-state">
          <p className="links-empty">Add the sites you check every day.</p>
          <button type="button" ref={toggleRef} className="links-add-first" onClick={startEditing}>+ Add links</button>
        </div>
      ) : (
        <ul className="links-items">
          {links.map(({ config, openedToday }) => (
            <li key={config.id} className="links-item">
              <button
                type="button"
                className={openedToday ? 'links-item-opened' : ''}
                onClick={() => handleOpen(config)}
              >
                {config.label}
                {openedToday && <span className="links-item-check" aria-hidden="true">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface EditorProps {
  rows: DraftRow[];
  errors: Record<string, RowErrors>;
  status: 'idle' | 'saving' | 'error';
  labelInputs: Map<string, HTMLInputElement>;
  onRowsChange: (rows: DraftRow[], errors?: Record<string, RowErrors>) => void;
  onAdd: () => void;
  onSave: () => void;
  onCancel: () => void;
}

function LinksEditor({ rows, errors, status, labelInputs, onRowsChange, onAdd, onSave, onCancel }: EditorProps) {
  const edit = (index: number, field: 'label' | 'url', value: string) => {
    const row = rows[index];
    const next = rows.map((r, i) => (i === index ? { ...r, [field]: value } : r));
    // Typing into a field clears its error; the others wait for the next Save.
    const rowErrors = errors[row.id];
    if (rowErrors?.[field]) onRowsChange(next, { ...errors, [row.id]: { ...rowErrors, [field]: undefined } });
    else onRowsChange(next);
  };

  const move = (index: number, delta: number) => {
    const next = [...rows];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onRowsChange(next);
  };

  return (
    <div
      className="links-editor"
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <ol className="links-edit-rows">
        {rows.map((row, i) => {
          const name = row.label.trim() || `link ${i + 1}`;
          const rowErrors = errors[row.id] ?? {};
          const labelErrId = `links-edit-${row.id}-label-err`;
          const urlErrId = `links-edit-${row.id}-url-err`;
          return (
            <li key={row.id} className="links-edit-row">
              <input
                type="text"
                className="links-edit-label"
                ref={el => {
                  if (el) labelInputs.set(row.id, el);
                  else labelInputs.delete(row.id);
                }}
                aria-label={`Label for ${name}`}
                aria-invalid={!!rowErrors.label}
                aria-describedby={rowErrors.label ? labelErrId : undefined}
                placeholder="Label"
                value={row.label}
                onChange={e => edit(i, 'label', e.target.value)}
              />
              <button
                type="button"
                className="links-edit-icon links-edit-up"
                aria-label={`Move ${name} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="links-edit-icon links-edit-down"
                aria-label={`Move ${name} down`}
                disabled={i === rows.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="links-edit-icon links-edit-remove"
                aria-label={`Remove ${name}`}
                onClick={() => onRowsChange(rows.filter((_, j) => j !== i))}
              >
                ×
              </button>
              {rowErrors.label && (
                <span id={labelErrId} className="links-edit-error links-edit-label-error">{rowErrors.label}</span>
              )}
              <input
                type="text"
                className="links-edit-url"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label={`URL for ${name}`}
                aria-invalid={!!rowErrors.url}
                aria-describedby={rowErrors.url ? urlErrId : undefined}
                placeholder="example.com"
                value={row.url}
                onChange={e => edit(i, 'url', e.target.value)}
              />
              {rowErrors.url && (
                <span id={urlErrId} className="links-edit-error links-edit-url-error">{rowErrors.url}</span>
              )}
            </li>
          );
        })}
      </ol>
      <button type="button" className="links-edit-add" onClick={onAdd}>+ Add link</button>
      {status === 'error' && <p className="daily-panel-error links-edit-save-error">Could not save links. Try again.</p>}
      <div className="links-edit-actions">
        <button type="button" className="links-edit-cancel" onClick={onCancel}>Cancel</button>
        <button type="button" className="links-edit-save" disabled={status === 'saving'} onClick={onSave}>
          {status === 'saving' ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
