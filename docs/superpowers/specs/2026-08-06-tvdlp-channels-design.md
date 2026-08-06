# TVDLP Display Channels Design

**Date:** 2026-08-06

**Status:** Approved design, pending implementation plan

## Objective

Add two independent TV display channels, `TVDLP_1` and `TVDLP_2`, without changing or removing the existing `kiosk-TV` channel. Each new channel has its own Admin media set and dedicated display URL while sharing the existing TV slideshow behavior and 16:9 presentation.

## Architecture

- Add `TVDLP_1` and `TVDLP_2` to the Admin display list, storing these exact values in `media_items.kiosk_id`.
- Add a dynamic route at `/tv/[channel]` for the two new channels.
- Allow only `TVDLP_1` and `TVDLP_2` through the dynamic route. Unsupported channel values return a Next.js 404 response.
- Extract the current TV page behavior into a shared TV display component. The existing `/tv` route renders that component with `kiosk-TV`; the dynamic route renders it with its validated channel value.
- Centralize the supported TV channel identifiers and their route mapping so Admin behavior, preview links, row restrictions, and display routing use the same definitions.
- Keep the existing Supabase schema and storage behavior.

## Admin Behavior

The Admin display switcher includes the existing displays plus `TVDLP_1` and `TVDLP_2`. Their visible labels match those identifiers exactly.

All three TV-type channels—`kiosk-TV`, `TVDLP_1`, and `TVDLP_2`—use TV restrictions:

- Row 1 is the only available upload and workspace row.
- Selecting a TV-type channel resets the selected upload row to Row 1.
- The `3 แถว` and `หน้าเดี่ยว` mode controls are hidden.
- Media-mode filters that do not apply to a single-row TV are hidden through the existing TV workspace behavior.

The Preview destination is determined from the selected channel:

- `kiosk-TV` opens `/tv`.
- `TVDLP_1` opens `/tv/TVDLP_1`.
- `TVDLP_2` opens `/tv/TVDLP_2`.
- Non-TV kiosks continue to open `/`.

Uploads, library insertion, deletion, activation, duration changes, and ordering continue to use the existing media-integrity operations. Their `kiosk_id` is the exact selected channel identifier.

## TV Data Flow

The shared TV display receives a validated `kioskId` and a human-readable channel label. Every 30 seconds it queries `media_items` using all of these constraints:

- `kiosk_id` equals the supplied channel identifier;
- `row_slot` equals `1`;
- `is_active` equals `true`.

Results are ordered by `sort_order`, then `created_at`. Missing durations default to 10 seconds, and missing sort positions fall back to the result index. Images use the configured duration; videos advance when playback ends.

Each successful response replaces the current channel playlist. A failed refresh preserves the last known playlist. If no prior media exists, the page distinguishes loading, empty, and query-failure states and includes the selected channel label in its status text.

## Display Layout

`/tv`, `/tv/TVDLP_1`, and `/tv/TVDLP_2` use the same existing silent-cinema TV presentation:

- one centered 16:9 media frame;
- black letterboxing when the viewport is not 16:9;
- `object-fit: contain` so media is never cropped or stretched;
- one full-screen slideshow using Row 1;
- the existing transient fullscreen control;
- no kiosk selector or display-mode controls.

No new visual system or Admin redesign is introduced.

## Error Handling

- An unsupported `/tv/[channel]` value returns 404 before rendering the TV display.
- A Supabase query error shows the existing TV error treatment with the relevant channel name when there is no cached playlist.
- A successful empty result shows an empty-playlist state rather than an error.
- Admin mutations retain their existing rollback and alert behavior.

## Testing

- Add unit coverage for the centralized TV-channel classification and route mapping.
- Verify `kiosk-TV`, `TVDLP_1`, and `TVDLP_2` expose Row 1 only, while standard kiosks retain all three rows.
- Verify the Admin switcher renders the two new labels and hides display-mode controls for each TV-type channel.
- Verify Preview links resolve to `/tv`, `/tv/TVDLP_1`, and `/tv/TVDLP_2` as specified.
- Verify dynamic route parsing accepts the two supported channels and rejects other values.
- Verify the shared TV display builds the existing active Row 1 query for the supplied channel.
- Run the complete automated test suite, lint, and production build.

## Non-Goals

- Removing or renaming `kiosk-TV`
- Supporting arbitrary dynamic TV channel names
- Adding database tables, columns, migrations, RLS policies, or storage policies
- Adding three-row or single-mode switching to TV channels
- Adding scheduling, analytics, or playlist sharing between channels
- Redesigning the Admin or TV interfaces

## Acceptance Criteria

- Admin offers `TVDLP_1` and `TVDLP_2` in addition to all existing displays.
- Media managed under each new channel remains independent through its exact `kiosk_id`.
- Both new channels expose Row 1 only and omit display-mode controls.
- `/tv/TVDLP_1` renders only active Row 1 media assigned to `TVDLP_1`.
- `/tv/TVDLP_2` renders only active Row 1 media assigned to `TVDLP_2`.
- `/tv` continues rendering `kiosk-TV` media unchanged.
- Unsupported dynamic TV channel URLs return 404.
- All three TV pages share the same 16:9, non-cropping slideshow behavior.
