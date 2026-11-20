// Development-only data, used when NODE_ENV is "development" and no API URL is set.
// Index rows are derived from the stub officials so search, browse and record pages agree.
import type {
  Action,
  ActionKind,
  ActionPage,
  ActionQuery,
  IndexRow,
  LookupResult,
  Official,
  OfficialRecord,
} from './poligraphTypes.ts';

const PAGE_SIZE = 50;

const OFFICIALS: Official[] = [
  {
    id: 'o_president',
    name: 'Pat Example',
    party: 'Independent',
    level: 'federal',
    photo_url: null,
    current: true,
    terms: [
      {
        office_id: 'us-president',
        title: 'President of the United States',
        kind: 'executive',
        jurisdiction: 'us',
        district: null,
        start: '2025-01-20',
        end: null,
      },
    ],
  },
  {
    id: 'o_senator_a',
    name: 'Alex Sample',
    party: 'Democratic',
    level: 'federal',
    photo_url: null,
    current: true,
    terms: [
      {
        office_id: 'us-senate-or',
        title: 'U.S. Senator',
        kind: 'legislator',
        jurisdiction: 'or',
        district: null,
        start: '2019-01-03',
        end: null,
      },
    ],
  },
  {
    id: 'o_senator_b',
    name: 'Jordan Placeholder',
    party: 'Democratic',
    level: 'federal',
    photo_url: null,
    current: true,
    terms: [
      {
        office_id: 'us-senate-or',
        title: 'U.S. Senator',
        kind: 'legislator',
        jurisdiction: 'or',
        district: null,
        start: '2021-01-03',
        end: null,
      },
    ],
  },
  {
    id: 'o_house_or3',
    name: 'Casey Demo',
    party: 'Republican',
    level: 'federal',
    photo_url: null,
    current: true,
    terms: [
      {
        office_id: 'us-house-or-3',
        title: 'U.S. Representative',
        kind: 'legislator',
        jurisdiction: 'or',
        district: '3',
        start: '2023-01-03',
        end: null,
      },
    ],
  },
];

function action(
  officialId: string,
  officeId: string,
  itemId: string,
  date: string,
  kind: ActionKind,
  title: string,
  extra: Partial<Action> = {},
): Action {
  return {
    official_id: officialId,
    item_id: itemId,
    date,
    kind,
    item_title: title,
    topics: [],
    source_url: `https://example.test/${itemId}`,
    source: 'congress',
    office_id: officeId,
    is_key_vote: false,
    overridden_on: null,
    vote_ref: null,
    ...extra,
  };
}

const PRESIDENT_ACTIONS: Action[] = [
  action('o_president', 'us-president', 'us-2026-eo-14500', '2026-10-14', 'executive_order', 'Establishing a Federal Rural Broadband Program', { topics: ['Economy and Labor'], source: 'federal_register' }),
  action('o_president', 'us-president', 'us-119-hr-210', '2026-09-30', 'signed', 'Highway Funding Extension Act', { topics: ['Transportation'] }),
  action('o_president', 'us-president', 'us-119-hr-88', '2026-08-12', 'vetoed', 'Federal Land Transfer Act', { topics: ['Energy and Environment'], overridden_on: '2026-09-02' }),
  action('o_president', 'us-president', 'us-119-s-41', '2026-07-03', 'vetoed', 'Telehealth Coverage Repeal Act', { topics: ['Health'] }),
  action('o_president', 'us-president', 'us-2026-eo-14488', '2026-06-20', 'executive_order', 'Modernizing Federal Hiring Practices', { topics: ['Government Operations'], source: 'federal_register' }),
  action('o_president', 'us-president', 'us-119-hr-15', '2026-05-18', 'signed', 'Veterans Housing Support Act', { topics: ['Housing', 'Defense'] }),
  action('o_president', 'us-president', 'us-119-s-9', '2026-03-09', 'pocket_veto', 'Agricultural Research Reauthorization', { topics: ['Agriculture'] }),
];

const KEY_VOTE_KINDS: ActionKind[] = ['vote_yes', 'vote_no', 'vote_present', 'vote_not_voting'];

