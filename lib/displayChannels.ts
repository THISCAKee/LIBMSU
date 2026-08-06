export const ADMIN_DISPLAY_IDS = [
  "kiosk-1",
  "kiosk-2",
  "kiosk-3",
  "kiosk-SPACE",
  "kiosk-TV",
  "TVDLP_1",
  "TVDLP_2",
] as const;

export const TV_KIOSK_IDS = ["kiosk-TV", "TVDLP_1", "TVDLP_2"] as const;
export const DYNAMIC_TV_CHANNELS = ["TVDLP_1", "TVDLP_2"] as const;
export type TvKioskId = (typeof TV_KIOSK_IDS)[number];
export type DynamicTvChannel = (typeof DYNAMIC_TV_CHANNELS)[number];

export function isTvKiosk(id: string): id is TvKioskId {
  return TV_KIOSK_IDS.some((candidate) => candidate === id);
}

export function displayLabel(id: string): string {
  if (id === "kiosk-TV") return "TV";
  if (id === "kiosk-SPACE") return "SPACE";
  if (id === "TVDLP_1" || id === "TVDLP_2") return id;
  return id.replace("kiosk-", "Kiosk ");
}

export function resolveDynamicTvChannel(
  channel: string,
): DynamicTvChannel | null {
  return DYNAMIC_TV_CHANNELS.find((candidate) => candidate === channel) ?? null;
}

export function previewHrefForKiosk(id: string): string {
  if (id === "kiosk-TV") return "/tv";
  return resolveDynamicTvChannel(id) ? `/tv/${id}` : "/";
}
