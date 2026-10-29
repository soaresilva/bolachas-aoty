/** The first FULL_WIDTH_COUNT albums get a full-width row each; the rest sit
 * two to a row (21 and 22, 23 and 24, ...). */
export const FULL_WIDTH_COUNT = 20;

export function splitRanked<T>(ranked: T[], full = FULL_WIDTH_COUNT): { top: T[]; rest: T[] } {
  return { top: ranked.slice(0, full), rest: ranked.slice(full) };
}
