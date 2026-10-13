// Mirrors posts-api's daily/checklist.py ChecklistTask dataclass shape
// exactly (snake_case field names included) — no transform layer needed
// between the API response and this UI state, same convention as
// diaryTypes.ts.

export interface ChecklistItem {
  id: string;
  text: string;
  done_dates: string[];
  expires_after: string | null;
}
