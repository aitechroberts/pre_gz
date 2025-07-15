// src/hooks/use-ui-pagination.ts
import { useState, useMemo } from 'react';

interface UseUIPaginationProps<T> {
  data: T[];
  itemsPerPage: number;
}

export function useUIPagination<T>({ data, itemsPerPage }: UseUIPaginationProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);

  const paginatedData = useMemo(() => {
    const startIndex = 0;
    const endIndex = currentPage * itemsPerPage;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const hasMore = currentPage < totalPages;

  const loadMore = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const reset = () => {
    setCurrentPage(1);
  };

  return {
    currentData: paginatedData,
    totalItems: data.length,
    loadedItems: paginatedData.length,
    hasMore,
    loadMore,
    reset,
    currentPage,
    totalPages
  };
}