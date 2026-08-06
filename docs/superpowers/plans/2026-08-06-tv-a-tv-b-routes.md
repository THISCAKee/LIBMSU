# TV A and TV B Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `TVDLP_1`, `TVDLP_2`, and `/tv` with explicit `/tvA` and `/tvB` displays while preserving the original TV playlist under TV A.

**Architecture:** Update the centralized channel model to expose `kiosk-TV` as TV A and `kiosk-TV-B` as TV B. Replace the `/tv` route tree with two flat wrappers around the existing shared `TvDisplay` component.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase JS

## Global Constraints

- `TV A` maps to `kiosk_id = "kiosk-TV"` and Preview `/tvA`.
- `TV B` maps to `kiosk_id = "kiosk-TV-B"` and Preview `/tvB`.
- Remove `TVDLP_1` and `TVDLP_2` from application configuration without deleting database rows.
- Remove `/tv` and `/tv/[channel]` without redirects.
- Keep active Row 1 querying, 30-second polling, fullscreen behavior, and 16:9 layout unchanged.
- Do not change Supabase schema, RLS, or Storage policies.
- At the user's request, do not run tests, lint, TypeScript checks, browser tests, or production builds.

---

### Task 1: Replace the channel model

**Files:**
- Modify: `lib/displayChannels.ts`
- Modify: `lib/displayChannels.test.ts`
- Modify: `lib/adminView.test.ts`
- Modify: `lib/tvMedia.test.ts`
- Modify: `components/admin/AdminShell.test.tsx`

**Interfaces:**
- Produces `ADMIN_DISPLAY_IDS` containing `kiosk-TV` and `kiosk-TV-B`.
- Produces TV classification, labels `TV A`/`TV B`, and preview mappings `/tvA`/`/tvB`.

- [ ] **Step 1: Update production channel constants and helpers**

Use this model in `lib/displayChannels.ts`:

```ts
export const ADMIN_DISPLAY_IDS = [
  "kiosk-1", "kiosk-2", "kiosk-3", "kiosk-SPACE", "kiosk-TV", "kiosk-TV-B",
] as const;

export const TV_KIOSK_IDS = ["kiosk-TV", "kiosk-TV-B"] as const;
export type TvKioskId = (typeof TV_KIOSK_IDS)[number];

export function displayLabel(id: string): string {
  if (id === "kiosk-TV") return "TV A";
  if (id === "kiosk-TV-B") return "TV B";
  if (id === "kiosk-SPACE") return "SPACE";
  return id.replace("kiosk-", "Kiosk ");
}

export function previewHrefForKiosk(id: string): string {
  if (id === "kiosk-TV") return "/tvA";
  if (id === "kiosk-TV-B") return "/tvB";
  return "/";
}
```

Delete `DYNAMIC_TV_CHANNELS`, `DynamicTvChannel`, and `resolveDynamicTvChannel()`.

- [ ] **Step 2: Keep existing test sources consistent without executing them**

Replace TVDLP expectations with:

```ts
expect(displayLabel("kiosk-TV")).toBe("TV A");
expect(displayLabel("kiosk-TV-B")).toBe("TV B");
expect(previewHrefForKiosk("kiosk-TV")).toBe("/tvA");
expect(previewHrefForKiosk("kiosk-TV-B")).toBe("/tvB");
expect(visibleRowsForKiosk("kiosk-TV-B")).toEqual([1]);
```

Update TV media fixtures to use `kiosk-TV` or `kiosk-TV-B`. Remove all `TVDLP_1`, `TVDLP_2`, and dynamic-channel assertions.

- [ ] **Step 3: Inspect the Task 1 diff**

Run only `git diff --check` and `rg -n "TVDLP_1|TVDLP_2|resolveDynamicTvChannel" lib components app`.

Expected: no whitespace errors and no application/test references to removed TVDLP identifiers or the dynamic resolver.

---

### Task 2: Replace TV routes

**Files:**
- Delete: `app/tv/page.tsx`
- Delete: `app/tv/[channel]/page.tsx`
- Create: `app/tvA/page.tsx`
- Create: `app/tvB/page.tsx`
- Reuse unchanged: `components/TvDisplay.tsx`

**Interfaces:**
- Consumes `TvDisplay({ kioskId: TvKioskId, channelLabel: string })`.
- Produces `/tvA` and `/tvB` only.

- [ ] **Step 1: Create the two flat route wrappers**

Create `app/tvA/page.tsx`:

```tsx
import { TvDisplay } from "@/components/TvDisplay";
export default function TvAPage() {
  return <TvDisplay kioskId="kiosk-TV" channelLabel="TV A" />;
}
```

Create `app/tvB/page.tsx`:

```tsx
import { TvDisplay } from "@/components/TvDisplay";
export default function TvBPage() {
  return <TvDisplay kioskId="kiosk-TV-B" channelLabel="TV B" />;
}
```

- [ ] **Step 2: Delete obsolete route files**

Delete `app/tv/page.tsx` and `app/tv/[channel]/page.tsx`. Do not create redirects or replacements under `app/tv`.

- [ ] **Step 3: Inspect the complete diff and commit**

Run `git diff --check`, `git status --short`, and a source search for `/tvA`, `/tvB`, `kiosk-TV-B`, and removed TVDLP identifiers. Do not run executable verification commands.

Commit:

```bash
git add lib/displayChannels.ts lib/displayChannels.test.ts lib/adminView.test.ts lib/tvMedia.test.ts components/admin/AdminShell.test.tsx app/tvA/page.tsx app/tvB/page.tsx app/tv/page.tsx 'app/tv/[channel]/page.tsx'
git commit -m "feat: replace TVDLP routes with TV A and TV B"
```
