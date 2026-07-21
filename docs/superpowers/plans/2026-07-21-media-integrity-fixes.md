# Media Integrity Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four approved media-integrity defects with regression tests and no visual redesign.

**Architecture:** Add one pure slideshow helper and one typed media-operation service. Keep the existing pages as UI consumers; move only database/storage coordination and Supabase result validation behind testable functions.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Supabase JS 2, Vitest

## Global Constraints

- Preserve the existing visual design, labels, component layout, and Supabase schema.
- Preserve the existing schema-compatibility fallbacks, but never silently accept a failed Supabase result.
- Implement the four defects in order and complete a red-green test cycle before moving to the next defect.
- Do not add realtime status, RLS migrations, responsive redesign, or broad component decomposition.
- Error feedback remains in Thai and distinguishes complete failure from partial cleanup failure.
- This workspace has no Git metadata. Do not initialize Git or claim commits; record verification checkpoints instead.

---

### Task 1: Add test infrastructure and make slideshow indexing safe

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` through npm
- Create: `lib/slideshow.ts`
- Create: `lib/slideshow.test.ts`
- Modify: `app/page.tsx:3-98,194-217`

**Interfaces:**
- Produces: `normalizeSlideIndex(index: number, itemCount: number): number | null`
- Consumes: no application-specific interfaces

- [ ] **Step 1: Install Vitest and add the test command**

Run:

```bash
npm install --save-dev vitest
npm pkg set scripts.test="vitest run"
```

Expected: `vitest` is present in `devDependencies`, `package-lock.json` is updated, and `npm test` invokes `vitest run`.

- [ ] **Step 2: Write the failing slideshow regression test**

Create `lib/slideshow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeSlideIndex } from "./slideshow";

