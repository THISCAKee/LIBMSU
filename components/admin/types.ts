export type RowSlot = 1 | 2 | 3;
export type ModeFilter = "both" | "3row" | "single";
export type DisplayMode = "3row" | "single";
export type MediaRowFilter = "all" | RowSlot;

export interface AdminMediaItem {
  id: number;
  url: string;
  type: "image" | "video";
  duration: number;
  row_slot: RowSlot;
  is_active: boolean;
  kiosk_id: string;
  sort_order: number;
  display_mode_filter: ModeFilter;
}
