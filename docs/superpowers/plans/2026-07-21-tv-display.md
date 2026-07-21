# TV Display 16:9 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `/tv` route and Admin target for a single-row `kiosk-TV` slideshow constrained to 16:9.

**Architecture:** Extract the existing slideshow into a reusable client component, consume it from the current Kiosk and the new TV route, and specialize Admin controls when `kiosk-TV` is selected. Keep the current Supabase schema and media-integrity operations.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Supabase JS 2, existing CSS

## Global Constraints

- Preserve existing Kiosk behavior and visual styling.
- `/tv` uses only `kiosk_id = "kiosk-TV"`, Row 1, and active media.
- TV is single-page only; Admin hides display-mode and Row 2/3 controls for TV.
- Media uses `object-fit: contain` inside a centered 16:9 frame.
- Distinguish loading, empty, and query-failure states.
- Do not change the database schema, RLS, or Storage policies.
- At the user's request, do not run automated tests, browser tests, lint, TypeScript checks, or a production build. The user performs verification.
- This workspace has no Git metadata. Do not initialize Git or claim a commit.

---

### Task 1: Extract the reusable slideshow

**Files:**
- Create: `components/MediaSlideshow.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: exported `MediaItem` interface and `MediaSlideshow({ items, emptyMessage })`
- Consumes: `normalizeSlideIndex()` from `lib/slideshow.ts`

- [ ] Move `CROSSFADE_MS`, `SlidePhase`, the `MediaItem` interface, and the current `RowSlideshow` implementation into `components/MediaSlideshow.tsx`.
- [ ] Rename the exported component to `MediaSlideshow` and add optional `emptyMessage = "ยังไม่มีสื่อในช่องนี้"`.
- [ ] Keep image duration, video `ended`, video error advance, safe index, crossfade, dots, and timer cleanup unchanged.
- [ ] Import `MediaItem` and `MediaSlideshow` into `app/page.tsx`.
- [ ] Replace both `RowSlideshow` usages with `MediaSlideshow` and remove the duplicated implementation from the page.

No verification command is run. Review only that the old page references the exported component and retains its existing props.

---

### Task 2: Add the dedicated TV route

**Files:**
- Create: `app/tv/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `MediaItem` and `MediaSlideshow`
- Produces: `/tv` route fixed to `kiosk-TV`

- [ ] Create a client page with `mediaList`, `loading`, `loadError`, fullscreen state, and container ref.
- [ ] Fetch `media_items` where `kiosk_id = "kiosk-TV"` and `row_slot = 1`, ordered by `sort_order` and `created_at`.
- [ ] Normalize `is_active`, `duration`, and `sort_order`; filter only entries whose `is_active !== false`.
- [ ] On query success, replace the media list and clear `loadError`; on query failure, retain the last list and set `loadError`.
- [ ] Run the fetch on mount and every 30 seconds, clearing the interval on unmount.
- [ ] Render loading only before the first result, query failure only when there is no retained media, and `ยังไม่มีสื่อสำหรับ TV` for a successful empty response.
- [ ] Render `MediaSlideshow` inside `.tv-display-frame` and reuse the existing fullscreen button without kiosk-selection controls.
- [ ] Add `.tv-display-page`, `.tv-display-frame`, `.tv-display-state`, and `.tv-display-error` styles. Center a frame sized with `min(100vw, 100dvh × 16/9)` and `min(100dvh, 100vw × 9/16)` so the frame always remains 16:9.

No verification command is run. The user will open `/tv` and validate the output manually.

---

### Task 3: Add `kiosk-TV` Admin behavior

**Files:**
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: existing Admin media CRUD and ordering handlers
- Produces: TV-specific Admin target using Row 1 only

- [ ] Add `"kiosk-TV"` to the Admin `KIOSK_LIST`.
- [ ] Derive `isTvKiosk = selectedKiosk === "kiosk-TV"` and `visibleRows = isTvKiosk ? [1] : [1, 2, 3]` with the existing row union type.
- [ ] When selecting `kiosk-TV`, set `selectedRow` to `1` before loading its display settings.
- [ ] Change the preview link to `/tv` for TV and `/` for other kiosk selections.
- [ ] Hide the complete display-mode toggle block while TV is selected.
- [ ] Use `visibleRows` for the upload Row selector and Row media sections so Row 2/3 cannot be selected or managed for TV.
- [ ] Keep upload, library, delete, activation, duration, and reorder handlers unchanged.

No verification command is run. The user will manually check the Admin selector, Row 1 restriction, preview link, upload, and playback.

---

### Task 4: Manual-test handoff

**Files:**
- Review only: `components/MediaSlideshow.tsx`
- Review only: `app/page.tsx`
- Review only: `app/tv/page.tsx`
- Review only: `app/admin/page.tsx`
- Review only: `app/globals.css`

**Interfaces:**
- Consumes: Tasks 1-3
- Produces: a concise list of unverified changes and manual scenarios

- [ ] Report every file created or modified.
- [ ] State explicitly that no tests, lint, build, or browser verification were run.
- [ ] Give the user this manual sequence: select `KIOSK-TV` in Admin, upload a Row 1 image/video, open preview, confirm `/tv`, resize the viewport, verify black letterboxing and no cropping, toggle active state, reorder items, and wait for the 30-second refresh.