describe("normalizeSlideIndex", () => {
  it("keeps an index that still exists", () => {
    expect(normalizeSlideIndex(2, 4)).toBe(2);
  });

  it("resets an out-of-range index when the list shrinks", () => {
    expect(normalizeSlideIndex(4, 2)).toBe(0);
  });

  it("returns null for an empty list", () => {
    expect(normalizeSlideIndex(0, 0)).toBeNull();
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "resets invalid index %s",
    (index) => {
      expect(normalizeSlideIndex(index, 3)).toBe(0);
    },
  );
});
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
npm test -- lib/slideshow.test.ts
```

Expected: FAIL because `lib/slideshow.ts` or `normalizeSlideIndex` does not exist. This proves the regression test is not passing against the old implementation.

- [ ] **Step 4: Implement the minimal pure helper**

Create `lib/slideshow.ts`:

```ts
export function normalizeSlideIndex(
  index: number,
  itemCount: number,
): number | null {
  if (itemCount <= 0) return null;
  if (!Number.isInteger(index) || index < 0 || index >= itemCount) return 0;
  return index;
}
```

- [ ] **Step 5: Run the helper test and verify GREEN**

Run:

```bash
npm test -- lib/slideshow.test.ts
```

Expected: 1 test file passes with 6 test cases.

- [ ] **Step 6: Integrate the safe index into `RowSlideshow`**

Add the import:

```ts
import { normalizeSlideIndex } from "@/lib/slideshow";
```

Remove the synchronous reset effect that currently depends on `items.length`. Replace direct current-index reads with a derived safe index:

```ts
const safeCurrentIndex = normalizeSlideIndex(currentIndex, items.length);
const currentItem =
  safeCurrentIndex === null ? null : items[safeCurrentIndex];
```

Update `nextSlide` so it never computes from an invalid or empty list:

```ts
const nextSlide = useCallback(() => {
  const activeIndex = normalizeSlideIndex(currentIndex, items.length);
  if (activeIndex === null) return;

  if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
  if (enterTimerRef.current) clearTimeout(enterTimerRef.current);

  setPrevIndex(activeIndex);
  setPrevPhase("exit");
  setCurrentIndex((activeIndex + 1) % items.length);
  setCurrentPhase("enter");

  enterTimerRef.current = setTimeout(() => setCurrentPhase("active"), 50);
  transitionTimerRef.current = setTimeout(() => {
    setPrevIndex(null);
    setPrevPhase("hidden");
  }, CROSSFADE_MS + 100);
}, [currentIndex, items.length]);
```

Render the empty state whenever `currentItem` is null, and use `safeCurrentIndex` for the active dot:

```tsx
if (!currentItem || safeCurrentIndex === null) {
  return (
    <div className="row-empty">
      <span>ยังไม่มีสื่อในช่องนี้</span>
    </div>
  );
}
```

```tsx
className={`row-dot ${idx === safeCurrentIndex ? "active" : ""}`}
```

- [ ] **Step 7: Verify Task 1**

Run:

```bash
npm test -- lib/slideshow.test.ts
npx eslint app/page.tsx lib/slideshow.ts lib/slideshow.test.ts
```

Expected: slideshow tests pass; the previous `set-state-in-effect` finding at the removed reset effect is gone. Record the exact remaining lint output before Task 2.

---

### Task 2: Make Supabase mutation failures explicit and reversible

**Files:**
- Create: `lib/mediaOperations.ts`
- Create: `lib/mediaOperations.test.ts`
- Modify: `app/admin/page.tsx:105-137,313-392,435-550`

**Interfaces:**
- Produces: `SupabaseErrorLike`, `SupabaseResult<T>`, `MediaOperationError`, `requireSupabaseSuccess<T>()`
- Consumes: structurally compatible Supabase query results

- [ ] **Step 1: Write the failing mutation-result tests**

Create `lib/mediaOperations.test.ts` with the first test group:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  MediaOperationError,
  requireSupabaseSuccess,
  runOptimisticMutation,
} from "./mediaOperations";

describe("requireSupabaseSuccess", () => {
  it("returns data when Supabase reports success", () => {
    expect(
      requireSupabaseSuccess({ data: { id: 7 }, error: null }, "บันทึกข้อมูล"),
    ).toEqual({ id: 7 });
  });

  it("throws when Supabase resolves with an error", () => {
    expect(() =>
      requireSupabaseSuccess(
        { data: null, error: { message: "permission denied" } },
        "บันทึกข้อมูล",
      ),
    ).toThrow(new MediaOperationError("บันทึกข้อมูล", "permission denied"));
  });
});

describe("runOptimisticMutation", () => {
  it("restores the previous UI state when persistence fails", async () => {
    const restore = vi.fn();

    await expect(
      runOptimisticMutation(
        async () => ({ data: null, error: { message: "network error" } }),
        restore,
        "อัปเดตสื่อ",
      ),
    ).rejects.toThrow("อัปเดตสื่อ: network error");

    expect(restore).toHaveBeenCalledOnce();
  });

  it("does not restore state after confirmed success", async () => {
    const restore = vi.fn();

    await runOptimisticMutation(
      async () => ({ data: null, error: null }),
      restore,
      "อัปเดตสื่อ",
    );

    expect(restore).not.toHaveBeenCalled();
  });

  it("restores state when the mutation promise rejects", async () => {
    const restore = vi.fn();

    await expect(
      runOptimisticMutation(
        async () => {
          throw new Error("connection lost");
        },
        restore,
        "อัปเดตสื่อ",
      ),
    ).rejects.toThrow("connection lost");

    expect(restore).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the mutation tests and verify RED**

Run:

```bash
npm test -- lib/mediaOperations.test.ts
```

Expected: FAIL because the operation types and functions are not exported yet.

- [ ] **Step 3: Implement the result guard and optimistic wrapper**

Create `lib/mediaOperations.ts`:

```ts
export interface SupabaseErrorLike {
  message: string;
}

export interface SupabaseResult<T = unknown> {
  data: T | null;
  error: SupabaseErrorLike | null;
}

export class MediaOperationError extends Error {
  constructor(
    public readonly action: string,
    public readonly causeMessage: string,
  ) {
    super(`${action}: ${causeMessage}`);
    this.name = "MediaOperationError";
  }
}

export function requireSupabaseSuccess<T>(
  result: SupabaseResult<T>,
  action: string,
): T | null {
  if (result.error) {
    throw new MediaOperationError(action, result.error.message);
  }
  return result.data;
}

export async function runOptimisticMutation(
  mutate: () => PromiseLike<SupabaseResult<unknown>>,
  restore: () => void,
  action: string,
): Promise<void> {
  try {
    const result = await mutate();
    requireSupabaseSuccess(result, action);
  } catch (error) {
    restore();
    throw error;
  }
}
```

- [ ] **Step 4: Run the mutation tests and verify GREEN**

Run:

```bash
npm test -- lib/mediaOperations.test.ts
```

Expected: result-guard and optimistic-mutation test groups pass.

- [ ] **Step 5: Integrate explicit result checking into Admin mutations**

Import the helpers:

```ts
import {
  requireSupabaseSuccess,
  runOptimisticMutation,
} from "@/lib/mediaOperations";
```

Keep `mediaListRef` synchronized so reorder rollback snapshots always match the rendered list:

```ts
useEffect(() => {
  mediaListRef.current = mediaList;
}, [mediaList]);
```

Replace `handleSetDisplayMode` with:

```ts
const handleSetDisplayMode = async (mode: "3row" | "single") => {
  const previousMode = displayMode;
  setDisplayMode(mode);
  setIsSavingMode(true);
  try {
    const result = await supabase
      .from("kiosk_settings")
      .upsert(
        { kiosk_id: selectedKiosk, display_mode: mode },
        { onConflict: "kiosk_id" },
      );
    requireSupabaseSuccess(result, "บันทึกโหมดแสดงผล");
  } catch (error) {
    setDisplayMode(previousMode);
    alert(
      error instanceof Error ? error.message : "บันทึกโหมดแสดงผลไม่สำเร็จ",
    );
  } finally {
    setIsSavingMode(false);
  }
};
```

Replace `handleUpdateDuration` with:

```ts
const handleUpdateDuration = async (id: number, newDuration: number) => {
  try {
    const result = await supabase
      .from("media_items")
      .update({ duration: newDuration })
      .eq("id", id);
    requireSupabaseSuccess(result, "อัปเดตระยะเวลา");
    setMediaList((prev) =>
      prev.map((m) => (m.id === id ? { ...m, duration: newDuration } : m)),
    );
  } catch (error) {
    alert(error instanceof Error ? error.message : "อัปเดตระยะเวลาไม่สำเร็จ");
  }
};
```

Delete the unused `handleMoveRow` and `handleMoveKiosk` functions. They have no rendered controls and retaining unreachable mutations expands the defect surface.

Replace `handleToggleActive` with:

```ts
const handleToggleActive = async (id: number, current: boolean) => {
  const newVal = !current;
  setMediaList((prev) =>
    prev.map((m) => (m.id === id ? { ...m, is_active: newVal } : m)),
  );

  try {
    await runOptimisticMutation(
      () =>
        supabase
          .from("media_items")
          .update({ is_active: newVal })
          .eq("id", id),
      () =>
        setMediaList((prev) =>
          prev.map((m) => (m.id === id ? { ...m, is_active: current } : m)),
        ),
      "อัปเดตสถานะสื่อ",
    );
  } catch (error) {
    alert(
      error instanceof Error ? error.message : "อัปเดตสถานะสื่อไม่สำเร็จ",
    );
  }
};
```

Replace `handleUpdateModeFilter` with:

```ts
const handleUpdateModeFilter = async (id: number, current: ModeFilter) => {
  const cycle: Record<ModeFilter, ModeFilter> = {
    both: "3row",
    "3row": "single",
    single: "both",
  };
  const next = cycle[current];
  setMediaList((prev) =>
    prev.map((m) => (m.id === id ? { ...m, display_mode_filter: next } : m)),
  );

  try {
    await runOptimisticMutation(
      () =>
        supabase
          .from("media_items")
          .update({ display_mode_filter: next })
          .eq("id", id),
      () =>
        setMediaList((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, display_mode_filter: current } : m,
          ),
        ),
      "อัปเดตโหมดของสื่อ",
    );
  } catch (error) {
    alert(error instanceof Error ? error.message : "อัปเดตโหมดของสื่อไม่สำเร็จ");
  }
};
```

In `handleRowDrop`, capture the original item before the optimistic move:

```ts
const originalItem = mediaListRef.current.find((item) => item.id === fromId);
```

Replace the persistence `try/catch` with:

```ts
try {
  const result = await supabase
    .from("media_items")
    .update({ row_slot: targetRow })
    .eq("id", fromId);
  requireSupabaseSuccess(result, "ย้ายสื่อไปยังแถวใหม่");
} catch (error) {
  if (originalItem) {
    setMediaList((prev) =>
      prev.map((m) => (m.id === fromId ? originalItem : m)),
    );
  }
  alert(error instanceof Error ? error.message : "ย้ายสื่อไม่สำเร็จ");
} finally {
  setIsSavingOrder(false);
}
```

In `handleDragEnd`, capture the full list before the optimistic reorder:

```ts
const previousList = mediaListRef.current;
```

Replace the reorder persistence block so every resolved result is checked and the full previous order is restored on failure:

```ts
setIsSavingOrder(true);
try {
  await new Promise((resolve) => setTimeout(resolve, 0));
  const snapshot = mediaListRef.current
    .filter((m) => m.row_slot === rowNum && m.kiosk_id === selectedKiosk)
    .sort((a, b) => a.sort_order - b.sort_order);
  const results = await Promise.all(
    snapshot.map((item) =>
      supabase
        .from("media_items")
        .update({ sort_order: item.sort_order })
        .eq("id", item.id),
    ),
  );
  results.forEach((result) =>
    requireSupabaseSuccess(result, "บันทึกลำดับสื่อ"),
  );
} catch (error) {
  mediaListRef.current = previousList;
  setMediaList(previousList);
  alert(error instanceof Error ? error.message : "บันทึกลำดับสื่อไม่สำเร็จ");
} finally {
  setIsSavingOrder(false);
}
```

- [ ] **Step 6: Verify Task 2**

Run:

```bash
npm test -- lib/mediaOperations.test.ts
npx eslint app/admin/page.tsx lib/mediaOperations.ts lib/mediaOperations.test.ts
```

Expected: operation tests pass. No affected mutation silently ignores a returned Supabase error. Record unrelated pre-existing lint findings without disabling them.

---

### Task 3: Make delete ordering and partial cleanup deterministic

**Files:**
- Modify: `lib/mediaOperations.ts`
- Modify: `lib/mediaOperations.test.ts`
- Modify: `app/admin/page.tsx:282-311`

**Interfaces:**
- Consumes: `SupabaseResult<T>`, `requireSupabaseSuccess<T>()`
- Produces: `DeleteMediaDependencies`, `DeleteMediaResult`, `deleteMedia()`

- [ ] **Step 1: Add failing delete tests**

Append to `lib/mediaOperations.test.ts`:

```ts
import { deleteMedia } from "./mediaOperations";

