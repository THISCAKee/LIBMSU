import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MediaCard } from "./MediaCard";
import { MediaWorkspace } from "./MediaWorkspace";
import type { AdminMediaItem } from "./types";

const item: AdminMediaItem = {
  id: 7,
  url: "https://example.com/poster.jpg",
  type: "image",
  duration: 10,
  row_slot: 1,
  is_active: true,
  kiosk_id: "kiosk-1",
  sort_order: 0,
  display_mode_filter: "both",
};

const actions = {
  onDragStart: () => {},
  onDragEnter: () => {},
  onDragEnd: () => {},
  onUpdateDuration: () => {},
  onToggleActive: () => {},
  onUpdateModeFilter: () => {},
  onMoveToRow: () => {},
  onDelete: () => {},
};

describe("Media catalog", () => {
  it("shows contact-sheet order and reachable actions", () => {
    const html = renderToStaticMarkup(
      <MediaCard
        item={item}
        orderIndex={0}
        isTvKiosk={false}
        visibleRows={[1, 2, 3]}
        isDragging={false}
        {...actions}
      />,
    );

    expect(html).toContain("01");
    expect(html).toContain("10 วินาที");
    expect(html).toContain("ซ่อนจากจอ");
    expect(html).toContain("ทุกโหมด");
    expect(html).toContain("ย้ายไป");
    expect(html).toContain("ลบ");
  });

  it("omits mode and extra Rows for TV cards", () => {
    const html = renderToStaticMarkup(
      <MediaCard
        item={{ ...item, kiosk_id: "kiosk-TV" }}
        orderIndex={0}
        isTvKiosk
        visibleRows={[1]}
        isDragging={false}
        {...actions}
      />,
    );

    expect(html).not.toContain("ทุกโหมด");
    expect(html).not.toContain("Row 2");
  });

  it("renders row filters and selected-kiosk media only", () => {
    const html = renderToStaticMarkup(
      <MediaWorkspace
        items={[
          item,
          { ...item, id: 8, row_slot: 2, sort_order: 1 },
          { ...item, id: 9, kiosk_id: "kiosk-2" },
        ]}
        selectedKiosk="kiosk-1"
        visibleRows={[1, 2, 3]}
        filter="all"
        isTvKiosk={false}
        isSavingOrder={false}
        draggingId={null}
        dragOverId={null}
        dragSourceRow={null}
        dropTargetRow={null}
        onFilterChange={() => {}}
        onDragStart={() => {}}
        onDragEnterCard={() => {}}
        onRowDragEnter={() => {}}
        onRowDragLeave={() => {}}
        onRowDrop={() => {}}
        onDragEnd={() => {}}
        onUpdateDuration={() => {}}
        onToggleActive={() => {}}
        onUpdateModeFilter={() => {}}
        onMoveToRow={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(html).toContain("ทั้งหมด");
    expect(html).toContain("Row 3");
    expect(html).toContain("2 รายการ");
    expect(html).not.toContain("3 รายการ");
  });
});