function monthsBack(i: number): { year: number; month: number } {
  // Start at 2026-10 and walk back one month per 8 actions.
  const total = 2026 * 12 + 9 - Math.floor(i / 8);
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function houseActions(): Action[] {
  const out: Action[] = [];
  for (let i = 0; i < 75; i++) {
    const { year, month } = monthsBack(i);
    const day = 28 - (i % 8) * 3;
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const topics = [TOPIC_CYCLE[i % TOPIC_CYCLE.length]];
    let kind: ActionKind;
    let extra: Partial<Action> = { topics };
    if (i % 5 === 4) {
      // Every 5th is a non-key roll call vote, hidden by the default legislator filter.
      kind = KEY_VOTE_KINDS[Math.floor(i / 5) % 2 === 0 ? 0 : 1];
      extra = { topics, vote_ref: `house-2026-${100 + i}` };
    } else if (i % 5 === 3) {
      kind = KEY_VOTE_KINDS[i % 4];
      extra = { topics, is_key_vote: true, vote_ref: `house-2026-${100 + i}` };
    } else if (i % 5 === 2) {
      kind = 'cosponsored';
    } else {
      kind = 'sponsored';
    }
    out.push(
      action('o_house_or3', 'us-house-or-3', `us-119-hr-${1000 + i}`, date, kind, `Stub Bill Title ${i + 1}`, extra),
    );
  }
  return out;
}

const TOPIC_CYCLE = ['Health', 'Housing', 'Transportation', 'Education', 'Energy and Environment', 'Budget and Taxes'];

const SENATOR_ACTIONS = (id: string): Action[] => [
  action(id, 'us-senate-or', 'us-119-s-300', '2026-10-02', 'sponsored', 'Rural Clinic Access Act', { topics: ['Health'] }),
  action(id, 'us-senate-or', 'us-119-s-250', '2026-09-15', 'cosponsored', 'Clean Water Infrastructure Act', { topics: ['Energy and Environment'] }),
  action(id, 'us-senate-or', 'us-119-hr-210', '2026-09-10', 'vote_yes', 'Highway Funding Extension Act', { topics: ['Transportation'], is_key_vote: true, vote_ref: 'senate-119-2-210' }),
  action(id, 'us-senate-or', 'us-119-s-41', '2026-06-25', 'vote_no', 'Telehealth Coverage Repeal Act', { topics: ['Health'], is_key_vote: true, vote_ref: 'senate-119-2-98' }),
];

const ACTIONS: Record<string, Action[]> = {
  o_president: PRESIDENT_ACTIONS,
  o_senator_a: SENATOR_ACTIONS('o_senator_a'),
  o_senator_b: SENATOR_ACTIONS('o_senator_b'),
  o_house_or3: houseActions(),
};

export function stubIndex(): IndexRow[] {
  return OFFICIALS.map((o) => {
    const term = o.terms[o.terms.length - 1];
    const legislator = term.kind === 'legislator';
    return {
      id: o.id,
      name: o.name,
      office: term.title,
      jurisdiction: term.jurisdiction,
      office_id: term.office_id,
      state: legislator ? term.jurisdiction : null,
      district: term.district,
      level: o.level,
      party: o.party,
      current: o.current,
    };
  });
}

export function stubOfficial(id: string): OfficialRecord | null {
  const official = OFFICIALS.find((o) => o.id === id);
  if (!official) return null;
  const counts: Record<string, number> = {};
  for (const a of ACTIONS[id] ?? []) counts[a.kind] = (counts[a.kind] ?? 0) + 1;
  const now = new Date().toISOString();
  return {
    official,
    counts,
    freshness: [
      { source: 'congress', last_success: now, stale: false },
      { source: 'house_votes', last_success: now, stale: false },
      { source: 'senate_votes', last_success: now, stale: false },
      { source: 'federal_register', last_success: now, stale: false },
    ],
  };
}

export function stubActions(
  id: string,
  q: ActionQuery,
  cursor?: string | null,
  limit = PAGE_SIZE,
): ActionPage | null {
  const official = OFFICIALS.find((o) => o.id === id);
  if (!official) return null;
  const legislator = official.terms[official.terms.length - 1].kind === 'legislator';
  const defaultView = legislator && !q.kind?.length && !q.keyVotes;
  const filtered = (ACTIONS[id] ?? []).filter((a) => {
    if (defaultView && !(a.kind === 'sponsored' || a.kind === 'cosponsored' || a.is_key_vote)) return false;
    if (q.kind?.length && !q.kind.includes(a.kind)) return false;
    if (q.keyVotes && !a.is_key_vote) return false;
    if (q.topic && !a.topics.includes(q.topic)) return false;
    if (q.from && a.date < q.from) return false;
    if (q.to && a.date > q.to) return false;
    return true;
  });
  const start = cursor ? Number(cursor) || 0 : 0;
  const end = start + limit;
  return {
    actions: filtered.slice(start, end),
    cursor: end < filtered.length ? String(end) : null,
  };
}

export function stubLookup(): LookupResult {
  return {
    federal: OFFICIALS.filter((o) => o.level === 'federal'),
    state: [],
  };
}
