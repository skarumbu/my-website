export type ActionKind =
  | 'signed'
  | 'vetoed'
  | 'line_item_veto'
  | 'pocket_veto'
  | 'law_without_signature'
  | 'executive_order'
  | 'sponsored'
  | 'cosponsored'
  | 'vote_yes'
  | 'vote_no'
  | 'vote_present'
  | 'vote_not_voting';

export const TOPICS: readonly string[] = [
  'Agriculture',
  'Budget and Taxes',
  'Civil Rights',
  'Criminal Justice',
  'Defense',
  'Economy and Labor',
  'Education',
  'Elections',
  'Energy and Environment',
  'Government Operations',
  'Health',
  'Housing',
  'Immigration',
  'Transportation',
  'Other',
];

export interface IndexRow {
  id: string;
  name: string;
  office: string | null;
  jurisdiction: string | null;
  office_id: string | null;
  state: string | null;
  district: string | null;
  level: string;
  party: string | null;
  current: boolean;
}

export interface Term {
  office_id: string;
  title: string;
  kind: 'executive' | 'legislator';
  jurisdiction: string;
  district: string | null;
  start: string;
  end: string | null;
}

export interface Official {
  id: string;
  name: string;
  party: string | null;
  level: string;
  photo_url: string | null;
  current: boolean;
  terms: Term[];
}

export interface Freshness {
  source: string;
  last_success: string | null;
  stale: boolean;
}

export interface OfficialRecord {
  official: Official;
  counts: Record<string, number>;
  freshness: Freshness[];
}

export interface Action {
  official_id: string;
  item_id: string;
  date: string;
  kind: ActionKind;
  item_title: string;
  topics: string[];
  source_url: string;
  source: string;
  office_id: string;
  is_key_vote: boolean;
  overridden_on: string | null;
  vote_ref: string | null;
}

export interface ActionPage {
  actions: Action[];
  cursor: string | null;
}

export interface LookupResult {
  federal: Official[];
  state: Official[];
}

export interface ActionQuery {
  kind?: string[];
  keyVotes?: boolean;
  topic?: string;
  from?: string;
  to?: string;
}
