# Write/Diary Studio Landing — Design

## Problem

`/write` and `/diary` currently each show a plain post/entry list with a
text-tab switcher (`Writing` | `Diary`) at the top. There's no at-a-glance
sense of what's in each section (how many posts, how many drafts, how many
diary entries) and no way to jump to the most recently touched item without
first picking a section and scanning its list. The switcher also doesn't
communicate that Writing is public (published posts appear at `/posts`)
while Diary is entirely private.

## Goal

Turn `/write` into a landing page for both sections: two summary cards
(Writing · Public, Diary · Private) with counts and quick-create actions,
a merged "recent across both" strip, and the existing post list unchanged
below it. `/diary` is not changed.

## Scope

- `/write` (`src/Write.tsx`) gains a new landing section above its existing
  post list.
- `/diary` (`src/Diary.tsx`) is unchanged — still the tab switcher + entry
  list as it is today.
- NavBar is unchanged — the "Write" button still points to `/write`.
- No new routes are introduced.

Out of scope: any change to the post/diary editors (`WriteEditor.tsx`,
`DiaryEditor.tsx`, `DiaryViewer.tsx`), the public `/posts` reader, or the
posts-api backend.

## Layout

Top to bottom on `/write`:

1. **NavBar** (unchanged)
2. **Studio summary row** — two cards side by side:
   - **Writing card**: "✍️ Writing" heading, a `Public` badge, post count
     and draft count (e.g. "12 posts · 2 drafts"), a "+ New Post" button
     that navigates to `/write/new`.
   - **Diary card**: "📔 Diary" heading, a `Private` badge, entry count
     (e.g. "34 entries"), a "+ New Entry" button that navigates to
     `/diary/new`. The card body is a link to `/diary`.
3. **Recent across both** — a small list (top 3) merging the most recent
   posts and diary entries by date, each row labeled with its source
   (Writing/Diary) and, for posts, its Published/Draft status. Clicking a
   row navigates to `/write/:slug` or `/diary/:slug` as appropriate.
4. **Existing post list** — unchanged from today: header row with "Your
   posts" + "+ New Post" button, then the list of post rows with
   published/draft badges and delete action.

The old text-tab switcher (`write-section-switcher`) is removed from
`/write` — the Diary card now serves as the way to get to `/diary`.
`/diary` keeps its own switcher unchanged, since it still needs a way back
to `/write`.

## Data flow

`Write.tsx` already fetches `sectionUrl('writing')` on mount once
authenticated, which gives post count and draft count (derived from the
existing `posts` state — no new fields needed).

It additionally fetches `sectionUrl('diary')` on mount (parallel with the
writing fetch) to get the diary entry count and the entries needed for the
"recent across both" merge. This is a new network call on `/write` that
doesn't exist today.

The "recent across both" list is computed client-side: take the loaded
posts and diary entries, sort by date descending, keep the top 3.

## Error handling

- If the writing fetch fails: unchanged from today — existing `error`
  state and message shown.
- If the diary fetch fails: does not block the page. The Diary card shows
  without a count (or a small inline "—" / muted note) and is omitted from
  the "recent across both" merge. The Writing card and post list still
  render normally.
- 401 on either fetch triggers `signOut()`, same as today.

## Components

- New `src/components/StudioSummary.tsx` — renders the two summary cards
  and the "recent across both" strip. Takes posts, diary entries (or
  loading/error state for diary), and the counts as props; owns no
  fetching itself. Keeps `Write.tsx` from growing into a second
  responsibility (page orchestration + landing UI).
- New styling in `src/styling/write.css` (or a new
  `src/styling/studio-summary.css`) for the card row and recent-activity
  strip, following the existing `private-theme.css` palette (card colors
  already used in `Diary.tsx`'s `CARD_COLORS`).
- `src/Write.tsx` is updated to: fetch diary data alongside writing data,
  remove the `write-section-switcher` markup, and render
  `<StudioSummary />` above the existing post list.
- `src/Diary.tsx` is unchanged.

## Testing

- Manual verification (per project convention — no existing test coverage
  for `Write.tsx`/`Diary.tsx`):
  - `/write` with posts and diary entries both present: cards show correct
    counts, recent strip shows a correct merge/order, links navigate
    correctly.
  - `/write` with no diary entries: Diary card shows "0 entries" (not
    broken/empty state).
  - `/write` with the diary fetch failing (e.g. temporarily point
    `sectionUrl` at a bad path): page still renders, Writing card and post
    list unaffected, Diary card degrades gracefully.
  - `/diary` unchanged: tab switcher still shows, links back to `/write`
    still work.
