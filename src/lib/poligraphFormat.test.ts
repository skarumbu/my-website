import {
  actionLabel,
  itemNumber,
  groupByMonth,
  searchOfficials,
  freshnessSummary,
  officeAt,
  officeLabel,
  stateName,
  isExecutive,
  shortDate,
  longDate,
  sinceYear,
} from './poligraphFormat.ts';
import type { Action, ActionKind, IndexRow, Official } from './poligraphTypes.ts';

describe('actionLabel', () => {
  const cases: [ActionKind, string][] = [
    ['signed', 'Signed'],
    ['vetoed', 'Vetoed'],
    ['line_item_veto', 'Line-item veto'],
    ['pocket_veto', 'Pocket veto'],
    ['law_without_signature', 'Became law without signature'],
    ['executive_order', 'Executive order'],
    ['sponsored', 'Sponsored'],
    ['cosponsored', 'Co-sponsored'],
    ['vote_yes', 'Voted yes'],
    ['vote_no', 'Voted no'],
    ['vote_present', 'Voted present'],
    ['vote_not_voting', 'Did not vote'],
  ];
  it.each(cases)('%s -> %s', (kind, label) => {
    expect(actionLabel(kind)).toBe(label);
  });
});

describe('itemNumber', () => {
  const cases: [string, string][] = [
    ['us-119-hr-1234', 'H.R. 1234'],
    ['us-119-s-5', 'S. 5'],
    ['us-119-hjres-7', 'H.J.Res. 7'],
    ['us-119-sjres-7', 'S.J.Res. 7'],
    ['us-119-hconres-2', 'H.Con.Res. 2'],
    ['us-119-sconres-2', 'S.Con.Res. 2'],
    ['us-119-hres-9', 'H.Res. 9'],
    ['us-119-sres-9', 'S.Res. 9'],
    ['us-2025-eo-14123', 'E.O. 14123'],
    ['us-119-pn-3', 'PN 3'],
  ];
  it.each(cases)('%s -> %s', (id, label) => {
    expect(itemNumber(id)).toBe(label);
  });
});

const act = (date: string, item: string): Action => ({
  official_id: 'o_1',
  item_id: item,
  date,
  kind: 'sponsored',
  item_title: item,
  topics: [],
  source_url: 'http://x',
  source: 'congress',
  office_id: 'us-house-or-3',
  is_key_vote: false,
  overridden_on: null,
  vote_ref: null,
});

describe('groupByMonth', () => {
  it('groups newest-first actions by month, keeping order', () => {
    const groups = groupByMonth([act('2026-03-28', 'a'), act('2026-03-02', 'b'), act('2026-01-15', 'c')]);
    expect(groups.map((g) => g.month)).toEqual(['2026-03', '2026-01']);
    expect(groups.map((g) => g.label)).toEqual(['March 2026', 'January 2026']);
    expect(groups[0].actions.map((a) => a.item_id)).toEqual(['a', 'b']);
    expect(groups[1].actions.map((a) => a.item_id)).toEqual(['c']);
  });
});

const row = (over: Partial<IndexRow>): IndexRow => ({
  id: 'x',
  name: 'X',
  office: null,
  jurisdiction: null,
  office_id: null,
  state: null,
  district: null,
  level: 'federal',
  party: null,
  current: true,
  ...over,
});

