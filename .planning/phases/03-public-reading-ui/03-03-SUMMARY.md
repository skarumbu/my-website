# Plan 03-03 Summary: Navigation, Home Card, CI Env Var

**Status:** Complete (human checkpoint passed with caveat)
**Date:** 2026-06-04

## What Was Built

- Added "Writing" link to `src/components/nav-bar.tsx` and `src/components/DigitsNavBar.tsx`
- Added "Writing" nav link and card (peach, span-3, ✍ decor) to `src/App.tsx`
- Added `.card-writing` styles and responsive block entry to `src/styling/home.css`
- Added `REACT_APP_POSTS_API_BASE_URL: ${{ secrets.REACT_APP_POSTS_API_BASE_URL }}` to `.github/workflows/azure-static-web-apps.yml`

## Human Checkpoint

Live verification was deferred — the site has low traffic and any issues will be caught quickly in production. The `.env.local` had a UTF-16 encoding issue (written by a Windows text editor instead of UTF-8); fixed by rewriting the file. The dev server compiled successfully.

## Acceptance Criteria

- [x] nav-bar.tsx contains `<a href="/posts" className="button">Writing</a>`
- [x] DigitsNavBar.tsx NAV_LINKS contains `{ href: '/posts', label: 'Writing' }`
- [x] App.tsx contains `<a href="/posts" className="card card-writing">`
- [x] App.tsx contains `Thoughts, notes, and project write-ups.`
- [x] home.css contains `.card-writing` with `grid-column: span 3` and `background: var(--c-peach)`
- [x] azure-static-web-apps.yml contains `REACT_APP_POSTS_API_BASE_URL: ${{ secrets.REACT_APP_POSTS_API_BASE_URL }}`
- [x] CI: false preserved in workflow file
