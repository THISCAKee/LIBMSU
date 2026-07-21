import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MediaLibraryModal } from "./MediaLibraryModal";
import type { AdminMediaItem } from "./types";

const item: AdminMediaItem = {
  id: 1,
  url: "https://example.com/shared.jpg",
  type: "image",
  duration: 10,
  row_slot: 1,
  is_active: true,
  kiosk_id: "kiosk-1",
  sort_order: 0,
  display_mode_filter: "both",
};

describe("MediaLibraryModal", () => {
  it("renders unique media and target context in a dialog", () => {
    const html = renderToStaticMarkup(
      <MediaLibraryModal
        open
        media={[item, { ...item, id: 2, kiosk_id: "kiosk-2" }]}
        selectedKiosk="kiosk-TV"
        selectedRow={1}
        triggerRef={createRef<HTMLButtonElement>()}
        onAdd={() => {}}
        onClose={() => {}}
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain("KIOSK-TV · ROW 1");
    expect(html.match(/เพิ่มลง Row 1/g)).toHaveLength(1);
  });

  it("renders nothing while closed", () => {
    const html = renderToStaticMarkup(
      <MediaLibraryModal
        open={false}
        media={[]}
        selectedKiosk="kiosk-1"
        selectedRow={1}
        triggerRef={createRef<HTMLButtonElement>()}
        onAdd={() => {}}
        onClose={() => {}}
      />,
    );

    expect(html).toBe("");
  });
});
