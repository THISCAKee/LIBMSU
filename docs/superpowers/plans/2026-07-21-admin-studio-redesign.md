# Admin Studio Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the existing Admin UI as a bright, responsive Digital Media Catalog workspace while preserving every existing Supabase mutation and TV restriction.

**Architecture:** Keep authentication, data fetching, mutations, optimistic rollback, and drag orchestration in `app/admin/page.tsx`. Extract typed, presentation-only components under `components/admin/`, derive filter/count/order display through pure helpers, and centralize the visual system in one CSS module shared by the Admin components.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, CSS Modules, Supabase JS 2, Vitest 4

## Global Constraints

- Preserve the existing Supabase schema, RLS assumptions, storage paths, authentication flow, and mutation functions.
- Preserve image duration, active state, display-mode filter, library insertion, delete confirmation, drag ordering, cross-Row movement, and optimistic rollback behavior.
- `kiosk-TV` uses Row 1 only, hides display-mode controls and media mode filters, and previews `/tv`.
- Use Anuphan for display/body text and the native monospace stack only for kiosk IDs, order values, and durations.
- Use the approved palette exactly: Canvas `#F4F7FB`, Paper `#FFFFFF`, Library Ink `#172033`, MSU Blue `#2457D6`, Catalog Line `#DCE3EE`, Active Green `#16856A`, Alert Red `#C93F4A`.
- Core actions must not depend on hover; visible keyboard focus, approximately 44px touch targets, reduced-motion support, and responsive parity are required.
- Do not add dependencies or change the public kiosk, TV page, database schema, analytics, scheduling, bulk editing, or authentication model.
- This workspace is not currently a Git repository. Do not run commit commands unless the user supplies or initializes one.

---

### Task 1: Add the typed Admin view model and pure derivation helpers

**Files:**
- Create: `components/admin/types.ts`
- Create: `lib/adminView.ts`
- Create: `lib/adminView.test.ts`

**Interfaces:**
- Produces `RowSlot`, `ModeFilter`, `DisplayMode`, `MediaRowFilter`, and `AdminMediaItem` for all later Admin components.
- Produces `visibleRowsForKiosk()`, `filterMediaForWorkspace()`, `countMediaByKiosk()`, `uniqueLibraryMedia()`, and `formatOrderNumber()`.

- [ ] **Step 1: Write failing helper tests**

```ts
import { describe, expect, it } from "vitest";
import {
  countMediaByKiosk,
  filterMediaForWorkspace,
  formatOrderNumber,
  uniqueLibraryMedia,
  visibleRowsForKiosk,
} from "./adminView";
import type { AdminMediaItem } from "@/components/admin/types";

const media = (overrides: Partial<AdminMediaItem>): AdminMediaItem => ({
  id: overrides.id ?? 1,
  url: overrides.url ?? "https://example.com/a.jpg",
  type: overrides.type ?? "image",
  duration: overrides.duration ?? 10,
  row_slot: overrides.row_slot ?? 1,
  is_active: overrides.is_active ?? true,
  kiosk_id: overrides.kiosk_id ?? "kiosk-1",
  sort_order: overrides.sort_order ?? 0,
  display_mode_filter: overrides.display_mode_filter ?? "both",
});

describe("admin view helpers", () => {
  it("restricts TV to Row 1", () => {
    expect(visibleRowsForKiosk("kiosk-TV")).toEqual([1]);
    expect(visibleRowsForKiosk("kiosk-1")).toEqual([1, 2, 3]);
  });

  it("filters by kiosk and optional Row", () => {
    const items = [
      media({ id: 1, row_slot: 1 }),
      media({ id: 2, row_slot: 2 }),
      media({ id: 3, kiosk_id: "kiosk-2", row_slot: 1 }),
    ];
    expect(filterMediaForWorkspace(items, "kiosk-1", "all").map((x) => x.id)).toEqual([1, 2]);
    expect(filterMediaForWorkspace(items, "kiosk-1", 2).map((x) => x.id)).toEqual([2]);
  });

  it("counts media by kiosk", () => {
    const items = [media({ id: 1 }), media({ id: 2 }), media({ id: 3, kiosk_id: "kiosk-TV" })];
    expect(countMediaByKiosk(items)).toEqual({ "kiosk-1": 2, "kiosk-TV": 1 });
  });

  it("deduplicates library media by URL", () => {
    const items = [media({ id: 1 }), media({ id: 2 }), media({ id: 3, url: "https://example.com/b.jpg" })];
    expect(uniqueLibraryMedia(items).map((x) => x.id)).toEqual([1, 3]);
  });

  it("formats one-based playlist order", () => {
    expect(formatOrderNumber(0)).toBe("01");
    expect(formatOrderNumber(11)).toBe("12");
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the red state**

Run: `npm test -- lib/adminView.test.ts`

Expected: FAIL because `components/admin/types.ts` and `lib/adminView.ts` do not exist.

- [ ] **Step 3: Add shared Admin types**

```ts
// components/admin/types.ts
export type RowSlot = 1 | 2 | 3;
export type ModeFilter = "both" | "3row" | "single";
export type DisplayMode = "3row" | "single";
export type MediaRowFilter = "all" | RowSlot;

