export function normalizeSlideIndex(
  index: number,
  itemCount: number,
): number | null {
  if (itemCount <= 0) return null;
  if (!Number.isInteger(index) || index < 0 || index >= itemCount) return 0;
  return index;
}
