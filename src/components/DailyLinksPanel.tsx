import React, { useEffect, useState } from 'react';
import { DailyLinkConfig } from '../lib/dailyLinksTypes.ts';
import { markLinkOpened } from '../lib/dailyLinksApi.ts';
import { fetchFeaturedArticle, FeaturedArticle } from '../lib/featuredArticle.ts';

interface Props {
  token: string;
  dateIso: string;
  links: { config: DailyLinkConfig; openedToday: boolean }[];
  onOpened: (linkId: string) => void;
}

function readTodayKey(dateIso: string): string {
  return `wiki-featured-read-${dateIso}`;
}

export default function DailyLinksPanel({ token, dateIso, links, onOpened }: Props) {
  const [article, setArticle] = useState<FeaturedArticle | null>(null);
  const [articleError, setArticleError] = useState<string | null>(null);
  const [articleRead, setArticleRead] = useState(false);

  useEffect(() => {
    // Purely client-side, no auth/backend round trip — Wikipedia's own feed
    // already returns the same article all day for a given UTC date, and a
    // new one tomorrow, with no caching logic needed on our end beyond what
    // featuredArticle.ts already does in sessionStorage.
    try {
      setArticleRead(localStorage.getItem(readTodayKey(dateIso)) === 'true');
    } catch {
      // localStorage unavailable — just starts unread every load, harmless
    }
    fetchFeaturedArticle()
      .then(setArticle)
      .catch(e => setArticleError(e.message));
  }, [dateIso]);

  const handleReadArticle = () => {
    if (!article) return;
    window.open(article.url, '_blank', 'noopener,noreferrer');
    setArticleRead(true);
    try {
      localStorage.setItem(readTodayKey(dateIso), 'true');
    } catch {
      // not persisted across reloads, but the open already happened
    }
  };

  const handleOpen = (link: DailyLinkConfig) => {
    // Fire-and-forget: the tab opens immediately, marking it opened is a
    // background best-effort write that shouldn't block navigation.
    window.open(link.url, '_blank', 'noopener,noreferrer');
    onOpened(link.id);
    markLinkOpened(token, link.id, dateIso).catch(() => {
      // Best-effort — a failed mark doesn't block the link from opening,
      // and will just show as "not opened" again next load.
    });
  };

  return (
    <section className="daily-panel links-panel">
      <h2 className="daily-panel-title">Daily Links</h2>

      {articleError && <p className="daily-panel-error">Couldn't load today's article: {articleError}</p>}
      {article && (
        <button
          type="button"
          className={`wiki-featured-card${articleRead ? ' wiki-featured-read' : ''}`}
          onClick={handleReadArticle}
        >
          <span className="wiki-featured-label">Today's Featured Article{articleRead && ' ✓'}</span>
          <span className="wiki-featured-title">{article.title}</span>
          <span className="wiki-featured-extract">{article.extract}</span>
        </button>
      )}

      <ul className="links-items">
        {links.map(({ config, openedToday }) => (
          <li key={config.id} className="links-item">
            <button
              type="button"
              className={openedToday ? 'links-item-opened' : ''}
              onClick={() => handleOpen(config)}
            >
              {config.label}
              {openedToday && <span className="links-item-check" aria-hidden="true">✓</span>}
            </button>
          </li>
        ))}
        {/* Only once the article has failed: while it loads, or once it shows,
            the panel isn't empty. */}
        {links.length === 0 && articleError && <li className="links-empty">No links configured yet.</li>}
      </ul>
    </section>
  );
}