export interface AdminMediaItem {
  id: number;
  url: string;
  type: "image" | "video";
  duration: number;
  row_slot: RowSlot;
  is_active: boolean;
  kiosk_id: string;
  sort_order: number;
  display_mode_filter: ModeFilter;
}
```

- [ ] **Step 4: Implement the pure helpers**

```ts
// lib/adminView.ts
import type {
  AdminMediaItem,
  MediaRowFilter,
  RowSlot,
} from "@/components/admin/types";

const ALL_ROWS: RowSlot[] = [1, 2, 3];

export function visibleRowsForKiosk(kioskId: string): RowSlot[] {
  return kioskId === "kiosk-TV" ? [1] : [...ALL_ROWS];
}

export function filterMediaForWorkspace(
  items: AdminMediaItem[],
  kioskId: string,
  row: MediaRowFilter,
): AdminMediaItem[] {
  return items.filter(
    (item) =>
      item.kiosk_id === kioskId && (row === "all" || item.row_slot === row),
  );
}

export function countMediaByKiosk(
  items: AdminMediaItem[],
): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[item.kiosk_id] = (counts[item.kiosk_id] ?? 0) + 1;
    return counts;
  }, {});
}

export function uniqueLibraryMedia(
  items: AdminMediaItem[],
): AdminMediaItem[] {
  return Array.from(new Map(items.map((item) => [item.url, item])).values());
}

export function formatOrderNumber(zeroBasedIndex: number): string {
  return String(zeroBasedIndex + 1).padStart(2, "0");
}
```

- [ ] **Step 5: Run the focused test and confirm the green state**

Run: `npm test -- lib/adminView.test.ts`

Expected: 5 tests pass with exit code 0.

---

### Task 2: Establish the Digital Media Catalog shell

**Files:**
- Create: `components/admin/AdminStudio.module.css`
- Create: `components/admin/AdminHeader.tsx`
- Create: `components/admin/ScreenSwitcher.tsx`

**Interfaces:**
- Consumes `DisplayMode` from Task 1.
- Produces the sticky header and kiosk toolbar used by `app/admin/page.tsx` in Task 6.

- [ ] **Step 1: Create the header component**

```tsx
// components/admin/AdminHeader.tsx
import styles from "./AdminStudio.module.css";

interface AdminHeaderProps {
  selectedKiosk: string;
  isTvKiosk: boolean;
  previewHref: string;
  onLogout: () => void;
}

export function AdminHeader({
  selectedKiosk,
  isTvKiosk,
  previewHref,
  onLogout,
}: AdminHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.brandBlock}>
        <span className={styles.brandMark} aria-hidden="true">MS</span>
        <div>
          <p className={styles.eyebrow}>LIBMSU DISPLAY SYSTEM</p>
          <h1 className={styles.pageTitle}>Media Studio</h1>
        </div>
      </div>
      <div className={styles.headerContext}>
        <div className={styles.currentScreen}>
          <span>กำลังจัดการ</span>
          <strong>{selectedKiosk.toUpperCase()}</strong>
          <small>{isTvKiosk ? "TV 16:9" : "Kiosk display"}</small>
        </div>
        <a className={styles.secondaryButton} href={previewHref} target="_blank" rel="noreferrer">
          ดูตัวอย่าง
        </a>
        <button className={styles.ghostButton} type="button" onClick={onLogout}>
          ออกจากระบบ
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create the kiosk and mode switcher**