function deleteDependencies(overrides = {}) {
  return {
    findShared: vi.fn(async () => ({ data: [], error: null })),
    deleteRecord: vi.fn(async () => ({ data: null, error: null })),
    removeObject: vi.fn(async () => ({ data: null, error: null })),
    ...overrides,
  };
}

describe("deleteMedia", () => {
  it("stops before deleting when the shared-file query fails", async () => {
    const deps = deleteDependencies({
      findShared: vi.fn(async () => ({
        data: null,
        error: { message: "query failed" },
      })),
    });

    await expect(
      deleteMedia(deps, { id: 3, url: "https://host/files/photo.jpg" }),
    ).rejects.toThrow("ตรวจสอบการใช้ไฟล์ร่วมกัน: query failed");
    expect(deps.deleteRecord).not.toHaveBeenCalled();
    expect(deps.removeObject).not.toHaveBeenCalled();
  });

  it("leaves storage untouched when database deletion fails", async () => {
    const deps = deleteDependencies({
      deleteRecord: vi.fn(async () => ({
        data: null,
        error: { message: "delete denied" },
      })),
    });

    await expect(
      deleteMedia(deps, { id: 3, url: "https://host/files/photo.jpg" }),
    ).rejects.toThrow("ลบรายการสื่อ: delete denied");
    expect(deps.removeObject).not.toHaveBeenCalled();
  });

  it("keeps a shared storage object", async () => {
    const deps = deleteDependencies({
      findShared: vi.fn(async () => ({ data: [{ id: 9 }], error: null })),
    });

    const result = await deleteMedia(deps, {
      id: 3,
      url: "https://host/files/photo.jpg",
    });

    expect(result).toEqual({ databaseDeleted: true, cleanupWarning: null });
    expect(deps.removeObject).not.toHaveBeenCalled();
  });

  it("returns an orphan warning when storage cleanup fails", async () => {
    const deps = deleteDependencies({
      removeObject: vi.fn(async () => ({
        data: null,
        error: { message: "storage denied" },
      })),
    });

    const result = await deleteMedia(deps, {
      id: 3,
      url: "https://host/files/photo.jpg",
    });

    expect(result).toEqual({
      databaseDeleted: true,
      cleanupWarning: {
        objectName: "photo.jpg",
        message: "storage denied",
      },
    });
  });

  it("deletes an unshared object after database success", async () => {
    const deps = deleteDependencies();

    const result = await deleteMedia(deps, {
      id: 3,
      url: "https://host/files/photo.jpg",
    });

    expect(result).toEqual({ databaseDeleted: true, cleanupWarning: null });
    expect(deps.removeObject).toHaveBeenCalledWith("photo.jpg");
  });
});
```

- [ ] **Step 2: Run delete tests and verify RED**

Run:

```bash
npm test -- lib/mediaOperations.test.ts
```

Expected: FAIL because `deleteMedia` is not exported.

- [ ] **Step 3: Implement deterministic deletion**

Append to `lib/mediaOperations.ts`:

```ts
export interface DeleteMediaDependencies {
  findShared: (
    url: string,
    id: number,
  ) => PromiseLike<SupabaseResult<Array<{ id: number }>>>;
  deleteRecord: (id: number) => PromiseLike<SupabaseResult<unknown>>;
  removeObject: (objectName: string) => PromiseLike<SupabaseResult<unknown>>;
}

