import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaItem } from "@/components/MediaSlideshow";
import type { TvKioskId } from "./displayChannels";

export type TvMediaRow = Omit<MediaItem, "duration" | "sort_order"> & {
  created_at?: string;
  duration?: number | null;
  is_active?: boolean;
  sort_order?: number | null;
};

export function createTvMediaQuery(
  client: SupabaseClient,
  kioskId: TvKioskId,
) {
  return client
    .from("media_items")
    .select("*")
    .eq("kiosk_id", kioskId)
    .eq("row_slot", 1)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
}

export function normalizeTvMedia(
  rows: TvMediaRow[],
  kioskId: TvKioskId,
): MediaItem[] {
  return rows
    .map((item, index) => ({
      ...item,
      duration: item.duration ?? 10,
      row_slot: 1 as const,
      kiosk_id: kioskId,
      sort_order: item.sort_order ?? index,
    }))
    .filter((item) => item.is_active !== false);
}
