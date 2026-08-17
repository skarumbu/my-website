/**
 * Formats an ISO date string as a readable long-form date, e.g. "June 6, 2026".
 *
 * Parses only the date portion (year/month/day) and constructs a local Date
 * from those parts rather than passing the full ISO string straight into
 * `new Date(iso)` — that would parse as UTC midnight and can display as the
 * previous day depending on the viewer's timezone.
 */
export function fmtDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}
