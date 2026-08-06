# TV A and TV B Routes Design

**Date:** 2026-08-06

**Status:** Approved design, pending implementation plan

## Objective

Replace the recently added TVDLP channels and `/tv` route with two explicit display destinations: `/tvA` and `/tvB`.

## Channel Mapping

- Admin label `TV A` uses the existing `kiosk_id = "kiosk-TV"`, preserving the original TV playlist without a database migration.
- Admin label `TV B` uses `kiosk_id = "kiosk-TV-B"` as a new independent playlist.
- `TVDLP_1` and `TVDLP_2` are removed from application configuration and Admin controls.
- Existing database rows whose `kiosk_id` is `TVDLP_1` or `TVDLP_2` are not deleted or migrated; they become inaccessible from the application UI.

## Routes and Shared Display

- Add `/tvA` as an explicit page that renders the shared `TvDisplay` with `kioskId="kiosk-TV"` and `channelLabel="TV A"`.
- Add `/tvB` as an explicit page that renders the shared `TvDisplay` with `kioskId="kiosk-TV-B"` and `channelLabel="TV B"`.
- Remove `/tv` and `/tv/[channel]`. They return the framework's normal 404 response after removal.
- Keep the shared 30-second polling, error states, fullscreen control, active Row 1 query, and non-cropping 16:9 layout unchanged.

## Admin Behavior

- The Admin display list contains `TV A` and `TV B` instead of `TV`, `TVDLP_1`, and `TVDLP_2`.
- Both displays are classified as TV targets, expose Row 1 only, reset selection to Row 1, and hide display-mode controls.
- Preview maps `kiosk-TV` to `/tvA` and `kiosk-TV-B` to `/tvB`.
- Media mutations continue using the selected exact `kiosk_id`.

## Error Handling

- Supabase failures retain the shared TV display behavior and channel-specific error copy.
- Successful empty responses show the empty-playlist state.
- Unsupported and removed TV URLs rely on Next.js 404 behavior because no matching route exists.

## Verification Constraint

At the user's request, do not run automated tests, lint, TypeScript checks, browser tests, or a production build for this change. Inspect the final diff and repository status only, and do not describe the change as tested.

## Non-Goals

- Migrating or deleting existing `TVDLP_1` and `TVDLP_2` database rows
- Redirecting `/tv` to `/tvA`
- Adding arbitrary dynamic TV routes
- Changing the Supabase schema, RLS, or Storage policies
- Changing TV layout or slideshow behavior

## Acceptance Criteria

- Admin shows `TV A` and `TV B`, with no `TVDLP_1` or `TVDLP_2` options.
- `/tvA` displays active Row 1 media for `kiosk-TV`.
- `/tvB` displays active Row 1 media for `kiosk-TV-B`.
- Preview links open the correct flat route.
- `/tv` and `/tv/...` no longer resolve.
- Both displays keep the existing 16:9 TV experience.
