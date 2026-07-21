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
