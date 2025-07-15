import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { OpportunityFilters, SortParams, OpportunityDocument } from '@/lib/types';

interface UseOpportunitiesParams {
  filters: OpportunityFilters;
  sort: SortParams;
  limit?: number;
}

export function useOpportunities({ filters, sort, limit = 20 }: UseOpportunitiesParams) {
  const queryClient = useQueryClient();

  const buildQueryParams = (cursor?: string) => {
    const params = new URLSearchParams();
    
    // Date range
    params.append('fromDate', filters.dateRange.from.toISOString());
    params.append('toDate', filters.dateRange.to.toISOString());
    
    // Multi-select filters
    filters.sources.forEach(source => params.append('sources', source));
    filters.naics.forEach(naics => params.append('naics', naics));
    filters.psc.forEach(psc => params.append('psc', psc));
    filters.status.forEach(status => params.append('status', status));
    filters.searchTerms.forEach(term => params.append('searchTerms', term));
    filters.seenFilter.forEach(value => params.append('seenFilter', value));
    filters.relevantFilter.forEach(value => params.append('relevantFilter', value));
    
    // Search and pagination
    if (cursor) params.append('cursor', cursor);
    params.append('limit', limit.toString());
    
    // Sorting
    params.append('sortField', sort.field);
    params.append('sortDirection', sort.direction);
    
    return params.toString();
  };

  return useInfiniteQuery({
    queryKey: ['opportunities', filters, sort, limit],
    queryFn: async ({ pageParam }) => {
      const queryParams = buildQueryParams(pageParam);
      const response = await fetch(`/api/opportunities?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch opportunities');
      }
      
      return response.json();
    },
    getNextPageParam: (lastPage) => {
      return lastPage.data?.nextCursor;
    },
    initialPageParam: undefined,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}