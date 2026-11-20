import React from 'react';
import { isExecutive } from '../../lib/poligraphFormat.ts';
import { TOPICS } from '../../lib/poligraphTypes.ts';
import type { ActionQuery, Official, Term } from '../../lib/poligraphTypes.ts';

export type FilterState = { preset: string; topic: string; from: string; to: string };

export const DEFAULT_FILTERS: FilterState = { preset: 'default', topic: '', from: '', to: '' };

interface Preset {
  id: string;
  label: string;
  query: ActionQuery;
}

const VOTE_KINDS = ['vote_yes', 'vote_no', 'vote_present', 'vote_not_voting'];

const LEGISLATOR_PRESETS: Preset[] = [
  { id: 'default', label: 'Sponsored + key votes', query: {} },
  { id: 'sponsored', label: 'Sponsored', query: { kind: ['sponsored'] } },
  { id: 'cosponsored', label: 'Co-sponsored', query: { kind: ['cosponsored'] } },
  { id: 'key-votes', label: 'Key votes', query: { keyVotes: true } },
  { id: 'all-votes', label: 'All votes', query: { kind: VOTE_KINDS } },
];

const EXECUTIVE_PRESETS: Preset[] = [
  { id: 'default', label: 'All actions', query: {} },
  { id: 'signed', label: 'Signed', query: { kind: ['signed'] } },
  { id: 'vetoed', label: 'Vetoed', query: { kind: ['vetoed', 'line_item_veto', 'pocket_veto'] } },
  { id: 'without-signature', label: 'Became law without signature', query: { kind: ['law_without_signature'] } },
  { id: 'executive-orders', label: 'Executive orders', query: { kind: ['executive_order'] } },
];

export function presetsFor(official: Official): Preset[] {
  if (!isExecutive(official)) return LEGISLATOR_PRESETS;
  const isPresident = official.terms.some((t) => t.office_id === 'us-president');
  return EXECUTIVE_PRESETS.filter((p) => p.id !== 'executive-orders' || isPresident);
}

/** The ActionQuery for a filter state. An unknown preset id falls back to the default. */
export function queryFor(official: Official, filters: FilterState): ActionQuery {
  const preset = presetsFor(official).find((p) => p.id === filters.preset) ?? presetsFor(official)[0];
  const q: ActionQuery = { ...preset.query };
  if (filters.topic) q.topic = filters.topic;
  if (filters.from) q.from = filters.from;
  if (filters.to) q.to = filters.to;
  return q;
}

interface OfficeSpan {
  officeId: string;
  title: string;
  from: string;
  to: string;
  label: string;
}

export function officeSpans(official: Official): OfficeSpan[] {
  const byOffice = new Map<string, Term[]>();
  for (const t of official.terms) byOffice.set(t.office_id, [...(byOffice.get(t.office_id) ?? []), t]);
  const spans = Array.from(byOffice.entries()).map(([officeId, terms]) => {
    const from = terms.map((t) => t.start).sort()[0];
    const current = terms.some((t) => t.end === null);
    const to = current ? '' : terms.map((t) => t.end as string).sort().reverse()[0];
    const latest = terms.reduce((a, t) => (t.start >= a.start ? t : a), terms[0]);
    const years = `${from.slice(0, 4)}–${current ? 'present' : to.slice(0, 4)}`;
    return { officeId, title: latest.title, from, to, label: `${latest.title} (${years})` };
  });
  return spans.sort((a, b) => a.from.localeCompare(b.from));
}

interface RecordFiltersProps {
  official: Official;
  value: FilterState;
  onChange: (next: FilterState) => void;
}

const RecordFilters: React.FC<RecordFiltersProps> = ({ official, value, onChange }) => {
  const presets = presetsFor(official);
  const activePreset = presets.some((p) => p.id === value.preset) ? value.preset : 'default';
  const spans = officeSpans(official);
  const selectedOffice = spans.find((s) => s.from === value.from && s.to === value.to)?.officeId ?? '';

  const set = (patch: Partial<FilterState>) => onChange({ ...value, preset: activePreset, ...patch });

  return (
    <div className="poligraph-filters">
      <div className="poligraph-presets" role="group" aria-label="Show">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            className="poligraph-preset"
            aria-pressed={p.id === activePreset}
            onClick={() => set({ preset: p.id })}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="poligraph-filter-fields">
        <div>
          <label htmlFor="pg-topic">Topic</label>
          <select id="pg-topic" value={value.topic} onChange={(e) => set({ topic: e.target.value })}>
            <option value="">All topics</option>
            {TOPICS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pg-from">From</label>
          <input id="pg-from" type="date" value={value.from} onChange={(e) => set({ from: e.target.value })} />
        </div>
        <div>
          <label htmlFor="pg-to">To</label>
          <input id="pg-to" type="date" value={value.to} onChange={(e) => set({ to: e.target.value })} />
        </div>
        {spans.length >= 2 && (
          <div>
            <label htmlFor="pg-office">Office</label>
            <select
              id="pg-office"
              value={selectedOffice}
              onChange={(e) => {
                const span = spans.find((s) => s.officeId === e.target.value);
                set({ from: span?.from ?? '', to: span?.to ?? '' });
              }}
            >
              <option value="">All offices</option>
              {spans.map((s) => (
                <option key={s.officeId} value={s.officeId}>{s.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordFilters;
