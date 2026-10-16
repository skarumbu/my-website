import { dailyUrl } from './dailyApi.ts';
import { IndexCard, ReviewGrade } from './dailyCardsTypes.ts';

async function handle(res: Response): Promise<any> {
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function fetchDueCards(token: string, dateIso: string, limit: number = 20): Promise<IndexCard[]> {
  const res = await fetch(`${dailyUrl('cards/due')}?date=${dateIso}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await handle(res);
  return json.items;
}

export async function createIndexCard(token: string, text: string, back: string = ''): Promise<IndexCard> {
  const res = await fetch(dailyUrl('cards'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, back }),
  });
  return handle(res);
}

export async function deleteIndexCard(token: string, cardId: string): Promise<void> {
  const res = await fetch(dailyUrl(`cards/${cardId}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error(`${res.status}`);
}

export async function reviewCard(token: string, cardId: string, grade: ReviewGrade): Promise<IndexCard> {
  const res = await fetch(dailyUrl(`cards/${cardId}/review`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ grade }),
  });
  return handle(res);
}