```tsx
// components/admin/ScreenSwitcher.tsx
import type { DisplayMode } from "./types";
import styles from "./AdminStudio.module.css";

interface ScreenSwitcherProps {
  kiosks: readonly string[];
  selectedKiosk: string;
  mediaCounts: Record<string, number>;
  displayMode: DisplayMode;
  isSavingMode: boolean;
  onSelectKiosk: (kioskId: string) => void;
  onSelectMode: (mode: DisplayMode) => void;
}

export function ScreenSwitcher(props: ScreenSwitcherProps) {
  const isTv = props.selectedKiosk === "kiosk-TV";
  return (
    <section className={styles.screenToolbar} aria-label="เลือกจอแสดงผล">
      <div className={styles.screenList} role="list">
        {props.kiosks.map((kiosk) => (
          <button
            key={kiosk}
            type="button"
            className={kiosk === props.selectedKiosk ? styles.screenActive : styles.screenButton}
            aria-pressed={kiosk === props.selectedKiosk}
            onClick={() => props.onSelectKiosk(kiosk)}
          >
            <span>{kiosk.replace("kiosk-", "Kiosk ")}</span>
            <strong>{props.mediaCounts[kiosk] ?? 0}</strong>
          </button>
        ))}
      </div>
      {!isTv && (
        <div className={styles.modeSwitch} aria-label="โหมดแสดงผล">
          {(["3row", "single"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={props.displayMode === mode}
              disabled={props.isSavingMode}
              onClick={() => props.onSelectMode(mode)}
            >
              {mode === "3row" ? "3 แถว" : "หน้าเดี่ยว"}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Add the shared shell and token styles**

Implement `AdminStudio.module.css` with these required selectors and values:

```css
.page {
  --canvas: #f4f7fb;
  --paper: #ffffff;
  --ink: #172033;
  --blue: #2457d6;
  --line: #dce3ee;
  --green: #16856a;
  --red: #c93f4a;
  min-height: 100dvh;
  background: var(--canvas);
  color: var(--ink);
}

.header {
  position: sticky;
  top: 0;
  z-index: 50;
  min-height: 76px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 14px clamp(16px, 4vw, 48px);
  background: rgba(255, 255, 255, 0.94);
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(16px);
}

.screenToolbar {
  position: sticky;
  top: 76px;
  z-index: 40;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px clamp(16px, 4vw, 48px);
  background: var(--paper);
  border-bottom: 1px solid var(--line);
}

