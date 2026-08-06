import { describe, expect, it } from "vitest";
import {
  ADMIN_DISPLAY_IDS,
  displayLabel,
  isTvKiosk,
  previewHrefForKiosk,
} from "./displayChannels";

describe("display channels", () => {
  it("includes TV A and TV B displays", () => {
    expect(ADMIN_DISPLAY_IDS).toEqual([
      "kiosk-1",
      "kiosk-2",
      "kiosk-3",
      "kiosk-SPACE",
      "kiosk-TV",
      "kiosk-TV-B",
    ]);
  });

  it.each(["kiosk-TV", "kiosk-TV-B"])(
    "classifies %s as TV",
    (id) => expect(isTvKiosk(id)).toBe(true),
  );

  it("maps labels and preview routes", () => {
    expect(displayLabel("kiosk-TV")).toBe("TV A");
    expect(displayLabel("kiosk-TV-B")).toBe("TV B");
    expect(previewHrefForKiosk("kiosk-TV")).toBe("/tvA");
    expect(previewHrefForKiosk("kiosk-TV-B")).toBe("/tvB");
    expect(previewHrefForKiosk("kiosk-1")).toBe("/");
  });
});
