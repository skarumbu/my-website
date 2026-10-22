/**
 * Build a daily-api URL for a /daily/* route (checklist/links/cards —
 * Azure Table Storage-backed, not a /sections/{section}/items route, so
 * this is a separate base-path helper from postsApi.ts's sectionUrl()).
 */
export function dailyUrl(path: string): string {
  return `${process.env.REACT_APP_DAILY_API_BASE_URL}/api/daily/${path}`;
}

export function isApiConfigured(): boolean {
  return !!process.env.REACT_APP_DAILY_API_BASE_URL;
}

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
