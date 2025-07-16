// src/lib/query-filters.ts
// Filter clause builders for opportunities (global user interactions)

export function relevantClause(
  relevantFilter: string[] | undefined
): string | null {
  if (!relevantFilter || relevantFilter.length === 0 || relevantFilter.includes('all')) {
    return null;
  }

  const parts: string[] = [];

  if (relevantFilter.includes('saved')) {
    // Any user has saved (userSaves object is defined and non-empty)
    parts.push('IS_DEFINED(c.userSaves) AND c.userSaves != {}');
  }
  if (relevantFilter.includes('archived')) {
    // Any user has archived (archived object is defined and non-empty)
    parts.push('IS_DEFINED(c.archived) AND c.archived != {}');
  }
  if (relevantFilter.includes('pursued')) {
    // Any user has pursued (pursued object is defined and non-empty)
    parts.push('IS_DEFINED(c.pursued) AND c.pursued != {}');
  }
  if (relevantFilter.includes('unreviewed')) {
    // No user has saved, archived, or pursued (all corresponding fields undefined or empty)
    parts.push(
      '(NOT IS_DEFINED(c.userSaves) OR c.userSaves = {}) ' +
      'AND (NOT IS_DEFINED(c.archived) OR c.archived = {}) ' +
      'AND (NOT IS_DEFINED(c.pursued) OR c.pursued = {})'
    );
  }

  return parts.length ? `(${parts.join(' OR ')})` : null;
}

export function seenClause(
  seenFilter: string[] | undefined
): string | null {
  if (!seenFilter || seenFilter.length === 0 || seenFilter.includes('all')) {
    return null;
  }

  const parts: string[] = [];

  if (seenFilter.includes('seen')) {
    // Any user has viewed it (seenBy is defined and non-empty)
    parts.push('IS_DEFINED(c.seenBy) AND c.seenBy != {}');
  }
  if (seenFilter.includes('unseen')) {
    // No user has viewed it (seenBy is undefined or empty)
    parts.push('(NOT IS_DEFINED(c.seenBy) OR c.seenBy = {})');
  }

  return parts.length ? `(${parts.join(' OR ')})` : null;
}
