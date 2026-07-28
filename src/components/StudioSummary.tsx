import React from 'react';
import { Post } from '../lib/writeTypes.ts';
import { DiaryEntry } from '../lib/diaryTypes.ts';
import '../styling/studio-summary.css';

interface RecentItem {
  type: 'writing' | 'diary';
  slug: string;
  title: string;
  date: string;
  published?: boolean;
}

export function buildRecentItems(
  posts: Post[],
  diaryEntries: DiaryEntry[],
  diaryError: boolean
): RecentItem[] {
  const writingItems: RecentItem[] = posts.map(p => ({
    type: 'writing',
    slug: p.slug,
    title: p.title,
    date: p.date,
    published: p.published,
  }));
  const diaryItems: RecentItem[] = diaryError
    ? []
    : diaryEntries.map(e => ({
        type: 'diary',
        slug: e.slug,
        title: e.title,
        date: e.date,
      }));
  return [...writingItems, ...diaryItems]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
}

interface StudioSummaryProps {
  posts: Post[];
  diaryEntries: DiaryEntry[];
  diaryLoading: boolean;
  diaryError: boolean;
  onNewPost: () => void;
  onNewEntry: () => void;
}

function StudioSummary({
  posts,
  diaryEntries,
  diaryLoading,
  diaryError,
  onNewPost,
  onNewEntry,
}: StudioSummaryProps) {
  const draftCount = posts.filter(p => !p.published).length;
  const diaryCountLabel = diaryLoading
    ? 'Loading…'
    : diaryError
    ? '—'
    : `${diaryEntries.length} ${diaryEntries.length === 1 ? 'entry' : 'entries'}`;
  const recentItems = buildRecentItems(posts, diaryEntries, diaryError);

  return (
    <div className="studio-summary">
      <div className="studio-summary-row">
        <div className="studio-card">
          <div className="studio-card-top">
            <h2 className="studio-card-title">✍️ Writing</h2>
            <span className="studio-card-badge studio-card-badge-public">Public</span>
          </div>
          <p className="studio-card-count">
            {posts.length} {posts.length === 1 ? 'post' : 'posts'} · {draftCount}{' '}
            {draftCount === 1 ? 'draft' : 'drafts'}
          </p>
          <button className="studio-card-cta" onClick={onNewPost}>
            + New Post
          </button>
        </div>

        <a className="studio-card studio-card-link" href="/diary">
          <div className="studio-card-top">
            <h2 className="studio-card-title">📔 Diary</h2>
            <span className="studio-card-badge studio-card-badge-private">Private</span>
          </div>
          <p className="studio-card-count">{diaryCountLabel}</p>
          <button
            className="studio-card-cta"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onNewEntry();
            }}
          >
            + New Entry
          </button>
        </a>
      </div>

      {recentItems.length > 0 && (
        <div className="studio-recent">
          <span className="studio-recent-label">Recent across both</span>
          <ul className="studio-recent-list">
            {recentItems.map(item => (
              <li key={`${item.type}-${item.slug}`} className="studio-recent-item">
                <a
                  className="studio-recent-link"
                  href={item.type === 'writing' ? `/write/${item.slug}` : `/diary/${item.slug}`}
                >
                  <span className="studio-recent-title">{item.title}</span>
                  <span className="studio-recent-meta">
                    {item.type === 'writing' ? 'Writing' : 'Diary'}
                    {item.type === 'writing' && (item.published ? ' · Published' : ' · Draft')}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default StudioSummary;
