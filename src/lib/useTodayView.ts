import { fetchChecklistItems, isActiveOn } from './dailyChecklistApi.ts';
import { ChecklistItem } from './dailyChecklistTypes.ts';
import { fetchLinksConfig, fetchOpenedToday } from './dailyLinksApi.ts';
import { DailyLinkConfig } from './dailyLinksTypes.ts';
import { fetchDueCards } from './dailyCardsApi.ts';
import { IndexCard } from './dailyCardsTypes.ts';

export interface TodayView {
  checklist: ChecklistItem[];
  links: { config: DailyLinkConfig; openedToday: boolean }[];
  dueCards: IndexCard[];
}

export async function loadTodayView(token: string, iso: string): Promise<TodayView> {
  const [checklist, linksConfig, openedToday, dueCards] = await Promise.all([
    fetchChecklistItems(token),
    fetchLinksConfig(token),
    fetchOpenedToday(token, iso),
    fetchDueCards(token, iso),
  ]);
  return {
    checklist: checklist.filter(item => isActiveOn(item, iso)),
    links: linksConfig.links.map(cfg => ({ config: cfg, openedToday: openedToday.has(cfg.id) })),
    dueCards,
  };
}
