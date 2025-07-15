// src/hooks/use-user-actions.ts
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { OpportunityDocument } from '@/lib/types';

export function useMarkViewed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ opportunityId, userId }: { opportunityId: string; userId: string }) => {
      const response = await fetch(`/api/opportunities/${opportunityId}/seen`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark opportunity as viewed');
      }

      return response.json();
    },
    onSuccess: () => {
      // Simple cache invalidation - refetches opportunities
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });
}

export function useMarkSeen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ opportunityId, userId }: { opportunityId: string; userId: string }) => {
      const response = await fetch(`/api/opportunities/${opportunityId}/seen`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark opportunity as seen');
      }

      return response.json();
    },
    onSuccess: () => {
      // Simple cache invalidation - refetches opportunities
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });
}

export function useToggleSaved() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ opportunityId, userId }: { opportunityId: string; userId: string }) => {
      const response = await fetch(`/api/opportunities/${opportunityId}/save`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle opportunity saved state');
      }

      return response.json();
    },
    onSuccess: () => {
      // Simple cache invalidation - refetches opportunities
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });
}

export function useArchiveOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ opportunityId, userId }: { opportunityId: string; userId: string }) => {
      const response = await fetch(`/api/opportunities/${opportunityId}/archive`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to archive opportunity');
      }

      return response.json();
    },
    onSuccess: () => {
      // Simple cache invalidation - refetches opportunities
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });
}

export function usePursueOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ opportunityId, userId }: { opportunityId: string; userId: string }) => {
      const response = await fetch(`/api/opportunities/${opportunityId}/pursue`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle opportunity pursued state');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });
}

export function useBulkPursue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const response = await fetch(`/api/opportunities/pursue/bulk`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to bulk pursue opportunities');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });
}

export function useGetPursuedList(userId: string) {
  return useQuery({
    queryKey: ['pursued-opportunities', userId],
    queryFn: async () => {
      const response = await fetch(`/api/opportunities/pursued?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch pursued opportunities');
      }
      return response.json();
    },
    enabled: !!userId, // Only run query if userId exists
  });
}