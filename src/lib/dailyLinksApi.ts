import { dailyUrl } from './dailyApi.ts';
import { DailyLinkConfig } from './dailyLinksTypes.ts';

async function handle(res: Response): Promise<any> {
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function fetchLinksConfig(token: string): Promise<{ links: DailyLinkConfig[] }> {
  const res = await fetch(dailyUrl('links/config'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handle(res);
}

export async function setLinksConfig(token: string, links: DailyLinkConfig[]): Promise<{ links: DailyLinkConfig[] }> {
  const res = await fetch(dailyUrl('links/config'), {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ links }),
  });
  return handle(res);
}

export async function fetchOpenedToday(token: string, dateIso: string): Promise<Set<string>> {
  const res = await fetch(`${dailyUrl('links/opened')}?date=${dateIso}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await handle(res);
  return new Set<string>(json.opened);
}

export async function markLinkOpened(token: string, linkId: string, dateIso: string): Promise<void> {
  const res = await fetch(`${dailyUrl(`links/${linkId}/opened`)}?date=${dateIso}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  await handle(res);
}
