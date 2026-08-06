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
      "kiosk-1",
      "kiosk-2",
      "kiosk-3",
      "kiosk-SPACE",
      "kiosk-TV",
      "TVDLP_1",
      "TVDLP_2",
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