export interface DeleteMediaResult {
  databaseDeleted: true;
  cleanupWarning: { objectName: string; message: string } | null;
}

function objectNameFromUrl(url: string): string | null {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return segments.length > 0 ? decodeURIComponent(segments.at(-1)!) : null;
  } catch {
    return null;
  }
}

export async function deleteMedia(
  dependencies: DeleteMediaDependencies,
  input: { id: number; url: string },
): Promise<DeleteMediaResult> {
  const shared = requireSupabaseSuccess(
    await dependencies.findShared(input.url, input.id),
    "ตรวจสอบการใช้ไฟล์ร่วมกัน",
  ) ?? [];

  requireSupabaseSuccess(
    await dependencies.deleteRecord(input.id),
    "ลบรายการสื่อ",
  );

  if (shared.length > 0) {
    return { databaseDeleted: true, cleanupWarning: null };
  }

  const objectName = objectNameFromUrl(input.url);
  if (!objectName) {
    return { databaseDeleted: true, cleanupWarning: null };
  }

  const cleanup = await dependencies.removeObject(objectName);
  if (cleanup.error) {
    return {
      databaseDeleted: true,
      cleanupWarning: { objectName, message: cleanup.error.message },
    };
  }

  return { databaseDeleted: true, cleanupWarning: null };
}
```

- [ ] **Step 4: Run delete tests and verify GREEN**

Run:

```bash
npm test -- lib/mediaOperations.test.ts
```

Expected: all mutation and delete tests pass.

- [ ] **Step 5: Replace the Admin delete handler**

Import `deleteMedia`, then replace `handleDelete` with an adapter that passes real Supabase calls:

```ts
const handleDelete = async (id: number, url: string) => {
  if (!confirm("ต้องการลบไฟล์นี้ใช่ไหม?")) return;

  try {
    const result = await deleteMedia(
      {
        findShared: (sharedUrl, currentId) =>
          supabase
            .from("media_items")
            .select("id")
            .eq("url", sharedUrl)
            .neq("id", currentId),
        deleteRecord: (currentId) =>
          supabase.from("media_items").delete().eq("id", currentId),
        removeObject: (objectName) =>
          supabase.storage.from("kiosk-media").remove([objectName]),
      },
      { id, url },
    );

    setMediaList((prev) => prev.filter((item) => item.id !== id));
    if (result.cleanupWarning) {
      alert(
        `ลบรายการแล้ว แต่ลบไฟล์ ${result.cleanupWarning.objectName} จากคลังไม่สำเร็จ: ${result.cleanupWarning.message}`,
      );
    }
  } catch (error) {
    alert(error instanceof Error ? error.message : "ลบรายการไม่สำเร็จ");
  }
};
```

- [ ] **Step 6: Verify Task 3**

Run:

```bash
npm test -- lib/mediaOperations.test.ts
npx eslint app/admin/page.tsx lib/mediaOperations.ts lib/mediaOperations.test.ts
```

Expected: delete tests pass and Admin state changes only after confirmed database deletion.

---

### Task 4: Roll back uploaded objects after failed inserts

**Files:**
- Modify: `lib/mediaOperations.ts`
- Modify: `lib/mediaOperations.test.ts`
- Modify: `app/admin/page.tsx:162-280`

**Interfaces:**
- Consumes: `SupabaseResult<T>`, `requireSupabaseSuccess<T>()`
- Produces: `MediaInsertInput`, `InsertFallback`, `insertMediaWithCompatibility()`, `UploadMediaDependencies`, `UploadMediaError`, `uploadMedia()`

- [ ] **Step 1: Add failing insert-fallback and upload tests**

Append to `lib/mediaOperations.test.ts`:

```ts
import {
  insertMediaWithCompatibility,
  UploadMediaError,
  uploadMedia,
} from "./mediaOperations";

