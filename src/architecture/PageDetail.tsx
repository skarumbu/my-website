import React, { useEffect, useMemo, useState } from 'react';
import archPages from '../architecture-pages.json';
import { PACKAGE_TEMPLATES } from './packageTemplates.ts';
import { repoUrlByPackage } from './arch-graph-data.ts';
import { allHistory } from './historyUtils.ts';
import { Page, PackagePage, isPackagePage } from './pageTypes.ts';
import { getPage, getCachedPage, listVersions, diff as diffVersions } from './historyApi.ts';
import LinkedText from './LinkedText.tsx';
import { VersionHistoryPanel, VersionHistoryClient } from '../VersionHistoryPanel.tsx';

type GeneratedPage = Partial<Page> & Partial<Pick<PackagePage, 'dataFlow'>>;
const generated = archPages as Record<string, GeneratedPage>;

// Every page that lists another page in its own relatedPages[] implies the reverse link too —
// authors only need to declare a relationship in one direction.
const reverseRelated: Record<string, Set<string>> = {};
for (const [key, p] of Object.entries(generated)) {
  for (const other of p.relatedPages ?? []) {
    (reverseRelated[other] ??= new Set()).add(key);
  }
}

// Pre-migration, build-time template merge. No longer called by the render
// path below (which fetches the already-merged effective page from
// history-api at runtime) — kept only as the input to
// scripts/gen-arch-fixtures.mjs, which pins the Python reimplementation
// (arch_effective_page.py) against this function's output byte-for-byte. Do
// not delete without also retiring that fixture check.
export function resolvePage(pageKey: string): Page | PackagePage | null {
  const template = PACKAGE_TEMPLATES[pageKey];
  const gen = generated[pageKey];
  if (!template && !gen) return null;

  const forwardRelated = gen?.relatedPages ?? [];
  const reverseSet = reverseRelated[pageKey] ?? new Set<string>();
  const relatedPages = Array.from(new Set([...forwardRelated, ...reverseSet])).filter(k => k !== pageKey);

  const base: Page = {
    key: pageKey,
    title: gen?.title ?? template?.title ?? pageKey,
    role: gen?.role ?? template?.role,
    summary: gen?.summary,
    description: gen?.description ?? template?.description ?? '',
    features: gen?.features ?? template?.features,
    architecture: gen?.architecture
      ? { ...template?.architecture, ...gen.architecture }
      : template?.architecture,
    sections: gen?.sections,
    relatedPages,
    updatedAt: gen?.updatedAt,
    updatedBySha: gen?.updatedBySha,
    updatedByPackage: gen?.updatedByPackage,
  };

  if (!template) return base;

  return {
    ...base,
    runsOn: template.runsOn,
    repoUrl: repoUrlByPackage[pageKey] ?? '',
    techStack: template.techStack,
    pipeline: template.pipeline,
    dataFlow: gen?.dataFlow !== undefined ? (gen.dataFlow ?? template.dataFlow) : template.dataFlow,
  } as PackagePage;
}

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
  // Pre-migration commit-metadata entries — kept as a no-diff group below the
  // real history-api versions. See the "Legacy history" section further down.
  const legacyHistory = allHistory.filter(e => e.key === pageKey);

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

        {/* ── Version History (real, from history-api) ── */}
        <section className="arch-section">
          <div className="arch-version-history">
            <VersionHistoryPanel client={versionClient} showAuthor={false} />
          </div>
        </section>

        {/* ── Legacy history (pre-migration commit metadata — no diff available) ── */}
        {legacyHistory.length > 0 && (
          <section className="arch-section">
            <details className="arch-history">
              <summary className="arch-history-summary">
                Earlier history (no diff available) <span className="arch-history-count">({legacyHistory.length})</span>
              </summary>
              <ul className="arch-history-list">
                {legacyHistory.map((e, i) => {
                  // A package's own repoUrl always wins; a plain page (no repo of its own) falls
                  // back to whichever package's PR triggered this update.
                  const repoUrl = pkg?.repoUrl || (e.triggeringPackage ? repoUrlByPackage[e.triggeringPackage] : undefined);
                  return (
                    <li key={i} className="arch-history-entry">
                      <span className="arch-history-date">{e.capturedAt}</span>
                      {repoUrl ? (
                        <a
                          className="arch-history-sha"
                          href={`${repoUrl}/commit/${e.commitSha}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <code>{e.commitSha}</code>
                        </a>
                      ) : (
                        <code className="arch-history-sha">{e.commitSha}</code>
                      )}
                      <span className="arch-history-msg">{e.commitMessage.split('\n')[0]}</span>
                    </li>
                  );
                })}
              </ul>
            </details>
          </section>
        )}

      </div>
    </div>
  );
};

export default PageDetail;
