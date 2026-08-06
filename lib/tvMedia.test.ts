import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  createTvMediaQuery,
  normalizeTvMedia,
  type TvMediaRow,
} from "./tvMedia";

type QueryCall =
  | ["from", string]
  | ["select", string]
  | ["eq", string, unknown]
  | ["order", string, { ascending: boolean }];

function createChainableSupabaseFake() {
  const calls: QueryCall[] = [];
  const builder = {
    select(columns: string) {
      calls.push(["select", columns]);
      return builder;
    },
    eq(column: string, value: unknown) {
      calls.push(["eq", column, value]);
      return builder;
    },
    order(column: string, options: { ascending: boolean }) {
      calls.push(["order", column, options]);
      return builder;
    },
  };
  const client = {
    from(table: string) {
      calls.push(["from", table]);
      return builder;
    },
  };

  return { calls, client: client as unknown as SupabaseClient };
}

describe("createTvMediaQuery", () => {
  it("builds the complete TVDLP playlist query in deterministic order", () => {
    const { calls, client } = createChainableSupabaseFake();

    createTvMediaQuery(client, "TVDLP_1");

    expect(calls).toEqual([
      ["from", "media_items"],
      ["select", "*"],
      ["eq", "kiosk_id", "TVDLP_1"],
      ["eq", "row_slot", 1],
      ["eq", "is_active", true],
      ["order", "sort_order", { ascending: true }],
      ["order", "created_at", { ascending: true }],
    ]);
  });
});

describe("normalizeTvMedia", () => {
  it("defaults nullable values and pins media to the requested TV channel", () => {
    expect(
      normalizeTvMedia(
        [
          {
            id: 5,
            url: "https://example.com/a.jpg",
            type: "image",
            duration: null,
            row_slot: 3,
            kiosk_id: "wrong",
            sort_order: null,
            is_active: true,
          },
        ],
        "TVDLP_2",
      ),
    ).toEqual([
      expect.objectContaining({
        id: 5,
        duration: 10,
        row_slot: 1,
        kiosk_id: "TVDLP_2",
        sort_order: 0,
      }),
    ]);
  });

  it("removes explicitly inactive rows without replacing valid zero values", () => {
    const rows: TvMediaRow[] = [
      {
        id: 8,
        url: "https://example.com/inactive.mp4",
        type: "video",
        duration: 12,
        row_slot: 1,
        kiosk_id: "TVDLP_1",
        sort_order: 4,
        is_active: false,
      },
      {
        id: 9,
        url: "https://example.com/active.jpg",
        type: "image",
        duration: 0,
        row_slot: 2,
        kiosk_id: "wrong",
        sort_order: 0,
      },
    ];

    expect(normalizeTvMedia(rows, "TVDLP_1")).toEqual([
      {
        id: 9,
        url: "https://example.com/active.jpg",
        type: "image",
        duration: 0,
        row_slot: 1,
        kiosk_id: "TVDLP_1",
        sort_order: 0,
      },
    ]);
  });
});
