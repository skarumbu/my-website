import type { Action, ActionKind, Freshness, IndexRow, Official } from './poligraphTypes.ts';

const ACTION_LABELS: Record<ActionKind, string> = {
  signed: 'Signed',
  vetoed: 'Vetoed',
  line_item_veto: 'Line-item veto',
  pocket_veto: 'Pocket veto',
  law_without_signature: 'Became law without signature',
  executive_order: 'Executive order',
  sponsored: 'Sponsored',
  cosponsored: 'Co-sponsored',
  vote_yes: 'Voted yes',
  vote_no: 'Voted no',
  vote_present: 'Voted present',
  vote_not_voting: 'Did not vote',
};

export function actionLabel(kind: ActionKind): string {
  return ACTION_LABELS[kind];
}

const ITEM_PREFIXES: Record<string, string> = {
  hr: 'H.R.',
  s: 'S.',
  hjres: 'H.J.Res.',
  sjres: 'S.J.Res.',
  hconres: 'H.Con.Res.',
  sconres: 'S.Con.Res.',
  hres: 'H.Res.',
  sres: 'S.Res.',
  eo: 'E.O.',
};

/** "us-119-hr-1234" -> "H.R. 1234". Unknown types fall back to the uppercased type. */
export function itemNumber(itemId: string): string {
  const parts = itemId.split('-');
  if (parts.length < 4) return itemId;
  const type = parts[2];
  const number = parts.slice(3).join('-');
  return `${ITEM_PREFIXES[type] ?? type.toUpperCase()} ${number}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Built from the ISO string's own parts, never new Date(iso), so a timezone can't shift the month.
function monthLabel(month: string): string {
  const [year, mm] = month.split('-');
  return `${MONTH_NAMES[Number(mm) - 1]} ${year}`;
}

export function groupByMonth(
  actions: Action[],
): { month: string; label: string; actions: Action[] }[] {
  const groups: { month: string; label: string; actions: Action[] }[] = [];
  for (const action of actions) {
    const month = action.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.month === month) {
      last.actions.push(action);
    } else {
      groups.push({ month, label: monthLabel(month), actions: [action] });
    }
  }
  return groups;
}

const STATE_NAMES: Record<string, string> = {
  al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas', ca: 'california',
  co: 'colorado', ct: 'connecticut', de: 'delaware', dc: 'district of columbia',
  fl: 'florida', ga: 'georgia', hi: 'hawaii', id: 'idaho', il: 'illinois',
  in: 'indiana', ia: 'iowa', ks: 'kansas', ky: 'kentucky', la: 'louisiana',
  me: 'maine', md: 'maryland', ma: 'massachusetts', mi: 'michigan', mn: 'minnesota',
  ms: 'mississippi', mo: 'missouri', mt: 'montana', ne: 'nebraska', nv: 'nevada',
  nh: 'new hampshire', nj: 'new jersey', nm: 'new mexico', ny: 'new york',
  nc: 'north carolina', nd: 'north dakota', oh: 'ohio', ok: 'oklahoma', or: 'oregon',
  pa: 'pennsylvania', ri: 'rhode island', sc: 'south carolina', sd: 'south dakota',
  tn: 'tennessee', tx: 'texas', ut: 'utah', vt: 'vermont', va: 'virginia',
  wa: 'washington', wv: 'west virginia', wi: 'wisconsin', wy: 'wyoming',
};

function matchesToken(row: IndexRow, token: string): boolean {
  const state = (row.state ?? '').toLowerCase();
  const district = (row.district ?? '').toLowerCase();
  return (
    row.name.toLowerCase().includes(token) ||
    (row.office ?? '').toLowerCase().includes(token) ||
    state === token ||
    (STATE_NAMES[state] ?? '').includes(token) ||
    district === token ||
    (token.length > 1 && district.includes(token))
  );
}

export function searchOfficials(index: IndexRow[], query: string, limit = 10): IndexRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/[\s-]+/).filter(Boolean);
  const rank = (row: IndexRow) =>
    (row.current ? 0 : 2) + (row.name.toLowerCase().startsWith(q) ? 0 : 1);
  return index
    .filter((row) => tokens.every((t) => matchesToken(row, t)))
    .map((row, i) => ({ row, i, rank: rank(row) }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.row);
}

const SOURCE_NAMES: Record<string, string> = {
  congress: 'Congress.gov',
  house_votes: 'House votes',
  senate_votes: 'Senate votes',
  federal_register: 'Federal Register',
};

export function freshnessSummary(f: Freshness[]): { updated: string | null; stale: string[] } {
  let updated: string | null = null;
  for (const entry of f) {
    if (entry.last_success && (updated === null || Date.parse(entry.last_success) < Date.parse(updated))) {
      updated = entry.last_success;
    }
  }
  const stale = f.filter((e) => e.stale).map((e) => SOURCE_NAMES[e.source] ?? e.source);
  return { updated, stale };
}

export function officeAt(official: Official, officeId: string): string {
  return official.terms.find((t) => t.office_id === officeId)?.title ?? officeId;
}

export function isExecutive(official: Official): boolean {
  const latest = official.terms.reduce<Official['terms'][number] | null>(
    (acc, t) => (acc === null || t.start >= acc.start ? t : acc),
    null,
  );
  return latest?.kind === 'executive';
}
