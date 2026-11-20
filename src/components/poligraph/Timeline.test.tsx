import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import Timeline from './Timeline.tsx';
import type { Action, Official } from '../../lib/poligraphTypes.ts';

const OFFICIAL: Official = {
  id: 'o_s', name: 'Sen Example', party: 'D', level: 'federal', photo_url: null, current: true,
  terms: [
    { office_id: 'us-house-or-1', title: 'U.S. Representative', kind: 'legislator', jurisdiction: 'us', district: '1', start: '2015-01-03', end: '2021-01-03' },
    { office_id: 'us-senate-or', title: 'U.S. Senator', kind: 'legislator', jurisdiction: 'us', district: null, start: '2021-01-03', end: null },
  ],
};

function action(overrides: Partial<Action>): Action {
  return {
    official_id: 'o_s', item_id: 'us-119-hr-1234', date: '2026-03-02', kind: 'sponsored',
    item_title: 'A bill about things', topics: ['Health', 'Housing'], source_url: 'https://example.gov/a',
    source: 'congress', office_id: 'us-senate-or', is_key_vote: false, overridden_on: null, vote_ref: null,
    ...overrides,
  };
}

function renderTimeline(actions: Action[], extra: Partial<React.ComponentProps<typeof Timeline>> = {}) {
  const onLoadMore = jest.fn();
  render(
    <Timeline actions={actions} official={OFFICIAL} hasMore={false} loading={false} onLoadMore={onLoadMore} {...extra} />,
  );
  return { onLoadMore };
}

describe('Timeline', () => {
  it('groups rows under month headings', () => {
    renderTimeline([action({}), action({ item_id: 'us-119-s-5', date: '2026-01-15' })]);
    expect(screen.getByRole('heading', { name: 'March 2026' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'January 2026' })).toBeInTheDocument();
  });

  it('renders date, label, number, title, topics and a safe Source link', () => {
    renderTimeline([action({})]);
    const row = screen.getByRole('listitem');
    expect(within(row).getByText('Mar 2')).toBeInTheDocument();
    expect(within(row).getByText('Sponsored')).toBeInTheDocument();
    expect(within(row).getByText('H.R. 1234')).toBeInTheDocument();
    expect(within(row).getByText('A bill about things')).toBeInTheDocument();
    expect(within(row).getByText('Health')).toBeInTheDocument();
    expect(within(row).getByText('Housing')).toBeInTheDocument();
    const link = within(row).getByRole('link', { name: 'Source' });
    expect(link).toHaveAttribute('href', 'https://example.gov/a');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows the item number alone when the title is empty', () => {
    renderTimeline([action({ item_title: '' })]);
    expect(screen.getAllByText('H.R. 1234')).toHaveLength(1);
  });

  it('does not render an action without a source_url', () => {
    renderTimeline([action({ item_title: 'Unsourced', source_url: '' }), action({ item_id: 'us-119-s-5', item_title: 'Sourced' })]);
    expect(screen.queryByText('Unsourced')).not.toBeInTheDocument();
    expect(screen.getByText('Sourced')).toBeInTheDocument();
  });

  it('renders a Source link only for http(s) urls', () => {
    renderTimeline([
      action({ item_title: 'Js', source_url: 'javascript:alert(1)' }),
      action({ item_id: 'us-119-s-6', item_title: 'Ftp', source_url: 'ftp://x.gov/a' }),
      action({ item_id: 'us-119-s-7', item_title: 'Plain', source_url: 'http://example.gov/p' }),
      action({ item_id: 'us-119-s-8', item_title: 'Secure', source_url: 'https://example.gov/s' }),
    ]);
    expect(screen.queryByText('Js')).not.toBeInTheDocument();
    expect(screen.queryByText('Ftp')).not.toBeInTheDocument();
    expect(screen.getByText('Plain')).toBeInTheDocument();
    expect(screen.getByText('Secure')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Source' })).toHaveLength(2);
  });

  it('shows when a veto was overridden', () => {
    renderTimeline([action({ kind: 'vetoed', overridden_on: '2026-04-01' })]);
    expect(screen.getByText('Overridden Apr 1, 2026')).toBeInTheDocument();
  });

  it('labels the office only when it differs from the latest term', () => {
    renderTimeline([
      action({ item_title: 'House one', office_id: 'us-house-or-1' }),
      action({ item_id: 'us-119-s-5', item_title: 'Senate one' }),
    ]);
    expect(screen.getAllByText('as U.S. Representative, Oregon 1st')).toHaveLength(1);
    expect(screen.queryByText(/as U.S. Senator/)).not.toBeInTheDocument();
  });

  it('calls onLoadMore from the Load more button', () => {
    const { onLoadMore } = renderTimeline([action({})], { hasMore: true });
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('has no Load more button when there is no more', () => {
    renderTimeline([action({})]);
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('shows a loading status', () => {
    renderTimeline([], { loading: true });
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(screen.queryByText('No actions match these filters.')).not.toBeInTheDocument();
  });

  it('shows the empty message when nothing matches', () => {
    renderTimeline([]);
    expect(screen.getByText('No actions match these filters.')).toBeInTheDocument();
  });
});
