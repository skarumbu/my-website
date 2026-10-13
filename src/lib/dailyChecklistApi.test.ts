import { isDoneOn, isActiveOn } from './dailyChecklistApi.ts';
import { ChecklistItem } from './dailyChecklistTypes.ts';

function item(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return { id: 't1', text: 'Stretch', done_dates: [], expires_after: null, ...overrides };
}

it('isDoneOn is true when the date is in done_dates', () => {
  expect(isDoneOn(item({ done_dates: ['2026-10-10', '2026-10-12'] }), '2026-10-12')).toBe(true);
});

it('isDoneOn is false when the date is absent', () => {
  expect(isDoneOn(item({ done_dates: ['2026-10-10'] }), '2026-10-12')).toBe(false);
});

it('isActiveOn recurs forever when expires_after is null', () => {
  expect(isActiveOn(item({ expires_after: null }), '2099-01-01')).toBe(true);
});

it('isActiveOn is false after the expiry date', () => {
  expect(isActiveOn(item({ expires_after: '2026-10-01' }), '2026-10-12')).toBe(false);
});

it('isActiveOn is true on the expiry date itself', () => {
  expect(isActiveOn(item({ expires_after: '2026-10-12' }), '2026-10-12')).toBe(true);
});
