export const ADMIN_DISPLAY_IDS = [
  "kiosk-1",
  "kiosk-2",
  "kiosk-3",
  "kiosk-SPACE",
  "kiosk-TV",
  "kiosk-TV-B",
] as const;

export const TV_KIOSK_IDS = ["kiosk-TV", "kiosk-TV-B"] as const;
export type TvKioskId = (typeof TV_KIOSK_IDS)[number];

export function isTvKiosk(id: string): id is TvKioskId {
  return TV_KIOSK_IDS.some((candidate) => candidate === id);
}

export function displayLabel(id: string): string {
  if (id === "kiosk-TV") return "TV A";
  if (id === "kiosk-TV-B") return "TV B";
  if (id === "kiosk-SPACE") return "SPACE";
  return id.replace("kiosk-", "Kiosk ");
}

export function previewHrefForKiosk(id: string): string {
  if (id === "kiosk-TV") return "/tvA";
  if (id === "kiosk-TV-B") return "/tvB";
  return "/";
}
