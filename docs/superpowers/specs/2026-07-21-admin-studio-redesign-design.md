# Admin Studio Redesign Design

**Date:** 2026-07-21

**Status:** Approved

## Objective

Redesign the Admin page as a modern, responsive, single-page workspace that makes uploading, ordering, moving, activating, timing, previewing, and deleting media equally easy. Preserve the existing Supabase schema and mutation behavior.

## Audience and Job

The primary user is a staff member managing library display media from desktop, tablet, or mobile. The page has one job: let staff understand the selected display and complete any routine media-management task without hunting through a long dashboard.

## Design Direction

The visual direction is **Digital Media Catalog**: a bright, quiet workspace inspired by a library media desk and contact sheet rather than a generic analytics dashboard.

### Color Tokens

- Canvas: `#F4F7FB`
- Paper: `#FFFFFF`
- Library Ink: `#172033`
- MSU Blue: `#2457D6`
- Catalog Line: `#DCE3EE`
- Active Green: `#16856A`
- Alert Red: `#C93F4A`
- Row 1: `#2457D6`
- Row 2: `#7B4BC9`
- Row 3: `#16856A`

Status colors communicate state and are not used as decoration. Row colors appear as restrained rails, markers, or focus accents so thumbnails remain visually dominant.

### Typography

- Anuphan remains the display and body face, using weight and scale to establish hierarchy.
- The native monospace stack is reserved for kiosk identifiers, media order, and duration values.
- Interface text uses plain Thai verbs and consistent action names.

### Signature Element

The signature element is the **Contact Sheet Order Rail**. Every media card exposes a clear sequence number such as `01`, `02`, or `03`, paired with a narrow Row-colored rail. During reordering, the lifted card and insertion target make the sequence change explicit.

This signature is specific to the real playlist-ordering task. Other surfaces remain visually restrained.

## Information Architecture

The Admin remains one page with three persistent layers:

1. A sticky global header with product identity, selected-display context, preview, and logout.
2. A sticky display toolbar with the kiosk selector and display-mode control where applicable.
3. A Studio Workspace containing the upload panel and media workspace.

```text
┌─────────────────────────────────────────────────────────┐
│ Media Studio       Selected display     Preview  Logout │
├─────────────────────────────────────────────────────────┤
│ Kiosk 1 · Kiosk 2 · Kiosk 3 · Space · TV   Mode switch │
├──────────────────┬──────────────────────────────────────┤
│ Add media        │ Media in selected display            │
│                  │ All · Row 1 · Row 2 · Row 3          │
│ Drop file        │                                      │
│ Choose Row       │ Responsive contact-sheet grid        │
│ Set duration     │ Reorder · move · activate · delete   │
│ Add media        │                                      │
│ Media library    │                                      │
└──────────────────┴──────────────────────────────────────┘
```

## Responsive Layout

### Desktop

- The upload panel occupies a compact sticky left column.
- The media workspace occupies the flexible main column.
- The kiosk selector remains visible while scrolling through media.
- The grid expands with available width without making cards excessively wide.

### Tablet

- The two-column layout remains while space permits, with a narrower upload panel.
- Controls wrap intentionally and retain touch targets of approximately 44px.
- The kiosk selector can scroll horizontally without wrapping into multiple ambiguous rows.

### Mobile

- The page becomes a single column in this order: header, kiosk selector, compact upload panel, Row filter, media cards.
- Preview and logout remain directly reachable.
- Every media action is visible or available from a clearly labeled action menu; no action depends on hover.
- Drag-and-drop enhancement remains available where the browser supports it, while the existing move-to-Row buttons provide a touch-safe alternative.

## Component Architecture

The existing `app/admin/page.tsx` continues to own authentication, Supabase data, mutation orchestration, optimistic rollback, and drag state. Presentation is split into focused components under `components/admin/`:

- `AdminHeader`: identity, current-display context, preview, and logout.
- `ScreenSwitcher`: kiosk selection, per-kiosk media count, and display mode.
- `UploadPanel`: file selection, drag and drop, Row, image duration, upload progress, and library entry point.
- `MediaWorkspace`: Row filters, counts, saving-order feedback, and Row groups.
- `MediaCard`: thumbnail, sequence, type, status, duration, mode filter, Row movement, and delete action.
- `MediaLibraryModal`: browsing and inserting existing media into the selected display and Row.

Shared interfaces and small display-only helpers live beside these components. Database operations remain in the current mutation layer; visual components do not call Supabase directly.

