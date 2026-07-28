import React from 'react';
import * as Diff from 'diff';

// Turns a generated-content object (package OR topic shape — both are handled generically by
// checking which fields are present) into one line per field/array-item, so a line-diff aligns
// on logical units instead of showing whole-JSON-blob replacement noise.
function serializeContent(content: any): string[] {
  if (!content) return [];
  const lines: string[] = [];

  if (content.title) lines.push(`title: ${content.title}`);
  if (content.summary) lines.push(`summary: ${content.summary}`);
  if (content.description) lines.push(`description: ${content.description}`);

  if (Array.isArray(content.features)) {
    lines.push('features:');
    content.features.forEach((f: string) => lines.push(`  - ${f}`));
  }

  if (content.architecture) {
    if (content.architecture.overview) {
      lines.push(`architecture.overview: ${content.architecture.overview}`);
    }
    if (Array.isArray(content.architecture.keyPoints)) {
      lines.push('architecture.keyPoints:');
      content.architecture.keyPoints.forEach((k: string) => lines.push(`  - ${k}`));
    }
  }

  if (Array.isArray(content.dataFlow)) {
    lines.push('dataFlow:');
    content.dataFlow.forEach((step: any) => {
      lines.push(`  - ${step.label}`);
      (step.sublines ?? []).forEach((s: string) => lines.push(`      ${s}`));
    });
  }

  if (content.body) {
    if (content.body.overview) lines.push(`body.overview: ${content.body.overview}`);
    if (Array.isArray(content.body.sections)) {
      lines.push('body.sections:');
      content.body.sections.forEach((s: any) => {
        lines.push(`  [${s.heading}]`);
        lines.push(`    ${s.content}`);
      });
    }
  }

  if (Array.isArray(content.relatedPackages)) {
    lines.push(`relatedPackages: ${content.relatedPackages.join(', ')}`);
  }
  if (Array.isArray(content.relatedTopics)) {
    lines.push(`relatedTopics: ${content.relatedTopics.join(', ')}`);
  }

  return lines;
}

interface HistoryDiffProps {
  before: any;
  after: any;
}

const HistoryDiff: React.FC<HistoryDiffProps> = ({ before, after }) => {
  const beforeText = serializeContent(before).join('\n');
  const afterText = serializeContent(after).join('\n');
  const parts = Diff.diffLines(beforeText, afterText);

  const hasChanges = parts.some(p => p.added || p.removed);
  if (!hasChanges) {
    return <p className="arch-history-diff-empty">No content changes recorded for this update.</p>;
  }

  return (
    <pre className="arch-history-diff">
      {parts.map((part, i) => {
        const cls = part.added ? 'arch-diff-add' : part.removed ? 'arch-diff-remove' : 'arch-diff-common';
        const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
        const lines = part.value.replace(/\n$/, '').split('\n');
        return (
          <span key={i} className={cls}>
            {lines.map((line, j) => `${prefix}${line}\n`).join('')}
          </span>
        );
      })}
    </pre>
  );
};

export default HistoryDiff;
