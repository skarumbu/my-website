import React, { useEffect, useMemo, useState } from 'react';
import { Page, PackagePage, isPackagePage } from './pageTypes.ts';
import { getPage, getCachedPage, listVersions, diff as diffVersions } from './historyApi.ts';
import LinkedText from './LinkedText.tsx';
import { VersionHistoryPanel, VersionHistoryClient } from '../VersionHistoryPanel.tsx';

interface Props {
  pageKey: string;
  onBack: () => void;
  onSelectPage: (key: string) => void;
}

// A chip whose label resolves lazily via the shared getPage() cache — most of
// the time this is instant (the index view already warmed the cache for
// every page), but a page reached via a direct ?page= link with no prior
// index visit falls back to the raw key while its title loads.
const RelatedPageChip: React.FC<{ pageKey: string; onSelectPage: (key: string) => void }> = ({ pageKey, onSelectPage }) => {
  const [title, setTitle] = useState<string>(() => getCachedPage(pageKey)?.title ?? pageKey);

  useEffect(() => {
    if (getCachedPage(pageKey)) return;
    let cancelled = false;
    getPage(pageKey)
      .then(p => { if (!cancelled) setTitle(p.title); })
      .catch(() => { /* keep the raw key as the label */ });
    return () => { cancelled = true; };
  }, [pageKey]);

  return (
    <button className="arch-related-chip" onClick={() => onSelectPage(pageKey)}>{title}</button>
  );
};

const PageDetail: React.FC<Props> = ({ pageKey, onBack, onSelectPage }) => {
  const [page, setPage] = useState<Page | PackagePage | null | undefined>(() => getCachedPage(pageKey));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = getCachedPage(pageKey);
    if (cached) {
      setPage(cached);
      setError(null);
      return;
    }
    let cancelled = false;
    setPage(undefined);
    setError(null);
    getPage(pageKey)
      .then(p => { if (!cancelled) setPage(p); })
      .catch(e => { if (!cancelled) { setError(e.message); setPage(null); } });
    return () => { cancelled = true; };
  }, [pageKey]);

  const versionClient = useMemo<VersionHistoryClient>(() => ({
    listVersions: () => listVersions(pageKey),
    diff: (v1, v2) => diffVersions(pageKey, v1, v2),
  }), [pageKey]);

  if (page === undefined) {
    return (
      <div>
        <button className="arch-pkg-back" onClick={onBack}>← Architecture</button>
        <div className="arch-loader">Loading…</div>
      </div>
    );
  }

  if (!page) {
    // Reached only via the catch below (which always sets `error`) — a page
    // key with no history-api document behaves the same as any other fetch
    // failure now (get_document.go has no distinct "not found" response for
    // an anonymous caller; see historyApi.ts), so there's no separate
    // "not found" state to render here.
    return (
      <div style={{ padding: '2rem', color: '#8b949e' }}>
        <button className="arch-pkg-back" onClick={onBack}>← Back to Architecture</button>
        <div className="arch-error-banner">Failed to load this page{error ? `: ${error}` : ` (${pageKey})`}</div>
      </div>
    );
  }

  const pkg = isPackagePage(page) ? page : null;

  return (
    <div>
      <button className="arch-pkg-back" onClick={onBack}>← Architecture</button>

      {/* ── Header ── */}
      <div className="arch-pkg-header">
        <div className="arch-pkg-header-top">
          <code className="arch-pkg-name">{page.title}</code>
          {pkg && <span className="arch-pkg-runs-on">{pkg.runsOn}</span>}
          {page.updatedAt && (
            <span className="arch-pkg-ai-badge" title={`Updated from commit ${page.updatedBySha}`}>
              ✦ docs updated {page.updatedAt}
            </span>
          )}
        </div>
        {page.role && <p className="arch-pkg-role">{page.role}</p>}
        <p className="arch-pkg-desc"><LinkedText text={page.description} onSelectTopic={onSelectPage} /></p>
        {pkg && (
          <div className="arch-tech-stack" style={{ marginTop: '1rem' }}>
            {pkg.techStack.map(t => <span key={t} className="arch-tech-item">{t}</span>)}
          </div>
        )}
      </div>

      <div className="arch-pkg-body">

        {/* ── Features ── */}
        {page.features && page.features.length > 0 && (
          <section className="arch-section">
            <h2>Features</h2>
            <ul className="arch-pkg-features">
              {page.features.map((f, i) => (
                <li key={i}><LinkedText text={f} onSelectTopic={onSelectPage} /></li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Architecture ── */}
        {page.architecture && (
          <section className="arch-section">
            <h2>Architecture</h2>
            <p><LinkedText text={page.architecture.overview} onSelectTopic={onSelectPage} /></p>
            <h3>Key design points</h3>
            <ul className="arch-pkg-keypoints">
              {page.architecture.keyPoints.map((k, i) => (
                <li key={i}><LinkedText text={k} onSelectTopic={onSelectPage} /></li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Related Pages ── */}
        {page.relatedPages && page.relatedPages.length > 0 && (
          <section className="arch-section">
            <h2>Related Pages</h2>
            <div className="arch-related-chips">
              {page.relatedPages.map(key => (
                <RelatedPageChip key={key} pageKey={key} onSelectPage={onSelectPage} />
              ))}
            </div>
          </section>
        )}

        {/* ── Freeform sections (topics, or extra package content beyond the template) ── */}
        {page.sections && page.sections.length > 0 && (
          <section className="arch-section">
            {page.sections.map((s, i) => (
              <React.Fragment key={i}>
                <h3>{s.heading}</h3>
                <p><LinkedText text={s.content} onSelectTopic={onSelectPage} /></p>
              </React.Fragment>
            ))}
          </section>
        )}

        {/* ── Data Flow ── */}
        {pkg?.dataFlow && (
          <section className="arch-section">
            <h2>Data Flow</h2>
            <div className="arch-flow">
              {pkg.dataFlow.map((step, i) => (
                <React.Fragment key={i}>
                  <div className={`arch-flow-box${step.color ? ` ${step.color}` : ''}`}>
                    {step.label}
                    {step.sublines?.map((s, j) => <small key={j}>{s}</small>)}
                  </div>
                  {i < pkg.dataFlow!.length - 1 && <div className="arch-flow-down">↓</div>}
                </React.Fragment>
              ))}
            </div>
          </section>
        )}

        {/* ── CI/CD ── */}
        {pkg && (
          <section className="arch-section">
            <h2>CI / CD</h2>
            <div className="arch-pipeline">
              {pkg.pipeline.map((step, i) => (
                <React.Fragment key={i}>
                  <div className={`arch-pipeline-box${step.color ? ` ${step.color}` : ''}`}>
                    {step.label}
                  </div>
                  {i < pkg.pipeline.length - 1 && (
                    <span className="arch-pipeline-arrow">→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </section>
        )}

        {/* ── Version History (from history-api) ── */}
        <section className="arch-section">
          <div className="arch-version-history">
            <VersionHistoryPanel client={versionClient} showAuthor={false} />
          </div>
        </section>

      </div>
    </div>
  );
};

export default PageDetail;
