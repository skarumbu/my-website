import React from 'react';
import { DailyLinkConfig } from '../lib/dailyLinksTypes.ts';
import { markLinkOpened } from '../lib/dailyLinksApi.ts';

interface Props {
  token: string;
  dateIso: string;
  links: { config: DailyLinkConfig; openedToday: boolean }[];
  onOpened: (linkId: string) => void;
}

export default function DailyLinksPanel({ token, dateIso, links, onOpened }: Props) {
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
        {links.length === 0 && <li className="links-empty">No links configured yet.</li>}
      </ul>
    </section>
  );
}
