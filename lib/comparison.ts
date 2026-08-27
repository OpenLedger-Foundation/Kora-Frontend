export const MAX_COMPARISON = 3;

export function normalizeComparisonList(ids: string[]): string[] {
  const unique = ids.filter((id, index) => id && ids.indexOf(id) === index);
  return unique.slice(-MAX_COMPARISON);
}

export function toggleComparisonId(ids: string[], id: string): string[] {
  if (ids.includes(id)) {
    return ids.filter((entry) => entry !== id);
  }
  return normalizeComparisonList([...ids, id]);
}

export function buildRangeSelection(
  orderedIds: string[],
  anchorIndex: number,
  targetIndex: number,
  existingIds: string[]
): string[] {
  if (orderedIds.length === 0) return [];
  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  const range = orderedIds.slice(start, end + 1);
  return normalizeComparisonList([
    ...existingIds.filter((id) => !orderedIds.includes(id)),
    ...range,
  ]);
}
