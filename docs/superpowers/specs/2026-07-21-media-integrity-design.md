# Media Integrity Fixes Design

**Date:** 2026-07-21

**Status:** Approved design, pending implementation plan

## Objective

Fix four specific defects without redesigning the interface or restructuring the whole application:

1. Prevent the kiosk slideshow from rendering an out-of-range media item.
2. Treat Supabase `{ error }` results as failed mutations and restore optimistic UI state.
3. Keep the database, storage, and admin UI consistent during deletion.
4. Roll back a newly uploaded storage object when its database insert fails.

## Scope

The work keeps the existing Next.js pages and UI. It introduces a small, testable media-operation boundary and a pure slideshow-index helper. It does not add realtime status, redesign the dashboard, change the Supabase schema, or perform a broad component refactor.

The existing compatibility fallbacks for older schemas remain in place, but their failures must no longer be silently ignored.

## Architecture

Create `lib/mediaOperations.ts` for operations that coordinate Supabase database and storage calls. The module will expose typed results or throw typed operation errors only after inspecting every Supabase `{ error }` response. The Admin page will update React state only after confirmed success, or restore its previous optimistic state when a mutation fails.

Create a pure slideshow-index helper in a focused module so index behavior can be tested without rendering the complete kiosk page. The slideshow will derive a safe index before reading `items[index]`; an empty list continues to render the existing empty state.

No large component extraction is included. The existing Admin and Kiosk pages remain the consumers of the new helpers.

## Data Flow and Failure Semantics

### 1. Slideshow index safety

Before reading the current item, normalize the requested index against the current array length:

- Empty array: no current item is returned and the empty state is rendered.
- Index within range: retain it.
- Index beyond the last item: reset to the first item.
- Negative or non-finite index: reset to the first item.

When the list shrinks, React must never render `undefined` as a media item while waiting for an effect to reset state.

### 2. Supabase mutation errors

Every affected `insert`, `update`, `upsert`, `delete`, and `storage.remove` call must inspect the returned `error`. A resolved Promise containing `{ error }` is a failure.

For optimistic mutations, capture the previous value, apply the optimistic value, and restore the previous value if persistence fails. The user receives an actionable Thai error message. Successful UI state must never be shown after a failed persistence call.

### 3. Delete consistency

Deletion follows this order:

1. Query whether another media record uses the same URL.
2. Delete the selected database record.
3. If the URL is not shared, delete the storage object.
4. Remove the card from Admin state after the database deletion is confirmed.

Failure rules:

- Shared-file query fails: stop; do not delete anything.
- Database deletion fails: stop; do not change UI or storage.
- Database succeeds and storage fails: remove the card from UI because the database is authoritative, then report a partial failure with the orphaned storage filename.
- Shared URL: delete only the selected database record and retain storage.

This ordering prevents a database record from pointing to a file that was already deleted.

### 4. Upload rollback

Upload follows this order:

1. Upload the selected file to storage.
2. Obtain its public URL.
3. Insert the media record, including the current Kiosk and Row when supported.
4. If all insert attempts fail, remove the storage object uploaded in step 1.

Failure rules:

- Storage upload fails: stop before database work.
- Insert fails and rollback succeeds: report the insert error; no orphan remains.
- Insert fails and rollback also fails: report the insert error and the rollback error, including the orphaned filename.
- Insert succeeds: keep the object and refresh the media list.

Only the object created by the current upload attempt may be rolled back.

## Testing Strategy

Add Vitest as the project test runner. Tests are written before production changes and executed red-green for each defect.

Required regression coverage:

- Slideshow helper retains a valid index, resets an out-of-range index, handles an empty array, and rejects invalid numeric indices safely.
- Mutation wrapper treats returned Supabase errors as failures rather than relying on rejected Promises.
- Delete covers shared URL, shared-file query failure, database failure, storage failure after database success, and complete success.
- Upload covers storage failure, database failure with successful rollback, database failure with failed rollback, compatibility fallback success, and complete success.

After each defect, run its focused test file. After all four defects, run the full test suite, ESLint, and the production build. Completion requires all newly introduced tests to pass. Existing unrelated lint failures must either be fixed when they overlap changed lines or reported explicitly; they may not be hidden or disabled.

## User-Facing Behavior

The visual design remains unchanged. Existing controls retain their labels and placement. Error feedback remains in Thai and distinguishes:

- persistence failed and nothing changed;
- database deletion succeeded but storage cleanup failed;
- database insert failed and upload rollback failed.

No success message is shown until the relevant database operation has been confirmed.

## Non-Goals

- Dashboard redesign or responsive redesign
- Supabase schema migration or RLS policy changes
- Realtime subscriptions or online/last-sync indicators
- Full decomposition of `app/admin/page.tsx`
- Replacing every browser `alert` or `confirm` in the application
- Changing media ordering or display-mode behavior beyond correct error handling

## Acceptance Criteria

- A shrinking media list cannot crash the kiosk slideshow through an invalid index.
- A Supabase `{ error }` result cannot leave a false successful state in the affected Admin operations.
- A failed database deletion leaves both UI and storage untouched.
- A storage cleanup failure after database deletion is surfaced as a partial failure with an orphan filename.
- A failed media insert triggers removal of the exact object uploaded by that attempt.
- A rollback failure reports both the primary insert failure and cleanup failure.
- Regression tests cover all required paths and pass.
- The latest full test, lint, and build results are reported without suppressing failures.
