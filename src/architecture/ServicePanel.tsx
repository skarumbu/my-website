import React from 'react';
import { ArchNode } from './arch-graph-data.ts';

interface ServicePanelProps {
  node: ArchNode;
  onClose: () => void;
}

const COLOR_LABEL: Record<string, string> = {
  blue:   '#58a6ff',
  green:  '#3fb950',
  orange: '#d29922',
  purple: '#bc8cff',
  gray:   '#8b949e',
};

export default function ServicePanel({ node, onClose }: ServicePanelProps) {
  const { data } = node;
  const labelColor = COLOR_LABEL[data.color] ?? '#c9d1d9';

  return (
    <div className="arch-panel">
      <div className="arch-panel-header">
        <div>
          <span className="arch-panel-title" style={{ color: labelColor }}>{data.label}</span>
          <span className="arch-panel-subtitle">{data.subtitle}</span>
        </div>
        <button className="arch-panel-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="arch-panel-body">
        <p className="arch-panel-description">{data.description}</p>

        {data.techStack.length > 0 && (
          <div className="arch-panel-section">
            <div className="arch-panel-section-label">Tech Stack</div>
            <div className="arch-tech-list">
              {data.techStack.map(t => (
                <span key={t} className="arch-tech-item">{t}</span>
              ))}
            </div>
          </div>
        )}

        {data.endpoints.length > 0 && (
          <div className="arch-panel-section">
            <div className="arch-panel-section-label">Key Files &amp; Endpoints</div>
            <ul className="arch-panel-links">
              {data.endpoints.map(e => (
                <li key={e.href}>
                  <a href={e.href} target="_blank" rel="noopener noreferrer">{e.label}</a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.designDocs.length > 0 && (
          <div className="arch-panel-section">
            <div className="arch-panel-section-label">Design Docs</div>
            <ul className="arch-panel-links">
              {data.designDocs.map(d => (
                <li key={d.href}>
                  <a href={d.href} target="_blank" rel="noopener noreferrer">{d.label}</a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.repoUrl && (
          <a
            href={data.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="arch-panel-repo-link"
          >
            View repository →
          </a>
        )}
      </div>
    </div>
  );
}
