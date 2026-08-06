# TVDLP Display Channels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independent `TVDLP_1` and `TVDLP_2` Admin targets and 16:9 display routes while preserving `kiosk-TV` and `/tv`.

**Architecture:** Put display identifiers, TV classification, labels, preview routes, and dynamic-route validation in one pure module. Reuse it in Admin, then extract the current TV client page into a shared component consumed by `/tv` and an allowlisted `/tv/[channel]` route.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase JS, Vitest, ESLint

## Global Constraints

- Keep `kiosk-TV` and `/tv` working unchanged.
- Store exact identifiers `TVDLP_1` and `TVDLP_2` in `media_items.kiosk_id`.
- Only those two identifiers are accepted by `/tv/[channel]`; others return 404.
- Every TV-type display uses active Row 1 media only, hides display-mode controls, and uses the existing non-cropping 16:9 layout.
- Do not add dependencies or change the database schema, RLS, or Storage policies.
- Observe every new test fail for the intended reason before production code is written.

## File Map

- Create `lib/displayChannels.ts` and `.test.ts`: canonical channel model.
- Modify `lib/adminView.ts` and `.test.ts`: generalized TV Row restriction.
- Modify `components/admin/ScreenSwitcher.tsx`, `components/admin/AdminShell.test.tsx`, and `app/admin/page.tsx`: Admin integration.
- Create `lib/tvMedia.ts` and `.test.ts`: query construction and normalization.
- Create `components/TvDisplay.tsx` and `.test.tsx`: shared TV client UI.
- Replace `app/tv/page.tsx` with a compatibility wrapper.
- Create `app/tv/[channel]/page.tsx`: allowlisted dynamic route.

---

### Task 1: Central channel model

**Files:**
- Create: `lib/displayChannels.ts`
- Create: `lib/displayChannels.test.ts`
- Modify: `lib/adminView.ts:1-11`
- Modify: `lib/adminView.test.ts:20-31`

**Interfaces:**
- Produces `ADMIN_DISPLAY_IDS`, `TvKioskId`, `DynamicTvChannel`, `isTvKiosk()`, `displayLabel()`, `previewHrefForKiosk()`, and `resolveDynamicTvChannel()`.

- [ ] **Step 1: Write failing tests**

Create `lib/displayChannels.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ADMIN_DISPLAY_IDS,
  displayLabel,
  isTvKiosk,
  previewHrefForKiosk,
  resolveDynamicTvChannel,
} from "./displayChannels";

describe("display channels", () => {
  it("includes both TVDLP displays", () => {
    expect(ADMIN_DISPLAY_IDS).toEqual([
      "kiosk-1", "kiosk-2", "kiosk-3", "kiosk-SPACE", "kiosk-TV",
      "TVDLP_1", "TVDLP_2",
    ]);
  });

  it.each(["kiosk-TV", "TVDLP_1", "TVDLP_2"])(
    "classifies %s as TV",
    (id) => expect(isTvKiosk(id)).toBe(true),
  );

  it("maps labels and preview routes", () => {
    expect(displayLabel("kiosk-TV")).toBe("TV");
    expect(displayLabel("TVDLP_1")).toBe("TVDLP_1");
    expect(previewHrefForKiosk("kiosk-TV")).toBe("/tv");
    expect(previewHrefForKiosk("TVDLP_1")).toBe("/tv/TVDLP_1");
    expect(previewHrefForKiosk("TVDLP_2")).toBe("/tv/TVDLP_2");
    expect(previewHrefForKiosk("kiosk-1")).toBe("/");
  });

  it("allows only the two dynamic TVDLP channels", () => {
    expect(resolveDynamicTvChannel("TVDLP_1")).toBe("TVDLP_1");
    expect(resolveDynamicTvChannel("TVDLP_2")).toBe("TVDLP_2");
    expect(resolveDynamicTvChannel("kiosk-TV")).toBeNull();
    expect(resolveDynamicTvChannel("unknown")).toBeNull();
  });
});
```

Change the existing `lib/adminView.test.ts` TV test to assert Row 1 for all three TV IDs and Rows 1–3 for `kiosk-1`.

- [ ] **Step 2: Verify RED**

