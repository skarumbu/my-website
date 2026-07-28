import React from 'react';
import { render, screen } from '@testing-library/react';
import HistoryDiff from './HistoryDiff';

describe('HistoryDiff', () => {
  it('shows an added and a removed line when a feature changes', () => {
    const before = { summary: 'Same summary', features: ['Old feature'] };
    const after = { summary: 'Same summary', features: ['New feature'] };
    const { container } = render(<HistoryDiff before={before} after={after} />);
    const removed = container.querySelector('.arch-diff-remove');
    const added = container.querySelector('.arch-diff-add');
    expect(removed?.textContent).toContain('Old feature');
    expect(added?.textContent).toContain('New feature');
  });

  it('renders an empty-changes message when before and after serialize the same', () => {
    const content = { summary: 'Unchanged summary' };
    render(<HistoryDiff before={content} after={{ ...content }} />);
    expect(screen.getByText('No content changes recorded for this update.')).toBeInTheDocument();
  });

  it('handles a missing before (e.g. first-ever snapshot) without crashing', () => {
    const { container } = render(<HistoryDiff before={null} after={{ summary: 'First content' }} />);
    const added = container.querySelector('.arch-diff-add');
    expect(added?.textContent).toContain('summary: First content');
  });

  it('serializes topic-shaped content (title/body) as well as package-shaped content', () => {
    const before = { title: 'Authentication', body: { overview: 'Old philosophy' } };
    const after = { title: 'Authentication', body: { overview: 'New philosophy' } };
    const { container } = render(<HistoryDiff before={before} after={after} />);
    const removed = container.querySelector('.arch-diff-remove');
    const added = container.querySelector('.arch-diff-add');
    expect(removed?.textContent).toContain('body.overview: Old philosophy');
    expect(added?.textContent).toContain('body.overview: New philosophy');
  });
});