.screenList { display: flex; gap: 8px; overflow-x: auto; }
.screenButton, .screenActive { min-height: 44px; border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; }
.screenActive { color: #fff; background: var(--blue); border-color: var(--blue); }
.workspace { width: min(1480px, 100%); margin: 0 auto; padding: 28px clamp(16px, 4vw, 48px) 64px; display: grid; grid-template-columns: minmax(280px, 340px) minmax(0, 1fr); gap: 28px; }

button:focus-visible, a:focus-visible, input:focus-visible {
  outline: 3px solid rgba(36, 87, 214, 0.3);
  outline-offset: 2px;
}

@media (max-width: 760px) {
  .header { position: relative; align-items: flex-start; }
  .headerContext { flex-wrap: wrap; justify-content: flex-end; }
  .screenToolbar { top: 0; align-items: stretch; flex-direction: column; }
  .workspace { grid-template-columns: 1fr; padding-top: 18px; }
}

@media (prefers-reduced-motion: reduce) {
  .page *, .page *::before, .page *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

Add the remaining component selectors referenced by the JSX using the same tokens. Use `clamp()` for page spacing, no decorative gradients, and no status color without adjacent text.

- [ ] **Step 4: Run static verification**

Run: `npm run lint -- components/admin/AdminHeader.tsx components/admin/ScreenSwitcher.tsx`

Expected: exit code 0 and no lint errors in the two components.

---

### Task 3: Build the sticky upload panel

**Files:**
- Create: `components/admin/UploadPanel.tsx`
- Modify: `components/admin/AdminStudio.module.css`

**Interfaces:**
- Consumes `RowSlot` from Task 1.
- Receives all file state and event handlers from `app/admin/page.tsx`; it performs no storage or Supabase calls.

- [ ] **Step 1: Implement the UploadPanel contract and markup**

```tsx
// components/admin/UploadPanel.tsx
import type { ChangeEvent, DragEvent, RefObject } from "react";
import type { RowSlot } from "./types";
import styles from "./AdminStudio.module.css";

interface UploadPanelProps {
  file: File | null;
  selectedRow: RowSlot;
  visibleRows: RowSlot[];
  duration: number;
  uploading: boolean;
  uploadProgress: number;
  dragOver: boolean;
  dropZoneRef: RefObject<HTMLDivElement | null>;
  libraryTriggerRef: RefObject<HTMLButtonElement | null>;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onClearFile: () => void;
  onSelectRow: (row: RowSlot) => void;
  onChangeDuration: (duration: number) => void;
  onUpload: () => void;
  onOpenLibrary: () => void;
}

const ROW_NAMES: Record<RowSlot, string> = { 1: "Row 1", 2: "Row 2", 3: "Row 3" };

export function UploadPanel(props: UploadPanelProps) {
  const isVideo = props.file?.type.startsWith("video") ?? false;
  return (
    <aside className={styles.uploadPanel} aria-labelledby="add-media-title">
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>ADD TO DISPLAY</p>
        <h2 id="add-media-title">เพิ่มสื่อ</h2>
      </div>
      <div
        ref={props.dropZoneRef}
        className={`${styles.dropZone} ${props.dragOver ? styles.dropZoneActive : ""}`}
        onDragOver={props.onDragOver}
        onDragLeave={props.onDragLeave}
        onDrop={props.onDrop}
      >
        <input id="admin-file-input" className={styles.visuallyHidden} type="file" accept="image/*,video/*" onChange={props.onFileChange} />
        {props.file ? (
          <div className={styles.selectedFile}>
            <strong>{props.file.name}</strong>
            <span>{(props.file.size / 1024 / 1024).toFixed(2)} MB</span>
            <button type="button" onClick={props.onClearFile}>เอาไฟล์ออก</button>
          </div>
        ) : (
          <label htmlFor="admin-file-input" className={styles.filePicker}>
            <strong>วางไฟล์ที่นี่</strong>
            <span>หรือเลือกจากอุปกรณ์</span>
          </label>
        )}
      </div>
      <fieldset className={styles.fieldGroup}>
        <legend>แสดงใน Row</legend>
        <div className={styles.segmentedControl}>
          {props.visibleRows.map((row) => (
            <button key={row} type="button" aria-pressed={props.selectedRow === row} onClick={() => props.onSelectRow(row)}>{ROW_NAMES[row]}</button>
          ))}
        </div>
      </fieldset>
      {!isVideo && (
        <div className={styles.fieldGroup}>
          <label htmlFor="media-duration">ระยะเวลาแสดงภาพ</label>
          <div className={styles.stepper}>
            <button type="button" onClick={() => props.onChangeDuration(Math.max(3, props.duration - 1))}>−</button>
            <output id="media-duration">{props.duration} วินาที</output>
            <button type="button" onClick={() => props.onChangeDuration(Math.min(60, props.duration + 1))}>+</button>
          </div>
        </div>
      )}
      <button className={styles.primaryButton} type="button" disabled={!props.file || props.uploading} onClick={props.onUpload}>
        {props.uploading ? `กำลังเพิ่ม ${props.uploadProgress}%` : "เพิ่มสื่อ"}
      </button>
      {props.uploading && <progress className={styles.progress} max="100" value={props.uploadProgress} />}
      <button ref={props.libraryTriggerRef} className={styles.secondaryButton} type="button" onClick={props.onOpenLibrary}>เลือกจากคลังสื่อ</button>
    </aside>
  );
}
```

- [ ] **Step 2: Add upload-panel styles**

Add `.uploadPanel`, `.sectionHeading`, `.dropZone`, `.dropZoneActive`, `.selectedFile`, `.filePicker`, `.fieldGroup`, `.segmentedControl`, `.stepper`, `.primaryButton`, `.secondaryButton`, `.progress`, and `.visuallyHidden`. On desktop `.uploadPanel` uses `position: sticky; top: 164px`; below `760px` it uses `position: static`. Buttons and the drop zone must expose visible focus and minimum 44px controls.

- [ ] **Step 3: Run focused lint**

Run: `npm run lint -- components/admin/UploadPanel.tsx`

Expected: exit code 0.

---

### Task 4: Build the Contact Sheet media card and workspace

**Files:**
- Create: `components/admin/MediaCard.tsx`
- Create: `components/admin/MediaWorkspace.tsx`
- Modify: `components/admin/AdminStudio.module.css`

**Interfaces:**
- Consumes `AdminMediaItem`, `MediaRowFilter`, `ModeFilter`, and `RowSlot` from Task 1.
- Consumes `formatOrderNumber()` from Task 1.
- Emits existing page-level callbacks for duration, active state, mode filter, delete, drag, and Row movement.

- [ ] **Step 1: Implement MediaCard with always-reachable actions**

Define `MediaCardProps` exactly as follows and implement the matching card:

```ts
interface MediaCardProps {
  item: AdminMediaItem;
  orderIndex: number;
  isTvKiosk: boolean;
  visibleRows: RowSlot[];
  isDragging: boolean;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onUpdateDuration: (id: number, duration: number) => void;
  onToggleActive: (id: number, current: boolean) => void;
  onUpdateModeFilter: (id: number, current: ModeFilter) => void;
  onMoveToRow: (id: number, row: RowSlot) => void;
  onDelete: (id: number, url: string) => void;
}
```

Use local `thumbnailFailed` state for broken media and render the card body independently from the thumbnail state. The core JSX must contain these concrete controls:

```tsx
<article className={styles.mediaCard} data-row={item.row_slot}>
  <div className={styles.orderRail} aria-label={`ลำดับ ${orderIndex + 1}`}>
    {formatOrderNumber(orderIndex)}
  </div>
  <div className={styles.thumbnailFrame}>
    {thumbnailFailed ? (
      <div className={styles.brokenMedia}>ไฟล์ต้นฉบับไม่พร้อมใช้งาน</div>
    ) : item.type === "image" ? (
      <img src={item.url} alt="ตัวอย่างสื่อ" loading="lazy" onError={() => setThumbnailFailed(true)} />
    ) : (
      <video src={item.url} muted preload="metadata" onError={() => setThumbnailFailed(true)} />
    )}
  </div>
  <div className={styles.cardBody}>
    <div className={styles.cardMeta}>
      <span>{item.type === "image" ? "ภาพ" : "วิดีโอ"}</span>
      <span>Row {item.row_slot}</span>
      <span>{item.is_active ? "แสดงอยู่" : "ซ่อนอยู่"}</span>
    </div>
    {item.type === "image" && (
      <div className={styles.inlineStepper}>
        <button type="button" aria-label="ลดเวลา" onClick={() => onUpdateDuration(item.id, Math.max(3, item.duration - 1))}>−</button>
        <output>{item.duration} วินาที</output>
        <button type="button" aria-label="เพิ่มเวลา" onClick={() => onUpdateDuration(item.id, Math.min(60, item.duration + 1))}>+</button>
      </div>
    )}
    {!isTvKiosk && (
      <button type="button" onClick={() => onUpdateModeFilter(item.id, item.display_mode_filter)}>
        {item.display_mode_filter === "both" ? "ทุกโหมด" : item.display_mode_filter === "3row" ? "3 แถว" : "หน้าเดี่ยว"}
      </button>
    )}
    <div className={styles.cardActions}>
      <button type="button" onClick={() => onToggleActive(item.id, item.is_active)}>{item.is_active ? "ซ่อนจากจอ" : "แสดงบนจอ"}</button>
      <label>ย้ายไป
        <select value={item.row_slot} onChange={(event) => onMoveToRow(item.id, Number(event.target.value) as RowSlot)}>
          {visibleRows.map((row) => <option key={row} value={row}>Row {row}</option>)}
        </select>
      </label>
      <button type="button" className={styles.dangerButton} onClick={() => onDelete(item.id, item.url)}>ลบ</button>
    </div>
  </div>
</article>
```

Use the existing `handleUpdateModeFilter` cycle and delete confirmation in the parent; do not duplicate mutation logic. The broken-file fallback must preserve the card body and controls.

- [ ] **Step 2: Implement MediaWorkspace filters and Row groups**

Define `MediaWorkspaceProps` exactly as follows:

```ts
interface MediaWorkspaceProps {
  items: AdminMediaItem[];
  selectedKiosk: string;
  visibleRows: RowSlot[];
  filter: MediaRowFilter;
  isTvKiosk: boolean;
  isSavingOrder: boolean;
  draggingId: number | null;
  dragOverId: number | null;
  dragSourceRow: RowSlot | null;
  dropTargetRow: RowSlot | null;
  onFilterChange: (filter: MediaRowFilter) => void;
  onDragStart: (event: DragEvent, id: number, row: RowSlot) => void;
  onDragEnterCard: (id: number) => void;
  onRowDragEnter: (event: DragEvent, row: RowSlot) => void;
  onRowDragLeave: (event: DragEvent, row: RowSlot) => void;
  onRowDrop: (event: DragEvent, row: RowSlot) => void;
  onDragEnd: (row: RowSlot) => void;
  onUpdateDuration: (id: number, duration: number) => void;
  onToggleActive: (id: number, current: boolean) => void;
  onUpdateModeFilter: (id: number, current: ModeFilter) => void;
  onMoveToRow: (id: number, row: RowSlot) => void;
  onDelete: (id: number, url: string) => void;
}
```

Render:

1. Heading `สื่อในจอนี้` and total count.
2. `ทั้งหมด` plus visible Row filter buttons; omit the filter strip for TV.
3. A Row section for every Row allowed by the current filter.
4. Row heading, item count, drop guidance, empty action text, and responsive card grid.
5. Non-blocking `กำลังบันทึกลำดับ` status with `role="status"`.

Use `filterMediaForWorkspace(items, selectedKiosk, filter)` before grouping. Within each Row, sort by `sort_order`; preserve the current live drag preview algorithm from `app/admin/page.tsx`.

- [ ] **Step 3: Add Contact Sheet styles**

Add these structural rules, then complete their states using approved tokens:

```css
.mediaWorkspace { min-width: 0; }
.workspaceHeader { display: flex; align-items: end; justify-content: space-between; gap: 16px; }
.filterBar { display: flex; gap: 8px; overflow-x: auto; margin: 18px 0; }
.rowSection { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--line); }
.mediaGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; }
.mediaCard { position: relative; display: grid; grid-template-columns: 42px minmax(0, 1fr); overflow: hidden; background: var(--paper); border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 10px 30px rgba(23, 32, 51, 0.06); }
.orderRail { grid-row: 1 / span 2; padding-top: 16px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; text-align: center; border-right: 3px solid var(--row-color); }
.thumbnailFrame { position: relative; aspect-ratio: 16 / 9; background: #e8edf4; }
.cardBody { padding: 14px; }
.cardActions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.mediaCard[data-row="1"] { --row-color: #2457d6; }
.mediaCard[data-row="2"] { --row-color: #7b4bc9; }
.mediaCard[data-row="3"] { --row-color: #16856a; }
.isDragging { opacity: 0.55; transform: translateY(-4px) rotate(-0.4deg); }
.dropTarget { box-shadow: 0 0 0 3px rgba(36, 87, 214, 0.22); }
```

- [ ] **Step 4: Run focused lint**

Run: `npm run lint -- components/admin/MediaCard.tsx components/admin/MediaWorkspace.tsx`

Expected: exit code 0.

---

### Task 5: Rebuild the accessible media-library modal

**Files:**
- Create: `components/admin/MediaLibraryModal.tsx`
- Modify: `components/admin/AdminStudio.module.css`

**Interfaces:**
- Consumes `AdminMediaItem`, `RowSlot`, and `uniqueLibraryMedia()`.
- Emits `onAdd(url, type)` and `onClose()`; performs no Supabase calls.

- [ ] **Step 1: Implement the dialog and focus lifecycle**

```tsx
interface MediaLibraryModalProps {
  open: boolean;
  media: AdminMediaItem[];
  selectedKiosk: string;
  selectedRow: RowSlot;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onAdd: (url: string, type: "image" | "video") => void;
  onClose: () => void;
}
```

When `open` becomes true, focus the close button. Listen for `Escape` to close. On close, call `triggerRef.current?.focus()`. Use `role="dialog"`, `aria-modal="true"`, `aria-labelledby="media-library-title"`, and button elements for media choices. Render `uniqueLibraryMedia(media)` as a responsive 16:9 grid and show `ยังไม่มีสื่อในคลัง` when empty.

Use this structure:

```tsx
<div className={styles.modalBackdrop} onMouseDown={backdropCloseOnly}>
  <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="media-library-title">
    <header className={styles.modalHeader}>
      <div><p className={styles.eyebrow}>MEDIA LIBRARY</p><h2 id="media-library-title">เลือกสื่อเดิม</h2></div>
      <button ref={closeRef} type="button" onClick={onClose} aria-label="ปิดคลังสื่อ">ปิด</button>
    </header>
    <p className={styles.modalContext}>{selectedKiosk.toUpperCase()} · Row {selectedRow}</p>
    <div className={styles.libraryGrid}>
      {uniqueLibraryMedia(media).map((item) => (
        <button key={item.url} type="button" className={styles.libraryItem} onClick={() => onAdd(item.url, item.type)}>
          {item.type === "image" ? <img src={item.url} alt="ตัวอย่างสื่อในคลัง" /> : <video src={item.url} muted preload="metadata" />}
          <span>เพิ่มลง Row {selectedRow}</span>
        </button>
      ))}
      {media.length === 0 && <p className={styles.libraryEmpty}>ยังไม่มีสื่อในคลัง</p>}
    </div>
  </section>
</div>
```

The focus trap must cycle Tab and Shift+Tab between focusable elements inside the dialog rather than allowing focus behind the backdrop.

- [ ] **Step 2: Add modal styles**

Add `.modalBackdrop`, `.modal`, `.modalHeader`, `.modalContext`, `.libraryGrid`, `.libraryItem`, and `.libraryEmpty`. The modal uses Paper, a maximum width of `960px`, a maximum height of `min(84dvh, 820px)`, internal scrolling, and a single-column mobile layout. Do not use mouse event style mutation.

- [ ] **Step 3: Run focused lint**

Run: `npm run lint -- components/admin/MediaLibraryModal.tsx`

Expected: exit code 0.

---

### Task 6: Integrate the workspace without changing mutations

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes every component and helper from Tasks 1–5.
- Retains all existing Supabase calls and handlers in `AdminPage`.

- [ ] **Step 1: Replace local types and add view state**

Import `AdminMediaItem`, `DisplayMode`, `MediaRowFilter`, `ModeFilter`, and `RowSlot`. Replace the local `MediaItem` interface with `AdminMediaItem`. Add:

```ts
const [mediaRowFilter, setMediaRowFilter] = useState<MediaRowFilter>("all");
const libraryTriggerRef = useRef<HTMLButtonElement>(null);

const isTvKiosk = selectedKiosk === "kiosk-TV";
const visibleRows = visibleRowsForKiosk(selectedKiosk);
const mediaCounts = countMediaByKiosk(mediaList);
const previewHref = isTvKiosk ? "/tv" : "/";
```

When selecting a kiosk, reset `mediaRowFilter` to `"all"`; when selecting TV, also retain the existing `setSelectedRow(1)` behavior.

Implement the selection callback explicitly:

```ts
const handleSelectKiosk = (kioskId: string) => {
  setSelectedKiosk(kioskId);
  setMediaRowFilter("all");
  if (kioskId === "kiosk-TV") {
    setSelectedRow(1);
  } else {
    fetchDisplayMode(kioskId);
  }
};
```

- [ ] **Step 2: Add an explicit move callback for touch/keyboard users**

Extract the database update and optimistic rollback already used by cross-Row drop into:

```ts
const handleMoveToRow = async (id: number, targetRow: RowSlot) => {
  const previous = mediaListRef.current;
  const targetItems = previous.filter(
    (item) => item.kiosk_id === selectedKiosk && item.row_slot === targetRow,
  );
  const nextOrder = targetItems.length;
  const optimistic = previous.map((item) =>
    item.id === id
      ? { ...item, row_slot: targetRow, sort_order: nextOrder }
      : item,
  );
  setMediaList(optimistic);
  mediaListRef.current = optimistic;
  try {
    const result = await supabase
      .from("media_items")
      .update({ row_slot: targetRow, sort_order: nextOrder })
      .eq("id", id);
    requireSupabaseSuccess(result, "ย้ายสื่อไป Row ใหม่");
  } catch (error) {
    setMediaList(previous);
    mediaListRef.current = previous;
    alert(error instanceof Error ? error.message : "ย้ายสื่อไม่สำเร็จ");
  }
};
```

Do not remove cross-Row drag; both mechanisms call the same mutation semantics.

- [ ] **Step 3: Replace the old JSX with the component composition**

```tsx
return (
  <div className={styles.page}>
    <AdminHeader
      selectedKiosk={selectedKiosk}
      isTvKiosk={isTvKiosk}
      previewHref={previewHref}
      onLogout={handleLogout}
    />
    <ScreenSwitcher
      kiosks={KIOSK_LIST}
      selectedKiosk={selectedKiosk}
      mediaCounts={mediaCounts}
      displayMode={displayMode}
      isSavingMode={isSavingMode}
      onSelectKiosk={handleSelectKiosk}
      onSelectMode={handleSetDisplayMode}
    />
    <main className={styles.workspace}>
      <UploadPanel
        file={file}
        selectedRow={selectedRow}
        visibleRows={visibleRows}
        duration={duration}
        uploading={uploading}
        uploadProgress={uploadProgress}
        dragOver={dragOver}
        dropZoneRef={dropZoneRef}
        libraryTriggerRef={libraryTriggerRef}
        onFileChange={handleFileChange}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClearFile={() => setFile(null)}
        onSelectRow={setSelectedRow}
        onChangeDuration={setDuration}
        onUpload={handleUpload}
        onOpenLibrary={() => setShowLibrary(true)}
      />
      <MediaWorkspace
        items={mediaList}
        selectedKiosk={selectedKiosk}
        visibleRows={visibleRows}
        filter={mediaRowFilter}
        onFilterChange={setMediaRowFilter}
        isTvKiosk={isTvKiosk}
        isSavingOrder={isSavingOrder}
        draggingId={draggingId}
        dragOverId={dragOverId}
        dragSourceRow={dragSourceRow}
        dropTargetRow={dropTargetRow}
        onDragStart={handleDragStart}
        onDragEnterCard={handleDragEnterCard}
        onRowDragEnter={handleRowDragEnter}
        onRowDragLeave={handleRowDragLeave}
        onRowDrop={handleRowDrop}
        onDragEnd={handleDragEnd}
        onUpdateDuration={handleUpdateDuration}
        onToggleActive={handleToggleActive}
        onUpdateModeFilter={handleUpdateModeFilter}
        onMoveToRow={handleMoveToRow}
        onDelete={handleDelete}
      />
    </main>
    <MediaLibraryModal
      open={showLibrary}
      media={mediaList}
      selectedKiosk={selectedKiosk}
      selectedRow={selectedRow}
      triggerRef={libraryTriggerRef}
      onAdd={handleAddFromLibrary}
      onClose={() => setShowLibrary(false)}
    />
  </div>
);
```

- [ ] **Step 4: Remove obsolete Admin CSS only after the new UI is wired**

Delete the `.dash-*` Admin block from `app/globals.css` after confirming none of those selectors remain in `app/admin/page.tsx`. Preserve kiosk, TV, login, and other global styles.

Run: `rg -n "dash-" app/admin components/admin`

Expected: no matches.

- [ ] **Step 5: Run the Admin helper tests and lint**

Run: `npm test -- lib/adminView.test.ts lib/mediaOperations.test.ts`

Expected: both files pass with exit code 0.

Run: `npm run lint -- app/admin/page.tsx components/admin lib/adminView.ts`

Expected: exit code 0.

---

### Task 7: Verify responsive behavior and preserved workflows

**Files:**
- Modify if required by findings: `app/admin/page.tsx`
- Modify if required by findings: `components/admin/*.tsx`
- Modify if required by findings: `components/admin/AdminStudio.module.css`

**Interfaces:**
- Verifies the complete Admin workspace; introduces no new product behavior.

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`

Expected: all Vitest tests pass with exit code 0.

- [ ] **Step 2: Run lint and production build**

Run: `npm run lint`

Expected: exit code 0.

Run: `npm run build`

Expected: exit code 0 and Next.js reports the Admin route compiled successfully.

- [ ] **Step 3: Inspect the page at desktop, tablet, and mobile widths**

Run: `npm run dev`

Inspect authenticated `/admin` at approximately `1440×900`, `1024×768`, and `390×844`.

Confirm:

- sticky header/toolbar do not cover content;
- desktop shows upload and media workspace together;
- tablet controls wrap without clipping;
- mobile preserves preview, logout, upload, filters, card actions, and modal controls;
- horizontal kiosk scrolling does not move the whole page;
- focus rings and 44px targets remain visible;
- reduced-motion mode removes lift and transition effects.

- [ ] **Step 4: Exercise preserved workflows**

Manually verify in this order:

1. Switch among standard kiosks and confirm media counts/context update.
2. Switch display modes and confirm rollback messaging on a forced failure if a safe test environment is available.
3. Select TV and confirm Row 1 only, no display mode, no card mode filter, and `/tv` preview.
4. Select image and video files; confirm duration is shown only for images.
5. Upload media and observe local progress.
6. Filter All/Row 1/Row 2/Row 3 without changing stored data.
7. Reorder within a Row, drag across Rows, and use the explicit Row selector.
8. Toggle active state, change duration, cycle display-mode filter, and cancel then confirm deletion.
9. Open the library, Tab through the dialog, close with Escape, and confirm focus returns to the trigger.
10. Confirm empty Row and broken-thumbnail states preserve actionable controls.

- [ ] **Step 5: Report evidence and remaining manual checks**

Record the exact test count, lint result, build result, viewport checks, and any workflow that could not be safely exercised. Do not claim the redesign is complete or passing unless the corresponding fresh command or manual check succeeded.