Run `npm test -- lib/displayChannels.test.ts lib/adminView.test.ts`.

Expected: FAIL because the new module is missing and `visibleRowsForKiosk()` only recognizes `kiosk-TV`.

- [ ] **Step 3: Implement the channel model**

Create `lib/displayChannels.ts`:

```ts
export const ADMIN_DISPLAY_IDS = [
  "kiosk-1", "kiosk-2", "kiosk-3", "kiosk-SPACE", "kiosk-TV",
  "TVDLP_1", "TVDLP_2",
] as const;

export const TV_KIOSK_IDS = ["kiosk-TV", "TVDLP_1", "TVDLP_2"] as const;
export const DYNAMIC_TV_CHANNELS = ["TVDLP_1", "TVDLP_2"] as const;
export type TvKioskId = (typeof TV_KIOSK_IDS)[number];
export type DynamicTvChannel = (typeof DYNAMIC_TV_CHANNELS)[number];

export function isTvKiosk(id: string): id is TvKioskId {
  return TV_KIOSK_IDS.some((candidate) => candidate === id);
}

export function displayLabel(id: string): string {
  if (id === "kiosk-TV") return "TV";
  if (id === "kiosk-SPACE") return "SPACE";
  if (id === "TVDLP_1" || id === "TVDLP_2") return id;
  return id.replace("kiosk-", "Kiosk ");
}

export function resolveDynamicTvChannel(channel: string): DynamicTvChannel | null {
  return DYNAMIC_TV_CHANNELS.find((candidate) => candidate === channel) ?? null;
}

export function previewHrefForKiosk(id: string): string {
  if (id === "kiosk-TV") return "/tv";
  return resolveDynamicTvChannel(id) ? `/tv/${id}` : "/";
}
```

In `lib/adminView.ts`, import `isTvKiosk` and return `[1]` when it is true; otherwise return a copy of `ALL_ROWS`.

- [ ] **Step 4: Verify GREEN**

Run `npm test -- lib/displayChannels.test.ts lib/adminView.test.ts`.

Expected: both files pass with zero failures.

- [ ] **Step 5: Commit**

```bash
git add lib/displayChannels.ts lib/displayChannels.test.ts lib/adminView.ts lib/adminView.test.ts
git commit -m "feat: define TVDLP display channels"
```

---

### Task 2: Admin integration

**Files:**
- Modify: `components/admin/ScreenSwitcher.tsx:1-31`
- Modify: `components/admin/AdminShell.test.tsx`
- Modify: `app/admin/page.tsx:1-40,574-604`

**Interfaces:**
- Consumes the Task 1 channel exports.
- Produces two new Admin buttons, TV restrictions, and exact Preview URLs.

- [ ] **Step 1: Write failing Admin tests**

Add parameterized cases to `components/admin/AdminShell.test.tsx`:

```tsx
import { ADMIN_DISPLAY_IDS, previewHrefForKiosk } from "@/lib/displayChannels";

it.each([["TVDLP_1", "/tv/TVDLP_1"], ["TVDLP_2", "/tv/TVDLP_2"]] as const)(
  "renders %s with its preview route",
  (id, href) => {
    const header = renderToStaticMarkup(
      <AdminHeader selectedKiosk={id} isTvKiosk
        previewHref={previewHrefForKiosk(id)} onLogout={() => {}} />,
    );
    const switcher = renderToStaticMarkup(
      <ScreenSwitcher kiosks={ADMIN_DISPLAY_IDS} selectedKiosk={id}
        mediaCounts={{ [id]: 3 }} displayMode="3row" isSavingMode={false}
        onSelectKiosk={() => {}} onSelectMode={() => {}} />,
    );
    expect(header).toContain(`href="${href}"`);
    expect(header).toContain("TV 16:9");
    expect(switcher).toContain("TVDLP_1");
    expect(switcher).toContain("TVDLP_2");
    expect(switcher).not.toContain("3 แถว");
  },
);
```

- [ ] **Step 2: Verify RED**

Run `npm test -- components/admin/AdminShell.test.tsx`.

Expected: FAIL because `ScreenSwitcher` recognizes only `kiosk-TV` as TV.

- [ ] **Step 3: Implement Admin integration**

