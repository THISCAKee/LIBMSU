# TV Display 16:9 Design

**Date:** 2026-07-21

**Status:** Approved design, pending implementation plan

## Objective

Add a dedicated `/tv` display for a 16:9 television. The page uses an independent `kiosk-TV` media set and presents one full-screen slideshow without the three-row layout or kiosk-selection controls.

## Audience and Job

The audience is visitors viewing a shared television display. The page has one job: continuously present the media assigned to `kiosk-TV` at a stable 16:9 ratio without cropping or visible administration controls.

## Architecture

- Add `app/tv/page.tsx` as a client display route fixed to `kiosk-TV`.
- Reuse the existing slideshow behavior by moving the reusable slideshow and media type into a focused component/module rather than duplicating timer and video logic.
- Add `kiosk-TV` to the Admin kiosk list.
- Treat TV as a single-row target: Admin uses Row 1 only and hides the display-mode controls and Row 2/3 sections while TV is selected.
- Keep the existing Supabase schema. TV media uses `kiosk_id = "kiosk-TV"` and `row_slot = 1`.

## TV Data Flow

The TV route polls every 30 seconds. It selects media matching all of these conditions:

- `kiosk_id` is `kiosk-TV`;
- `row_slot` is `1`;
- `is_active` is not false.

Results are ordered by `sort_order`, then `created_at`. Images advance using their configured `duration`. Videos advance on `ended`. The existing safe slide-index behavior remains in use when the media list changes.

The route distinguishes three states:

- Loading: a quiet centered loading indicator.
- Empty: `ยังไม่มีสื่อสำหรับ TV`.
- Query failure: `ไม่สามารถโหลดสื่อสำหรับ TV`.

An empty result is not presented as a connection failure.

## TV Layout

The media frame remains exactly 16:9 and is centered inside the available viewport. A 16:9 TV fills the viewport. Other viewport shapes receive black letterboxing without stretching the media.

```text
┌──────────────────────── viewport ────────────────────────┐
│                                                         │
│     ┌──────────── fixed 16:9 media frame ───────────┐    │
│     │                                                │    │
│     │             image or video                    │    │
│     │              contain fit                      │    │
│     │                                                │    │
│     └────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Images and videos use `object-fit: contain`; the page never crops source media. The page retains the current crossfade and fullscreen affordance but does not render a kiosk selector or display-mode control.

## Visual System

The direction is a silent cinema frame: the content is the signature and the interface recedes completely.

- Canvas Black: `#000000`
- Frame Black: `#050505`
- Status White: `#F8FAFC`
- Muted Slate: `#94A3B8`
- Error Red: `#EF4444`

Anuphan remains the utility typeface for loading, empty, and error messages. Media carries the visual identity; no additional decorative typography, gradients, badges, or dashboard styling are added to the TV page.

## Admin Behavior

- Add `kiosk-TV` to the kiosk selector.
- Selecting TV immediately sets `selectedRow` to Row 1.
- Hide the 3-row/single display-mode toggle for TV.
- Hide Row 2 and Row 3 media sections for TV.
- The upload controls show only Row 1 for TV.
- The preview link opens `/tv` when TV is selected and `/` for every other kiosk.
- Media upload, library insertion, deletion, activation, duration, and ordering continue to use the existing integrity operations.

## Error Handling

Supabase query errors on `/tv` set the query-failure state and preserve the last known media until a later successful poll replaces it. A successful empty response clears the media and shows the empty state.

Admin mutations retain the existing error and rollback behavior. No new database or storage mutation path is introduced by the TV route.

## Verification Constraint

At the user's request, implementation will not run automated tests, browser tests, or a production build. The user will manually verify the route and Admin behavior. Code changes must not be described as tested or verified.

## Non-Goals

- A separate TV database table
- A three-row TV mode
- Cropping media to fill the screen
- TV-specific scheduling or playlists
- Responsive redesign of the Admin dashboard
- Changes to RLS or Storage policies

## Acceptance Criteria

- `/tv` renders only active Row 1 media assigned to `kiosk-TV`.
- The media frame maintains 16:9 without cropping.
- TV uses one slideshow and preserves the existing image/video timing behavior.
- Loading, empty, and query-failure states are distinct.
- Admin can select `kiosk-TV`, upload/manage Row 1 media, and open `/tv` as its preview.
- TV selection does not expose Row 2/3 or the display-mode toggle.
- No tests or build commands are run during implementation.
