// Pure operations on the ranked order (an array of entry ids, #1 first).
// Every mutation computes the new full order here and the repository writes
// it back in one statement, so positions are always exactly 1..N.

/** Moves (or inserts) id to a 1-based position, clamped to the list. */
export function placeAt(order: number[], id: number, position: number): number[] {
  const rest = order.filter((x) => x !== id);
  const index = Math.min(Math.max(Math.trunc(position) - 1, 0), rest.length);
  return [...rest.slice(0, index), id, ...rest.slice(index)];
}

export function without(order: number[], id: number): number[] {
  return order.filter((x) => x !== id);
}

/** Null if `proposed` is a permutation of `current`, else what's wrong.
 * A reorder from the admin must cover exactly the ranked entries: a stale
 * browser tab that misses one, or a double-submitted id, is refused rather
 * than silently dropping or duplicating an album. */
export function checkPermutation(current: number[], proposed: number[]): string | null {
  if (new Set(proposed).size !== proposed.length) return "duplicate ids";
  const have = new Set(current);
  if (proposed.length !== current.length || proposed.some((id) => !have.has(id))) {
    return "ids don't match the ranked entries (reload and try again)";
  }
  return null;
}

/** The position typed into a "Move to #" / "Add at #" box, or null when
 * submitting it should do nothing: not a whole number >= 1, or the rank the
 * entry already has. `current` is null for a shortlist entry, where every
 * position (including the prefilled "end of list") is a real change. */
export function placeTarget(value: string, current: number | null): number | null {
  const n = Number(value.trim());
  if (!value.trim() || !Number.isInteger(n) || n < 1) return null;
  return n === current ? null : n;
}