In `ScreenSwitcher.tsx`, import `displayLabel` and `isTvKiosk`, replace the local `kioskLabel()`, and calculate `const isTv = isTvKiosk(selectedKiosk)`.

In `app/admin/page.tsx`, remove local `KIOSK_LIST`, import Task 1 helpers, then use:

```ts
const handleSelectKiosk = (kioskId: string) => {
  setSelectedKiosk(kioskId);
  setMediaRowFilter("all");
  if (isTvKiosk(kioskId)) setSelectedRow(1);
  else fetchDisplayMode(kioskId);
};

const isTvDisplay = isTvKiosk(selectedKiosk);
const previewHref = previewHrefForKiosk(selectedKiosk);
```

Pass `ADMIN_DISPLAY_IDS` to `ScreenSwitcher` and `isTvDisplay` to the existing `isTvKiosk` props on `AdminHeader` and `MediaWorkspace`.

- [ ] **Step 4: Verify GREEN**

Run `npm test -- components/admin/AdminShell.test.tsx components/admin/MediaWorkspace.test.tsx components/admin/UploadPanel.test.tsx lib/adminView.test.ts`.

Expected: all listed tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/admin/page.tsx components/admin/ScreenSwitcher.tsx components/admin/AdminShell.test.tsx
git commit -m "feat: expose TVDLP channels in admin"
```

---

### Task 3: Reusable TV media loader

**Files:**
- Create: `lib/tvMedia.ts`
- Create: `lib/tvMedia.test.ts`

**Interfaces:**
- Consumes `TvKioskId`, `MediaItem`, and a `SupabaseClient`.
- Produces `TvMediaRow`, `createTvMediaQuery()`, and `normalizeTvMedia()`.

- [ ] **Step 1: Write failing loader tests**

Create `lib/tvMedia.test.ts` with a chainable fake Supabase builder. Assert `from("media_items")`, `select("*")`, equality filters for the supplied `TVDLP_1`, Row 1, and active `true`, followed by ascending orders for `sort_order` and `created_at`. Add this normalization assertion:

```ts
expect(normalizeTvMedia([{
  id: 5, url: "https://example.com/a.jpg", type: "image",
  duration: null, row_slot: 3, kiosk_id: "wrong", sort_order: null,
  is_active: true,
}], "TVDLP_2")).toEqual([expect.objectContaining({
  id: 5, duration: 10, row_slot: 1, kiosk_id: "TVDLP_2", sort_order: 0,
})]);
```

- [ ] **Step 2: Verify RED**

Run `npm test -- lib/tvMedia.test.ts`.

Expected: FAIL because `lib/tvMedia.ts` is missing.

- [ ] **Step 3: Implement loader helpers**

Create `lib/tvMedia.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaItem } from "@/components/MediaSlideshow";
import type { TvKioskId } from "./displayChannels";

export type TvMediaRow = Omit<MediaItem, "duration" | "sort_order"> & {
  created_at?: string;
  duration?: number | null;
  is_active?: boolean;
  sort_order?: number | null;
};

export function createTvMediaQuery(client: SupabaseClient, kioskId: TvKioskId) {
  return client.from("media_items").select("*")
    .eq("kiosk_id", kioskId).eq("row_slot", 1).eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
}

export function normalizeTvMedia(rows: TvMediaRow[], kioskId: TvKioskId): MediaItem[] {
  return rows.map((item, index) => ({
    ...item, duration: item.duration ?? 10, row_slot: 1 as const,
    kiosk_id: kioskId, sort_order: item.sort_order ?? index,
  })).filter((item) => item.is_active !== false);
}
```

- [ ] **Step 4: Verify GREEN**

Run `npm test -- lib/tvMedia.test.ts`.

Expected: query and normalization cases pass.

- [ ] **Step 5: Commit**

```bash
git add lib/tvMedia.ts lib/tvMedia.test.ts
git commit -m "refactor: centralize TV media loading"
```

---

### Task 4: Shared TV display and dynamic routes

**Files:**
- Create: `components/TvDisplay.tsx`
- Create: `components/TvDisplay.test.tsx`
- Modify: `app/tv/page.tsx`
- Create: `app/tv/[channel]/page.tsx`

**Interfaces:**
- Produces `TvDisplay({ kioskId: TvKioskId, channelLabel: string })`.
- Consumes Task 1 route validation, Task 3 loader helpers, `MediaSlideshow`, Supabase, and existing TV CSS.

- [ ] **Step 1: Write a failing shared-component smoke test**

```tsx
import { describe, expect, it, vi } from "vitest";
import { TvDisplay } from "./TvDisplay";

vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));

describe("TvDisplay", () => {
  it("exports the shared TV display", () => {
    expect(TvDisplay).toBeTypeOf("function");
  });
});
```

- [ ] **Step 2: Verify RED**

Run `npm test -- components/TvDisplay.test.tsx`.

Expected: FAIL because `components/TvDisplay.tsx` is missing.

- [ ] **Step 3: Extract the shared client component**

Move the current state, polling, fullscreen handling, and JSX from `app/tv/page.tsx` to `components/TvDisplay.tsx`. Replace the hard-coded ID and normalization with:

```tsx
interface TvDisplayProps {
  kioskId: TvKioskId;
  channelLabel: string;
}

export function TvDisplay({ kioskId, channelLabel }: TvDisplayProps) {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMedia = useCallback(async () => {
    const { data, error } = await createTvMediaQuery(supabase, kioskId);
    if (error) {
      console.error(`Error fetching ${channelLabel} media:`, error);
      setLoadError(true);
      setLoading(false);
      return;
    }
    setMediaList(normalizeTvMedia((data ?? []) as TvMediaRow[], kioskId));
    setLoadError(false);
    setLoading(false);
  }, [channelLabel, kioskId]);
```

Retain the exact 30-second interval, cached playlist on refresh error, fullscreen lifecycle, CSS classes, SVG, and 16:9 slideshow. Parameterize copy as `กำลังโหลดสื่อสำหรับ ${channelLabel}`, `ไม่สามารถโหลดสื่อสำหรับ ${channelLabel}`, and `ยังไม่มีสื่อสำหรับ ${channelLabel}`.

- [ ] **Step 4: Preserve `/tv` and add the dynamic route**

Replace `app/tv/page.tsx` with:

```tsx
import { TvDisplay } from "@/components/TvDisplay";
export default function TvPage() {
  return <TvDisplay kioskId="kiosk-TV" channelLabel="TV" />;
}
```

Create `app/tv/[channel]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { TvDisplay } from "@/components/TvDisplay";
import { resolveDynamicTvChannel } from "@/lib/displayChannels";

export default async function TvChannelPage({
  params,
}: { params: Promise<{ channel: string }> }) {
  const { channel } = await params;
  const kioskId = resolveDynamicTvChannel(channel);
  if (!kioskId) notFound();
  return <TvDisplay kioskId={kioskId} channelLabel={kioskId} />;
}
```

- [ ] **Step 5: Verify GREEN**

Run `npm test -- components/TvDisplay.test.tsx lib/tvMedia.test.ts lib/displayChannels.test.ts components/admin/AdminShell.test.tsx lib/adminView.test.ts`.

Expected: all focused tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/TvDisplay.tsx components/TvDisplay.test.tsx app/tv/page.tsx 'app/tv/[channel]/page.tsx'
git commit -m "feat: add TVDLP display routes"
```

---

### Task 5: Full verification

**Files:** Verify only.

**Interfaces:** Produces fresh test, lint, build, and diff evidence.

- [ ] **Step 1: Run all tests**

Run `npm test`.

Expected: all Vitest tests pass with zero failures.

- [ ] **Step 2: Run lint**

Run `npm run lint`.

Expected: exit 0 with no ESLint errors.

- [ ] **Step 3: Run production build**

Run `npm run build`.

Expected: exit 0 and Next.js reports `/tv` plus `/tv/[channel]` without compilation errors.

- [ ] **Step 4: Inspect final state**

```bash
git status --short
git diff --check
git log --oneline -5
```

Expected: no whitespace errors or unrelated changes. Confirm the implementation maps `/tv` to `kiosk-TV`, maps each new URL to its exact ID, calls `notFound()` for unsupported dynamic channels, and applies Row 1 TV behavior to all three IDs.