const mediaInput = {
  url: "https://host/files/photo.jpg",
  type: "image" as const,
  duration: 10,
  row_slot: 2 as const,
  kiosk_id: "kiosk-1",
};

describe("insertMediaWithCompatibility", () => {
  it("uses the no-kiosk fallback only for a missing kiosk_id column", async () => {
    const insert = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "column kiosk_id does not exist" },
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const result = await insertMediaWithCompatibility(insert, mediaInput);

    expect(result.fallback).toBe("without-kiosk");
    expect(insert).toHaveBeenNthCalledWith(2, {
      url: mediaInput.url,
      type: mediaInput.type,
      duration: mediaInput.duration,
      row_slot: mediaInput.row_slot,
    });
  });
});

function uploadDependencies(overrides = {}) {
  return {
    uploadObject: vi.fn(async () => ({ data: null, error: null })),
    getPublicUrl: vi.fn(() => "https://host/files/photo.jpg"),
    insertRecord: vi.fn(async () => ({ data: null, error: null })),
    removeObject: vi.fn(async () => ({ data: null, error: null })),
    ...overrides,
  };
}

describe("uploadMedia", () => {
  const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });

  it("stops when storage upload fails", async () => {
    const deps = uploadDependencies({
      uploadObject: vi.fn(async () => ({
        data: null,
        error: { message: "upload denied" },
      })),
    });

    await expect(
      uploadMedia(deps, {
        file,
        objectName: "123.jpg",
        duration: 10,
        rowSlot: 2,
        kioskId: "kiosk-1",
      }),
    ).rejects.toThrow("อัปโหลดไฟล์: upload denied");
    expect(deps.insertRecord).not.toHaveBeenCalled();
    expect(deps.removeObject).not.toHaveBeenCalled();
  });

  it("removes the uploaded object when every insert attempt fails", async () => {
    const deps = uploadDependencies({
      insertRecord: vi.fn(async () => ({
        data: null,
        error: { message: "insert denied" },
      })),
    });

    await expect(
      uploadMedia(deps, {
        file,
        objectName: "123.jpg",
        duration: 10,
        rowSlot: 2,
        kioskId: "kiosk-1",
      }),
    ).rejects.toMatchObject({
      primaryMessage: "เพิ่มรายการสื่อ: insert denied",
      orphanedObjectName: null,
    });
    expect(deps.removeObject).toHaveBeenCalledWith("123.jpg");
  });

  it("reports the object name when rollback also fails", async () => {
    const deps = uploadDependencies({
      insertRecord: vi.fn(async () => ({
        data: null,
        error: { message: "insert denied" },
      })),
      removeObject: vi.fn(async () => ({
        data: null,
        error: { message: "cleanup denied" },
      })),
    });

    await expect(
      uploadMedia(deps, {
        file,
        objectName: "123.jpg",
        duration: 10,
        rowSlot: 2,
        kioskId: "kiosk-1",
      }),
    ).rejects.toEqual(
      new UploadMediaError(
        "เพิ่มรายการสื่อ: insert denied",
        "123.jpg",
        "cleanup denied",
      ),
    );
  });

  it("keeps the object after a successful insert", async () => {
    const deps = uploadDependencies();

    const result = await uploadMedia(deps, {
      file,
      objectName: "123.jpg",
      duration: 10,
      rowSlot: 2,
      kioskId: "kiosk-1",
    });

    expect(result).toEqual({
      publicUrl: "https://host/files/photo.jpg",
      fallback: "none",
    });
    expect(deps.removeObject).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run upload tests and verify RED**

Run:

```bash
npm test -- lib/mediaOperations.test.ts
```

Expected: FAIL because insert compatibility and upload functions are not exported.

- [ ] **Step 3: Implement compatibility insertion and transactional upload**

Append to `lib/mediaOperations.ts`:

```ts
export interface MediaInsertInput {
  url: string;
  type: "image" | "video";
  duration: number;
  row_slot: 1 | 2 | 3;
  kiosk_id: string;
}

export type InsertFallback = "none" | "without-kiosk" | "basic";

type InsertRecord = (
  value: Partial<MediaInsertInput>,
) => PromiseLike<SupabaseResult<unknown>>;

export async function insertMediaWithCompatibility(
  insert: InsertRecord,
  input: MediaInsertInput,
): Promise<{ fallback: InsertFallback }> {
  let result = await insert(input);
  if (!result.error) return { fallback: "none" };

  if (result.error.message.includes("kiosk_id")) {
    const { kiosk_id: _kioskId, ...withoutKiosk } = input;
    result = await insert(withoutKiosk);
    if (!result.error) return { fallback: "without-kiosk" };
  }

  if (result.error?.message.includes("row_slot")) {
    result = await insert({
      url: input.url,
      type: input.type,
      duration: input.duration,
    });
    if (!result.error) return { fallback: "basic" };
  }

  requireSupabaseSuccess(result, "เพิ่มรายการสื่อ");
  return { fallback: "none" };
}

export interface UploadMediaDependencies {
  uploadObject: (
    objectName: string,
    file: File,
  ) => PromiseLike<SupabaseResult<unknown>>;
  getPublicUrl: (objectName: string) => string;
  insertRecord: InsertRecord;
  removeObject: (objectName: string) => PromiseLike<SupabaseResult<unknown>>;
}

export class UploadMediaError extends Error {
  constructor(
    public readonly primaryMessage: string,
    public readonly orphanedObjectName: string | null,
    public readonly cleanupMessage: string | null,
  ) {
    super(
      orphanedObjectName
        ? `${primaryMessage}; ลบไฟล์ ${orphanedObjectName} ที่อัปโหลดไว้ไม่สำเร็จ: ${cleanupMessage}`
        : primaryMessage,
    );
    this.name = "UploadMediaError";
  }
}

export async function uploadMedia(
  dependencies: UploadMediaDependencies,
  input: {
    file: File;
    objectName: string;
    duration: number;
    rowSlot: 1 | 2 | 3;
    kioskId: string;
  },
): Promise<{ publicUrl: string; fallback: InsertFallback }> {
  requireSupabaseSuccess(
    await dependencies.uploadObject(input.objectName, input.file),
    "อัปโหลดไฟล์",
  );

  const publicUrl = dependencies.getPublicUrl(input.objectName);
  const type = input.file.type.startsWith("video") ? "video" : "image";

  try {
    const inserted = await insertMediaWithCompatibility(
      dependencies.insertRecord,
      {
        url: publicUrl,
        type,
        duration: input.duration,
        row_slot: input.rowSlot,
        kiosk_id: input.kioskId,
      },
    );
    return { publicUrl, fallback: inserted.fallback };
  } catch (error) {
    const primaryMessage =
      error instanceof Error ? error.message : "เพิ่มรายการสื่อไม่สำเร็จ";
    const cleanup = await dependencies.removeObject(input.objectName);
    if (cleanup.error) {
      throw new UploadMediaError(
        primaryMessage,
        input.objectName,
        cleanup.error.message,
      );
    }
    throw new UploadMediaError(primaryMessage, null, null);
  }
}
```

- [ ] **Step 4: Run upload tests and verify GREEN**

Run:

```bash
npm test -- lib/mediaOperations.test.ts
```

Expected: mutation, delete, fallback, and upload tests all pass.

- [ ] **Step 5: Replace the Admin upload flow and reuse insertion for library items**

Import `insertMediaWithCompatibility` and `uploadMedia`. Replace the manual upload/insert block with:

```ts
const result = await uploadMedia(
  {
    uploadObject: (objectName, selectedFile) =>
      supabase.storage.from("kiosk-media").upload(objectName, selectedFile),
    getPublicUrl: (objectName) =>
      supabase.storage.from("kiosk-media").getPublicUrl(objectName).data.publicUrl,
    insertRecord: (value) =>
      supabase.from("media_items").insert([value]),
    removeObject: (objectName) =>
      supabase.storage.from("kiosk-media").remove([objectName]),
  },
  {
    file,
    objectName: fileName,
    duration,
    rowSlot: selectedRow,
    kioskId: selectedKiosk,
  },
);
```

Keep the existing progress behavior. Show the existing schema warning when `result.fallback` is `"without-kiosk"` or `"basic"`. In the catch block, display `UploadMediaError.message`; it already includes the orphaned filename when cleanup failed.

Replace `handleAddFromLibrary` insertion with `insertMediaWithCompatibility` and close the modal only after confirmed success:

```ts
try {
  const result = await insertMediaWithCompatibility(
    (value) => supabase.from("media_items").insert([value]),
    {
      url: itemUrl,
      type: itemType,
      duration,
      row_slot: selectedRow,
      kiosk_id: selectedKiosk,
    },
  );
  if (result.fallback !== "none") {
    alert("เพิ่มสื่อแล้ว แต่ฐานข้อมูลรุ่นเก่าไม่รองรับ Kiosk หรือ Row ที่เลือก");
  }
  await fetchMedia();
  setShowLibrary(false);
} catch (error) {
  alert(error instanceof Error ? error.message : "เพิ่มสื่อจากคลังไม่สำเร็จ");
}
```

- [ ] **Step 6: Verify Task 4**

Run:

```bash
npm test -- lib/mediaOperations.test.ts
npx eslint app/admin/page.tsx lib/mediaOperations.ts lib/mediaOperations.test.ts
```

Expected: upload regression tests pass; a failed insert invokes rollback for exactly the new object name; the library modal remains open after a failed insert.

---

### Task 5: Full verification and handoff

**Files:**
- Review: `package.json`
- Review: `package-lock.json`
- Review: `app/page.tsx`
- Review: `app/admin/page.tsx`
- Review: `lib/slideshow.ts`
- Review: `lib/slideshow.test.ts`
- Review: `lib/mediaOperations.ts`
- Review: `lib/mediaOperations.test.ts`

**Interfaces:**
- Consumes: all interfaces produced by Tasks 1-4
- Produces: verified test, lint, and build evidence

- [ ] **Step 1: Run the complete test suite**

Run:

```bash
npm test
```

Expected: all slideshow and media-operation tests pass with zero failed tests.

- [ ] **Step 2: Run ESLint without suppressions**

Run:

```bash
npm run lint
```

Expected: zero errors. If warnings remain, report their exact file and line; do not disable rules to manufacture a clean result.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected: Next.js compiles, TypeScript passes, and all routes prerender successfully.

- [ ] **Step 4: Review the four acceptance criteria against implementation**

Confirm from tests and code:

```text
1. A shrinking list cannot produce an undefined current slide.
2. Returned Supabase mutation errors restore or preserve the previous UI state.
3. Database deletion precedes storage deletion and partial cleanup is reported.
4. Failed inserts roll back only the object created by the current upload.
```

Expected: every statement maps to a passing regression test and the corresponding page integration.

- [ ] **Step 5: Report the workspace changes and limitations**

Run:

```bash
find app lib docs -type f -newer docs/superpowers/specs/2026-07-21-media-integrity-design.md -print
```

Expected: report all implementation and test files changed during this work. State explicitly that no commit was created because the workspace is not a Git repository.
