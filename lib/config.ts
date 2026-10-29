/** The year the site features: where / redirects, and what /admin opens by default. */
export const FEATURED_YEAR = Number(process.env.FEATURED_YEAR || 2026);

/** The year an admin page edits: ?year=2025, else the featured year. */
export function adminYear(raw: string | string[] | undefined): number {
  const year = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : FEATURED_YEAR;
}

/** The years the admin links to: every list, the featured year, and the one open. */
export function adminYears(listYears: number[], current: number): number[] {
  return [...new Set([...listYears, FEATURED_YEAR, current])].sort((a, b) => b - a);
}
