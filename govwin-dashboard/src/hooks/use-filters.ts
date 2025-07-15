import { useQuery } from '@tanstack/react-query';
import { FilterOptions } from '@/lib/types';

export function useFilterOptions() {
  return useQuery({
    queryKey: ['filter-options'],
    queryFn: async () => {
      const response = await fetch('/api/filters');
      
      if (!response.ok) {
        throw new Error('Failed to fetch filter options');
      }
      
      const result = await response.json();
      return result.data as FilterOptions & {
        parkerTideCoverage: {
          naics: { available: string[]; total: number };
          psc: { available: string[]; total: number };
        };
      };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - filter options don't change often
    refetchOnWindowFocus: false,
  });
}