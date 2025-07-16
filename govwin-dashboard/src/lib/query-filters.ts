import { OpportunityDocument, OpportunityFilters } from './types';

/**
 * Filter opportunities client-side based on user-specific tracking (saved, archived, pursued, unreviewed).
 * This applies the relevantFilter and archivedFilter for the current user.
 * @param opportunities - list of opportunities fetched from the server
 * @param filters - OpportunityFilters object with relevantFilter/archivedFilter settings
 * @param userId - the current user's ID for checking saved/archived status
 * @returns filtered list of opportunities matching the user-specific filters
 */
export function filterOpportunitiesByUser(
  opportunities: OpportunityDocument[],
  filters: OpportunityFilters,
  userId: string
): OpportunityDocument[] {
  return opportunities.filter(opp => {
    // Apply relevantFilter (saved, pursued, unreviewed, archived if included for legacy support)
    if (filters.relevantFilter && filters.relevantFilter.length > 0 && !filters.relevantFilter.includes('all')) {
      let matchesRelevant = false;
      // Saved items (bookmarked by current user)
      if (filters.relevantFilter.includes('saved')) {
        if (opp.userSaves && opp.userSaves[userId]) {
          matchesRelevant = true;
        }
      }
      // Pursued items (marked as pursued by current user)
      if (filters.relevantFilter.includes('pursued')) {
        if (opp.pursued && opp.pursued[userId]) {
          matchesRelevant = true;
        }
      }
      // Unreviewed items (not saved, not archived, not pursued by current user)
      if (filters.relevantFilter.includes('unreviewed')) {
        const notSaved = !opp.userSaves || !opp.userSaves[userId];
        const notArchived = !opp.archived || !opp.archived[userId];
        const notPursued = !opp.pursued || !opp.pursued[userId];
        if (notSaved && notArchived && notPursued) {
          matchesRelevant = true;
        }
      }
      // (Optional legacy) Archived items via relevantFilter (if 'archived' was passed in relevantFilter)
      if (filters.relevantFilter.includes('archived')) {
        if (opp.archived && opp.archived[userId]) {
          matchesRelevant = true;
        }
      }
      if (!matchesRelevant) {
        return false; // does not satisfy any selected relevant status
      }
    }

    // Apply archivedFilter (archived/unarchived)
    if (filters.archivedFilter && filters.archivedFilter.length > 0 && !filters.archivedFilter.includes('all')) {
      const includeArchived = filters.archivedFilter.includes('archived');
      const includeUnarchived = filters.archivedFilter.includes('unarchived');
      // If only "archived" is selected, filter out items not archived by current user
      if (includeArchived && !includeUnarchived) {
        if (!opp.archived || !opp.archived[userId]) {
          return false;
        }
      }
      // If only "unarchived" is selected, filter out items that are archived by current user
      if (includeUnarchived && !includeArchived) {
        if (opp.archived && opp.archived[userId]) {
          return false;
        }
      }
      // If both "archived" and "unarchived" are selected, that is equivalent to no filter (include all)
    }

    return true;
  });
}
