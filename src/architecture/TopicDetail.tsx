import React from 'react';
import archTopics from '../architecture-topics.json';
import { repoUrlByPackage } from './arch-graph-data.ts';
import { allHistory } from './historyUtils.ts';
import LinkedText from './LinkedText.tsx';

type TopicSection = { heading: string; content: string };
type TopicContent = {
  title: string;
  summary: string;
  body: { overview: string; sections: TopicSection[] };
  relatedPackages?: string[];
  relatedTopics?: string[];
  updatedAt?: string;
  updatedBySha?: string;
  updatedByPackage?: string;
};

const topics = archTopics as Record<string, TopicContent>;

interface Props {
  topicSlug: string;
  onBack: () => void;
  onSelectPackage: (key: string) => void;
  onSelectTopic: (slug: string) => void;
}

const TopicDetail: React.FC<Props> = ({ topicSlug, onBack, onSelectPackage, onSelectTopic }) => {
  const topic = topics[topicSlug];

  if (!topic) {
    return (
      <div style={{ padding: '2rem', color: '#8b949e' }}>
        <button className="arch-pkg-back" onClick={onBack}>← Back to Architecture</button>
        <p style={{ marginTop: '1rem' }}>Topic not found: {topicSlug}</p>
      </div>
    );
  }

  const topicHistory = allHistory.filter(e => e.type === 'topic' && e.key === topicSlug);
  // A topic's commit belongs to whichever package's PR triggered the update, not to a "topics"
  // repo (there isn't one) — resolve the link via that entry's triggeringPackage.

  const relatedPackages = topic.relatedPackages ?? [];
  const relatedTopics = topic.relatedTopics ?? [];

  return (
    <div>
      <button className="arch-pkg-back" onClick={onBack}>← Architecture</button>

      <div className="arch-pkg-header">
        <div className="arch-pkg-header-top">
          <code className="arch-pkg-name">{topic.title}</code>
          {topic.updatedAt && (
            <span className="arch-pkg-ai-badge" title={`Updated from commit ${topic.updatedBySha}`}>
              ✦ docs updated {topic.updatedAt}
            </span>
          )}
        </div>
        <p className="arch-pkg-desc">
          <LinkedText text={topic.summary} onSelectTopic={onSelectTopic} />
        </p>
      </div>

      <div className="arch-pkg-body">
        <section className="arch-section">
          <h2>Overview</h2>
          <p><LinkedText text={topic.body.overview} onSelectTopic={onSelectTopic} /></p>
          {topic.body.sections.map((s, i) => (
            <React.Fragment key={i}>
              <h3>{s.heading}</h3>
              <p><LinkedText text={s.content} onSelectTopic={onSelectTopic} /></p>
            </React.Fragment>
          ))}
        </section>

        {relatedPackages.length > 0 && (
          <section className="arch-section">
            <h2>Related Packages</h2>
            <div className="arch-related-chips">
              {relatedPackages.map(pkg => (
                <button key={pkg} className="arch-related-chip" onClick={() => onSelectPackage(pkg)}>
                  {pkg}
                </button>
              ))}
            </div>
          </section>
        )}

        {relatedTopics.length > 0 && (
          <section className="arch-section">
            <h2>Related Topics</h2>
            <div className="arch-related-chips">
              {relatedTopics.map(slug => (
                <button key={slug} className="arch-related-chip" onClick={() => onSelectTopic(slug)}>
                  {topics[slug]?.title ?? slug}
                </button>
              ))}
            </div>
          </section>
        )}

        {topicHistory.length > 0 && (
          <section className="arch-section">
            <details className="arch-history">
              <summary className="arch-history-summary">
                Change history <span className="arch-history-count">({topicHistory.length})</span>
              </summary>
              <ul className="arch-history-list">
                {topicHistory.map((e, i) => {
                  const repoUrl = e.triggeringPackage ? repoUrlByPackage[e.triggeringPackage] : undefined;
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

export default TopicDetail;
