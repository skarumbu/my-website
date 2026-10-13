import { dailyUrl } from './dailyApi.ts';
import { ChecklistItem } from './dailyChecklistTypes.ts';

async function handle(res: Response): Promise<any> {
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export function isDoneOn(item: ChecklistItem, iso: string): boolean {
  return item.done_dates.includes(iso);
}

export function isActiveOn(item: ChecklistItem, iso: string): boolean {
  return item.expires_after === null || item.expires_after >= iso;
}

export async function fetchChecklistItems(token: string): Promise<ChecklistItem[]> {
  const res = await fetch(dailyUrl('checklist'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await handle(res);
  return json.items;
}

export async function createChecklistTask(
  token: string, text: string, expiresAfter: string | null = null,
): Promise<ChecklistItem> {
  const res = await fetch(dailyUrl('checklist'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, expires_after: expiresAfter }),
  });
  return handle(res);
}

export async function toggleChecklistDone(
  token: string, taskId: string, dateIso: string,
): Promise<ChecklistItem> {
  const res = await fetch(`${dailyUrl(`checklist/${taskId}/toggle`)}?date=${dateIso}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return handle(res);
}