describe('searchOfficials', () => {
  const index: IndexRow[] = [
    row({ id: 'w', name: 'Ron Wyden', office: 'U.S. Senator', state: 'or' }),
    row({ id: 'm', name: 'Jeff Merkley', office: 'U.S. Senator', state: 'or' }),
    row({ id: 'b', name: 'Maxine Bonamici', office: 'U.S. Representative', state: 'or', district: '1' }),
    row({ id: 'h', name: 'Chris Hubbard', office: 'U.S. Representative', state: 'or', district: '3' }),
    row({ id: 'f', name: 'Former Wydenson', office: 'U.S. Senator', state: 'wa', current: false }),
    row({ id: 'p', name: 'Wy Prefix', office: 'U.S. Senator', state: 'wa' }),
    row({ id: 'q', name: 'Bob Wyatt', office: 'U.S. Senator', state: 'wa', current: false }),
  ];
  const ids = (q: string, limit?: number) => searchOfficials(index, q, limit).map((r) => r.id);

  it('matches by name, case-insensitive', () => {
    expect(ids('WYDEN')).toEqual(['w', 'f']);
  });
  it('matches state code and district', () => {
    expect(ids('or-3')).toEqual(['h']);
  });
  it('matches state name and district', () => {
    expect(ids('oregon 3')).toEqual(['h']);
  });
  it('matches when every token is found across name, office and state', () => {
    expect(ids('senator oregon').sort()).toEqual(['m', 'w']);
  });
  it('ranks current before former, and name-prefix matches first within each group', () => {
    // current: p (prefix) before w; former: q and f (neither starts with "wy")
    expect(ids('wy')).toEqual(['p', 'w', 'f', 'q']);
  });
  it('ranks a former prefix match above other former matches', () => {
    const idx = [
      row({ id: 'a', name: 'Zed Wyx', current: false }),
      row({ id: 'b', name: 'Wyy Zed', current: false }),
    ];
    expect(searchOfficials(idx, 'wy').map((r) => r.id)).toEqual(['b', 'a']);
  });
  it('treats short tokens as state codes, not substrings of other states or offices', () => {
    const idx = [
      row({ id: 'or3', name: 'Ann Lee', office: 'U.S. Representative', state: 'or', district: '3' }),
      row({ id: 'fl3', name: 'Bo Kim', office: 'U.S. Representative', state: 'fl', district: '3' }),
      row({ id: 'nd3', name: 'Cy Roe', office: 'U.S. Representative', state: 'nd', district: '3' }),
      row({ id: 'fls', name: 'Di Poe', office: 'U.S. Senator', state: 'fl' }),
    ];
    expect(searchOfficials(idx, 'or-3').map((r) => r.id)).toEqual(['or3']);
    expect(searchOfficials(idx, 'or').map((r) => r.id)).toEqual(['or3']);
  });
  it('defaults limit to 10 and honors an explicit limit', () => {
    const many = Array.from({ length: 15 }, (_, i) => row({ id: `i${i}`, name: `Smith ${i}` }));
    expect(searchOfficials(many, 'smith')).toHaveLength(10);
    expect(searchOfficials(many, 'smith', 3)).toHaveLength(3);
  });
  it('returns [] for a blank query', () => {
    expect(searchOfficials(index, '')).toEqual([]);
    expect(searchOfficials(index, '   ')).toEqual([]);
  });
});

describe('freshnessSummary', () => {
  it('reports the oldest last_success and display names of stale sources', () => {
    const s = freshnessSummary([
      { source: 'congress', last_success: '2026-11-10T00:00:00Z', stale: true },
      { source: 'house_votes', last_success: '2026-11-01T00:00:00Z', stale: false },
      { source: 'senate_votes', last_success: null, stale: true },
      { source: 'federal_register', last_success: '2026-11-05T00:00:00Z', stale: true },
      { source: 'mystery', last_success: '2026-11-06T00:00:00Z', stale: true },
    ]);
    expect(s.updated).toBe('2026-11-01T00:00:00Z');
    expect(s.stale).toEqual(['Congress.gov', 'Senate votes', 'Federal Register', 'mystery']);
  });
  it('has null updated when every last_success is null', () => {
    expect(freshnessSummary([{ source: 'congress', last_success: null, stale: false }])).toEqual({
      updated: null,
      stale: [],
    });
  });
});

const official = (kinds: ('executive' | 'legislator')[]): Official => ({
  id: 'o',
  name: 'N',
  party: null,
  level: 'federal',
  photo_url: null,
  current: true,
  terms: kinds.map((kind, i) => ({
    office_id: `office-${i}`,
    title: `Title ${i}`,
    kind,
    jurisdiction: 'us',
    district: null,
    start: `20${10 + i}-01-01`,
    end: null,
  })),
});

describe('officeAt', () => {
  it('returns the title of the matching term, else the office_id', () => {
    const o = official(['legislator', 'executive']);
    expect(officeAt(o, 'office-1')).toBe('Title 1');
    expect(officeAt(o, 'nope')).toBe('nope');
  });
});

describe('isExecutive', () => {
  it('is true when the latest term is executive', () => {
    expect(isExecutive(official(['legislator', 'executive']))).toBe(true);
    expect(isExecutive(official(['executive', 'legislator']))).toBe(false);
  });
});

describe('shortDate / longDate', () => {
  it('format from the ISO string parts', () => {
    expect(shortDate('2026-03-02')).toBe('Mar 2');
    expect(longDate('2026-04-01')).toBe('Apr 1, 2026');
  });
  it('longDate uses only the date part of a datetime', () => {
    expect(longDate('2026-11-20T07:00:00+00:00')).toBe('Nov 20, 2026');
    expect(longDate('2026-11-20T23:59:59-08:00')).toBe('Nov 20, 2026');
  });
});

