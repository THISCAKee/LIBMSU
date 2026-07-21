import type {
  AdminMediaItem,
  MediaRowFilter,
  RowSlot,
} from "@/components/admin/types";

const ALL_ROWS: RowSlot[] = [1, 2, 3];

export function visibleRowsForKiosk(kioskId: string): RowSlot[] {
  return kioskId === "kiosk-TV" ? [1] : [...ALL_ROWS];
}

export function filterMediaForWorkspace(
  items: AdminMediaItem[],
  kioskId: string,
  row: MediaRowFilter,
): AdminMediaItem[] {
  return items.filter(
    (item) =>
      item.kiosk_id === kioskId && (row === "all" || item.row_slot === row),
  );
}

export function countMediaByKiosk(
  items: AdminMediaItem[],
): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[item.kiosk_id] = (counts[item.kiosk_id] ?? 0) + 1;
    return counts;
  }, {});
}

export function uniqueLibraryMedia(
  items: AdminMediaItem[],
): AdminMediaItem[] {
  const unique = new Map<string, AdminMediaItem>();
  for (const item of items) {
    if (!unique.has(item.url)) unique.set(item.url, item);
  }
  return Array.from(unique.values());
}

export function formatOrderNumber(zeroBasedIndex: number): string {
  return String(zeroBasedIndex + 1).padStart(2, "0");
}

export function moveMediaToRow(
  items: AdminMediaItem[],
  id: number,
  targetRow: RowSlot,
  kioskId: string,
): { items: AdminMediaItem[]; sortOrder: number } {
  const sortOrder = items.filter(
    (item) => item.kiosk_id === kioskId && item.row_slot === targetRow,
  ).length;

  return {
    sortOrder,
    items: items.map((item) =>
      item.id === id
        ? { ...item, row_slot: targetRow, sort_order: sortOrder }
        : item,
    ),
  };
}
