import { describe, expect, it } from "vitest";
import {
  countMediaByKiosk,
  filterMediaForWorkspace,
  formatOrderNumber,
  moveMediaToRow,
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
  it.each(["kiosk-TV", "TVDLP_1", "TVDLP_2"])(
    "restricts %s to Row 1",
    (id) => expect(visibleRowsForKiosk(id)).toEqual([1]),
  );

  it("allows Rows 1–3 for a standard kiosk", () => {
    expect(visibleRowsForKiosk("kiosk-1")).toEqual([1, 2, 3]);
  });

  it("filters by kiosk and optional Row", () => {
    const items = [
      media({ id: 1, row_slot: 1 }),
      media({ id: 2, row_slot: 2 }),
      media({ id: 3, kiosk_id: "kiosk-2", row_slot: 1 }),
    ];

    expect(
      filterMediaForWorkspace(items, "kiosk-1", "all").map(
        (item) => item.id,
      ),
    ).toEqual([1, 2]);
    expect(
      filterMediaForWorkspace(items, "kiosk-1", 2).map((item) => item.id),
    ).toEqual([2]);
  });

  it("counts media by kiosk", () => {
    const items = [
      media({ id: 1 }),
      media({ id: 2 }),
      media({ id: 3, kiosk_id: "kiosk-TV" }),
    ];

    expect(countMediaByKiosk(items)).toEqual({
      "kiosk-1": 2,
      "kiosk-TV": 1,
    });
  });

  it("deduplicates library media by URL", () => {
    const items = [
      media({ id: 1 }),
      media({ id: 2 }),
      media({ id: 3, url: "https://example.com/b.jpg" }),
    ];

    expect(uniqueLibraryMedia(items).map((item) => item.id)).toEqual([1, 3]);
  });

  it("formats one-based playlist order", () => {
    expect(formatOrderNumber(0)).toBe("01");
    expect(formatOrderNumber(11)).toBe("12");
  });

  it("moves media to the end of a target Row without touching other kiosks", () => {
    const items = [
      media({ id: 1, row_slot: 1, sort_order: 0 }),
      media({ id: 2, row_slot: 2, sort_order: 0 }),
      media({ id: 3, kiosk_id: "kiosk-2", row_slot: 2, sort_order: 4 }),
    ];

    const result = moveMediaToRow(items, 1, 2, "kiosk-1");

    expect(result.sortOrder).toBe(1);
    expect(result.items.find((item) => item.id === 1)).toMatchObject({
      row_slot: 2,
      sort_order: 1,
    });
    expect(result.items.find((item) => item.id === 3)).toMatchObject({
      row_slot: 2,
      sort_order: 4,
    });
  });
});