describe('sinceYear', () => {
  const term = (office_id: string, start: string, end: string | null) => ({
    office_id, title: office_id, kind: 'legislator' as const, jurisdiction: 'us', district: null, start, end,
  });
  const off = (terms: ReturnType<typeof term>[]): Official => ({
    id: 'o', name: 'N', party: null, level: 'federal', photo_url: null, current: true, terms,
  });
  it('spans consecutive terms in the same office', () => {
    const o = off([term('h', '2019-01-03', '2021-01-03'), term('h', '2021-01-03', '2023-01-03'), term('h', '2023-01-03', null)]);
    expect(sinceYear(o)).toBe('2019');
  });
  it('stops at a gap', () => {
    const o = off([term('h', '2011-01-03', '2013-01-03'), term('h', '2019-01-03', '2021-01-03'), term('h', '2021-01-03', null)]);
    expect(sinceYear(o)).toBe('2019');
  });
  it('stops at a different office', () => {
    const o = off([term('h', '2011-01-03', '2017-01-03'), term('s', '2017-01-03', null)]);
    expect(sinceYear(o)).toBe('2017');
  });
  it('is null with no terms', () => {
    expect(sinceYear(off([]))).toBeNull();
  });
});

describe('officeLabel', () => {
  it('adds the state for senators', () => {
    expect(officeLabel('U.S. Senator', 'us-senate-or')).toBe('U.S. Senator, Oregon');
  });
  it('adds state and ordinal district for representatives', () => {
    const cases: [string, string][] = [
      ['1', '1st'], ['2', '2nd'], ['3', '3rd'], ['4', '4th'], ['11', '11th'], ['12', '12th'],
      ['13', '13th'], ['21', '21st'], ['22', '22nd'], ['23', '23rd'],
    ];
    for (const [n, ord] of cases) {
      expect(officeLabel('U.S. Representative', `us-house-or-${n}`)).toBe(`U.S. Representative, Oregon ${ord}`);
    }
  });
  it('handles at-large districts', () => {
    expect(officeLabel('U.S. Representative', 'us-house-ak-at-large')).toBe('U.S. Representative, Alaska at-large');
  });
  it('leaves non-congress offices unchanged', () => {
    expect(officeLabel('President', 'us-president')).toBe('President');
    expect(officeLabel('Governor', 'or-governor')).toBe('Governor');
    expect(officeLabel('Whatever', null)).toBe('Whatever');
  });
  it('makes officeAt distinguish districts', () => {
    const o = {
      id: 'o', name: 'N', party: null, level: 'federal', photo_url: null, current: true,
      terms: [{ office_id: 'us-house-or-1', title: 'U.S. Representative', kind: 'legislator' as const, jurisdiction: 'us', district: '1', start: '2015-01-03', end: null }],
    };
    expect(officeAt(o, 'us-house-or-1')).toBe('U.S. Representative, Oregon 1st');
  });
});

describe('stateName', () => {
  it('names states, DC and territories', () => {
    expect(stateName('or')).toBe('Oregon');
    expect(stateName('NH')).toBe('New Hampshire');
    expect(stateName('dc')).toBe('District of Columbia');
    expect(stateName('as')).toBe('American Samoa');
    expect(stateName('gu')).toBe('Guam');
    expect(stateName('mp')).toBe('Northern Mariana Islands');
    expect(stateName('pr')).toBe('Puerto Rico');
    expect(stateName('vi')).toBe('U.S. Virgin Islands');
    expect(stateName('zz')).toBe('ZZ');
  });
});

describe('searchOfficials state-code ranking', () => {
  const idx: IndexRow[] = [
    row({ id: 'n1', name: 'Dorothy Smith', state: 'wa', office: 'U.S. Senator' }),
    row({ id: 'n2', name: 'Orson Jones', state: 'tx', office: 'U.S. Senator' }),
    row({ id: 'n3', name: 'Cory Booker', state: 'nj', office: 'U.S. Senator' }),
    row({ id: 'or1', name: 'Zed One', state: 'or', office: 'U.S. Senator' }),
    row({ id: 'or2', name: 'Yan Two', state: 'or', office: 'U.S. Senator' }),
    row({ id: 'or3', name: 'Xi Three', state: 'or', office: 'U.S. Representative', district: '1' }),
  ];
  it('ranks an exact state-code match above name substrings, within the limit', () => {
    expect(searchOfficials(idx, 'or', 3).map((r) => r.id)).toEqual(['or1', 'or2', 'or3']);
    expect(searchOfficials(idx, 'or').map((r) => r.id).slice(0, 3)).toEqual(['or1', 'or2', 'or3']);
  });
});
