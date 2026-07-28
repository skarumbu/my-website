import React from 'react';
import archPages from '../architecture-pages.json';
import { PACKAGE_TEMPLATES } from './packageTemplates.ts';
import { repoUrlByPackage } from './arch-graph-data.ts';
import { allHistory } from './historyUtils.ts';
import { Page, PackagePage, isPackagePage } from './pageTypes.ts';
import LinkedText from './LinkedText.tsx';

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

// A page is a PackagePage precisely when a static template exists for it — that template is the
// one thing that makes it "a deployable service" rather than a plain concept page.
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

const PageDetail: React.FC<Props> = ({ pageKey, onBack, onSelectPage }) => {
  const page = resolvePage(pageKey);

  if (!page) {
    return (
      <div style={{ padding: '2rem', color: '#8b949e' }}>
        <button className="arch-pkg-back" onClick={onBack}>← Back to Architecture</button>
        <p style={{ marginTop: '1rem' }}>Page not found: {pageKey}</p>
      </div>
    );
  }

  const pkg = isPackagePage(page) ? page : null;
  const pageHistory = allHistory.filter(e => e.key === pageKey);

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
                <button key={key} className="arch-related-chip" onClick={() => onSelectPage(key)}>
                  {resolvePage(key)?.title ?? key}
                </button>
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

        {/* ── Change History ── */}
        {pageHistory.length > 0 && (
          <section className="arch-section">
            <details className="arch-history">
              <summary className="arch-history-summary">
                Change history <span className="arch-history-count">({pageHistory.length})</span>
              </summary>
              <ul className="arch-history-list">
                {pageHistory.map((e, i) => {
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
