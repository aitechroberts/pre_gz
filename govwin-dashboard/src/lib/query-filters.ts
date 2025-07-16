// utils/query-filters.ts ------------------------------------------------
export function relevantClause(
  relevantFilter: string[] | undefined,
  userId: string
): string | null {
  if (!relevantFilter || relevantFilter.length === 0) return null;

  const parts: string[] = [];

  if (relevantFilter.includes("saved")) {
    parts.push(`IS_DEFINED(c.userSaves["${userId}"])`);
  }
  if (relevantFilter.includes("archived")) {
    parts.push(`IS_DEFINED(c.archived["${userId}"])`);
  }
  if (relevantFilter.includes("unreviewed")) {
    // unreviewed = neither saved nor archived
    parts.push(
      `NOT IS_DEFINED(c.userSaves["${userId}"]) AND NOT IS_DEFINED(c.archived["${userId}"])`
    );
  }
  return parts.length ? `(${parts.join(" OR ")})` : null;
}

export function seenClause(
  seenFilter: string[] | undefined,
  userId: string
): string | null {
  if (!seenFilter || seenFilter.length === 0) return null;

  const parts: string[] = [];

  if (seenFilter.includes("seen")) {
    parts.push(`IS_DEFINED(c.seenBy["${userId}"])`);
  }
  if (seenFilter.includes("unseen")) {
    parts.push(`NOT IS_DEFINED(c.seenBy["${userId}"])`);
  }
  return parts.length ? `(${parts.join(" OR ")})` : null;
}
