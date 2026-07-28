import React from 'react';
import { render, screen } from '@testing-library/react';
import StudioSummary, { buildRecentItems } from './StudioSummary';
import { Post } from '../lib/writeTypes';
import { DiaryEntry } from '../lib/diaryTypes';

const posts: Post[] = [
  { slug: 'a', title: 'Post A', description: '', date: '2026-07-20', published: true },
  { slug: 'b', title: 'Post B', description: '', date: '2026-07-25', published: false },
];

const diaryEntries: DiaryEntry[] = [
  { slug: 'd1', title: 'Entry One', date: '2026-07-24', blocks: [] },
  { slug: 'd2', title: 'Entry Two', date: '2026-07-26', blocks: [] },
  { slug: 'd3', title: 'Entry Three', date: '2026-07-10', blocks: [] },
];

const noop = () => {};

describe('buildRecentItems', () => {
  it('merges posts and diary entries sorted by date descending, capped at 3', () => {
    const items = buildRecentItems(posts, diaryEntries, false);
    expect(items).toHaveLength(3);
    expect(items.map(i => i.slug)).toEqual(['d2', 'b', 'd1']);
  });

  it('excludes diary entries when diaryError is true', () => {
    const items = buildRecentItems(posts, diaryEntries, true);
    expect(items.every(i => i.type === 'writing')).toBe(true);
    expect(items.map(i => i.slug)).toEqual(['b', 'a']);
  });
});

describe('StudioSummary', () => {
  it('shows post and draft counts on the Writing card', () => {
    render(
      <StudioSummary
        posts={posts}
        diaryEntries={diaryEntries}
        diaryLoading={false}
        diaryError={false}
        onNewPost={noop}
        onNewEntry={noop}
      />
    );
    expect(screen.getByText('2 posts · 1 draft')).toBeInTheDocument();
  });

  it('shows entry count on the Diary card', () => {
    render(
      <StudioSummary
        posts={posts}
        diaryEntries={diaryEntries}
        diaryLoading={false}
        diaryError={false}
        onNewPost={noop}
        onNewEntry={noop}
      />
    );
    expect(screen.getByText('3 entries')).toBeInTheDocument();
  });

  it('shows a loading label on the Diary card while diary is loading', () => {
    render(
      <StudioSummary
        posts={posts}
        diaryEntries={[]}
        diaryLoading={true}
        diaryError={false}
        onNewPost={noop}
        onNewEntry={noop}
      />
    );
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('degrades gracefully when the diary fetch failed', () => {
    render(
      <StudioSummary
        posts={posts}
        diaryEntries={[]}
        diaryLoading={false}
        diaryError={true}
        onNewPost={noop}
        onNewEntry={noop}
      />
    );
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('2 posts · 1 draft')).toBeInTheDocument();
  });

  it('calls onNewPost when the Writing card button is clicked', () => {
    const onNewPost = jest.fn();
    render(
      <StudioSummary
        posts={posts}
        diaryEntries={diaryEntries}
        diaryLoading={false}
        diaryError={false}
        onNewPost={onNewPost}
        onNewEntry={noop}
      />
    );
    screen.getByRole('button', { name: '+ New Post' }).click();
    expect(onNewPost).toHaveBeenCalledTimes(1);
  });

  it('calls onNewEntry (not navigation) when the Diary card button is clicked', () => {
    const onNewEntry = jest.fn();
    render(
      <StudioSummary
        posts={posts}
        diaryEntries={diaryEntries}
        diaryLoading={false}
        diaryError={false}
        onNewPost={noop}
        onNewEntry={onNewEntry}
      />
    );
    screen.getByRole('button', { name: '+ New Entry' }).click();
    expect(onNewEntry).toHaveBeenCalledTimes(1);
  });

  it('links the Diary card to /diary', () => {
    render(
      <StudioSummary
        posts={posts}
        diaryEntries={diaryEntries}
        diaryLoading={false}
        diaryError={false}
        onNewPost={noop}
        onNewEntry={noop}
      />
    );
    expect(screen.getByText('📔 Diary').closest('a')).toHaveAttribute('href', '/diary');
  });

  it('renders recent items linking to the right page per type', () => {
    render(
      <StudioSummary
        posts={posts}
        diaryEntries={diaryEntries}
        diaryLoading={false}
        diaryError={false}
        onNewPost={noop}
        onNewEntry={noop}
      />
    );
    expect(screen.getByText('Entry Two').closest('a')).toHaveAttribute('href', '/diary/d2');
    expect(screen.getByText('Post B').closest('a')).toHaveAttribute('href', '/write/b');
  });

  it('omits the recent section entirely when there is nothing to show', () => {
    render(
      <StudioSummary
        posts={[]}
        diaryEntries={[]}
        diaryLoading={false}
        diaryError={false}
        onNewPost={noop}
        onNewEntry={noop}
      />
    );
    expect(screen.queryByText('Recent across both')).not.toBeInTheDocument();
  });
});