Styling moves to a dedicated Admin CSS module or equivalently scoped Admin stylesheet. The implementation must avoid adding another large set of inline styles to `page.tsx`.

## Core Workflows

### Select a Display

- Selecting a kiosk updates the active context without leaving the page.
- The toolbar exposes media count and the correct preview destination.
- Standard kiosks expose `3 แถว` and `หน้าเดี่ยว` modes.
- `kiosk-TV` forces Row 1, hides display-mode controls, and previews `/tv`.

### Upload Media

- The upload panel remains visible on desktop and appears before media on mobile.
- Staff select a file, target Row, and image duration before choosing `เพิ่มสื่อ`.
- Video media does not imply that image duration controls affect playback.
- Progress is shown in the panel without blocking unrelated browsing.
- `เลือกจากคลังสื่อ` opens the redesigned library modal.

### Browse and Filter Media

- The default filter is `ทั้งหมด` so staff can see the whole selected display.
- Row chips filter the workspace locally without changing stored data.
- `kiosk-TV` exposes only Row 1 and omits unnecessary Row filters.
- Counts remain visible for orientation.

### Order and Move Media

- Each card displays its one-based order number in the Contact Sheet Order Rail.
- Dragging within a Row shows the lifted source and exact insertion target.
- Dragging across Rows shows eligible Row drop targets.
- Existing explicit Row move buttons remain available for touch and keyboard users.
- Saving-order feedback is persistent but does not cover content.

### Edit Media

- Active status, image duration, display-mode filter, and delete are clearly labeled.
- Core actions do not rely on hover.
- TV cards omit the irrelevant display-mode filter.
- Delete retains explicit confirmation.

## Feedback, Empty, and Error States

- Initial authentication/loading uses a restrained full-page state.
- Content refreshes use local skeletons or progress indicators instead of replacing the entire page.
- Upload and order-saving states appear next to the affected control.
- Mutation failures retain the existing rollback behavior and show a clear message near the action or in a consistent notification region.
- Empty Row states say that no media has been added and point staff toward the upload panel.
- Broken thumbnails retain an explicit unavailable-file state and do not collapse card controls.
- Focus styles are clearly visible on the light canvas.
- Motion respects `prefers-reduced-motion`.

## Data and Behavior Preservation

The redesign does not change:

- Supabase tables or columns;
- authentication and logout behavior;
- upload/storage paths;
- optimistic mutation and rollback guarantees;
- image duration rules;
- active/inactive semantics;
- display-mode filtering;
- media-library insertion behavior;
- drag ordering and cross-Row movement;
- TV Row 1 restrictions;
- preview routes.

Any behavior change discovered as necessary during implementation must return to the user for approval rather than being hidden inside the visual redesign.

## Accessibility

- Interactive controls use semantic buttons, links, labels, and dialogs.
- All controls have visible keyboard focus.
- Pointer targets are approximately 44px where layout permits.
- Icon-only controls receive accessible names and tooltips where useful.
- Status is not communicated by color alone.
- The library modal traps focus, closes predictably, and restores focus to its trigger.
- Responsive layouts preserve every core action.

## Verification

Implementation verification will include, where the environment supports it:

- lint and production build;
- desktop, tablet, and mobile layout inspection;
- kiosk switching, including TV restrictions;
- upload controls and progress states;
- Row filtering;
- reorder and cross-Row movement;
- activation, duration, mode filter, and delete controls;
- media library modal behavior;
- keyboard focus and reduced-motion behavior;
- empty, loading, broken-thumbnail, and mutation-error states.

Results must be reported from fresh verification output. Any flow not verified must be identified explicitly for manual testing.

## Non-Goals

- Database or RLS changes
- New analytics or reporting
- Scheduling, calendars, or playlists
- Bulk editing
- A new authentication model
- Redesigning the public kiosk or TV presentation pages
- Changing existing media-management rules

## Acceptance Criteria

- The Admin presents a bright, modern Digital Media Catalog workspace.
- Upload and media-management tasks are simultaneously discoverable on desktop.
- Every existing management function remains reachable on desktop, tablet, and mobile.
- Staff can identify the selected kiosk, Row, media status, duration, and playlist order at a glance.
- Cards expose meaningful controls without requiring hover.
- Reordering clearly communicates source, target, and resulting sequence.
- `kiosk-TV` continues to expose only relevant Row 1 behavior.
- Presentation is decomposed into focused Admin components without moving Supabase calls into visual components.
- No schema changes or unrelated features are introduced.
