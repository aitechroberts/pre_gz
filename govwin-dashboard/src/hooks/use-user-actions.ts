// src/hooks/use-user-actions.ts
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { OpportunityDocument } from '@/lib/types';
import { useWebSocket } from '@/contexts/websocket-context';

export function useMarkSeen() {
  const queryClient = useQueryClient();
  const { emitOpportunityAction } = useWebSocket();

  return useMutation({
    mutationFn: async ({ opportunityId, userId, partitionDate }: { 
      opportunityId: string; 
      userId: string; 
      partitionDate: string; 
    }) => {
      const response = await fetch(`/api/opportunities/${opportunityId}/seen`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, partitionDate }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark opportunity as seen');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Emit WebSocket event
      emitOpportunityAction('seen', variables.opportunityId, variables.partitionDate);

      // Optimistically update the cache
      queryClient.setQueryData(['opportunities'], (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            data: {
              ...page.data,
              opportunities: page.data.opportunities.map((opp: OpportunityDocument) => 
                opp.id === variables.opportunityId
                  ? {
                      ...opp,
                      seenBy: {
                        ...opp.seenBy,
                        [variables.userId]: new Date().toISOString()
                      }
                    }
                  : opp
              )
            }
          }))
        };
      });
    },
  });
}

export function useToggleSaved() {
  const queryClient = useQueryClient();
  const { emitOpportunityAction } = useWebSocket();

  return useMutation({
    mutationFn: async ({ opportunityId, userId, partitionDate }: { 
      opportunityId: string; 
      userId: string; 
      partitionDate: string; 
    }) => {
      const response = await fetch(`/api/opportunities/${opportunityId}/save`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, partitionDate }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle save state');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Optimistically update the cache and emit WebSocket event
      queryClient.setQueryData(['opportunities'], (oldData: any) => {
        if (!oldData) return oldData;

        let wasSaved = false;
        const updatedData = {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            data: {
              ...page.data,
              opportunities: page.data.opportunities.map((opp: OpportunityDocument) => {
                if (opp.id === variables.opportunityId) {
                  wasSaved = (opp.userSaves || []).includes(variables.userId);
                  
                  if (wasSaved) {
                    // Emit unsaved event
                    emitOpportunityAction('unsaved', variables.opportunityId, variables.partitionDate);
                    return {
                      ...opp,
                      userSaves: opp.userSaves.filter((id: string) => id !== variables.userId),
                    };
                  } else {
                    // Emit saved event
                    emitOpportunityAction('saved', variables.opportunityId, variables.partitionDate);
                    return {
                      ...opp,
                      userSaves: [...(opp.userSaves || []), variables.userId],
                      seenBy: {
                        ...opp.seenBy,
                        [variables.userId]: new Date().toISOString(),
                      },
                    };
                  }
                }
                return opp;
              }),
            },
          })),
        };

        return updatedData;
      });
    },
  });
}

export function useArchiveOpportunity() {
  const queryClient = useQueryClient();
  const { emitOpportunityAction } = useWebSocket();

  return useMutation({
    mutationFn: async ({ opportunityId, userId, partitionDate }: { 
      opportunityId: string; 
      userId: string; 
      partitionDate: string; 
    }) => {
      const response = await fetch(`/api/opportunities/${opportunityId}/archive`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, partitionDate }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle archive state');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Optimistically update the cache and emit WebSocket event
      queryClient.setQueryData(['opportunities'], (oldData: any) => {
        if (!oldData) return oldData;

        let wasArchived = false;
        const updatedData = {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            data: {
              ...page.data,
              opportunities: page.data.opportunities.map((opp: OpportunityDocument) => {
                if (opp.id === variables.opportunityId) {
                  wasArchived = (opp.archived || {})[variables.userId] != null;
                  
                  if (wasArchived) {
                    // Emit unarchived event
                    emitOpportunityAction('unarchived', variables.opportunityId, variables.partitionDate);
                    const { [variables.userId]: removed, ...rest } = opp.archived || {};
                    return {
                      ...opp,
                      archived: rest,
                    };
                  } else {
                    // Emit archived event
                    emitOpportunityAction('archived', variables.opportunityId, variables.partitionDate);
                    return {
                      ...opp,
                      archived: {
                        ...opp.archived,
                        [variables.userId]: new Date().toISOString(),
                      },
                      seenBy: {
                        ...opp.seenBy,
                        [variables.userId]: new Date().toISOString(),
                      },
                    };
                  }
                }
                return opp;
              }),
            },
          })),
        };

        return updatedData;
      });
    },
  });
}

export function usePursueOpportunity() {
  const queryClient = useQueryClient();
  const { emitOpportunityAction } = useWebSocket();

  return useMutation({
    mutationFn: async ({ opportunityId, userId, partitionDate }: { 
      opportunityId: string; 
      userId: string; 
      partitionDate: string; 
    }) => {
      const response = await fetch(`/api/opportunities/${opportunityId}/pursue`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, partitionDate }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle pursue status');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Optimistically update the cache and emit WebSocket event
      queryClient.setQueryData(['opportunities'], (oldData: any) => {
        if (!oldData) return oldData;

        let wasPursued = false;
        const updatedData = {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            data: {
              ...page.data,
              opportunities: page.data.opportunities.map((opp: OpportunityDocument) => {
                if (opp.id === variables.opportunityId) {
                  wasPursued = (opp.pursued || {})[variables.userId] != null;
                  
                  if (wasPursued) {
                    // Emit unpursued event
                    emitOpportunityAction('unpursued', variables.opportunityId, variables.partitionDate);
                    const { [variables.userId]: removed, ...rest } = opp.pursued || {};
                    return {
                      ...opp,
                      pursued: rest,
                    };
                  } else {
                    // Emit pursued event
                    emitOpportunityAction('pursued', variables.opportunityId, variables.partitionDate);
                    return {
                      ...opp,
                      pursued: {
                        ...opp.pursued,
                        [variables.userId]: new Date().toISOString(),
                      },
                      seenBy: {
                        ...opp.seenBy,
                        [variables.userId]: new Date().toISOString(),
                      },
                    };
                  }
                }
                return opp;
              }),
            },
          })),
        };

        return updatedData;
      });
    },
  });
}

// Bulk operations hooks
export function useBulkArchive() {
  const queryClient = useQueryClient();
  const { emitOpportunityAction } = useWebSocket();

  return useMutation({
    mutationFn: async ({ opportunityIds, userId, action }: { 
      opportunityIds: Array<{ id: string; partitionDate: string }>;
      userId: string; 
      action: 'archive' | 'unarchive';
    }) => {
      const response = await fetch('/api/opportunities/bulk/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ opportunityIds, userId, action }),
      });

      if (!response.ok) {
        throw new Error('Failed to bulk archive/unarchive');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Emit WebSocket events for each opportunity
      variables.opportunityIds.forEach(({ id, partitionDate }) => {
        emitOpportunityAction(
          variables.action === 'archive' ? 'archived' : 'unarchived',
          id,
          partitionDate
        );
      });

      // Invalidate and refetch opportunities
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });
}

export function useBulkPursue() {
  const queryClient = useQueryClient();
  const { emitOpportunityAction } = useWebSocket();

  return useMutation({
    mutationFn: async ({ opportunityIds, userId, action }: { 
      opportunityIds: Array<{ id: string; partitionDate: string }>;
      userId: string; 
      action: 'pursue' | 'unpursue';
    }) => {
      const response = await fetch('/api/opportunities/bulk/pursue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ opportunityIds, userId, action }),
      });

      if (!response.ok) {
        throw new Error('Failed to bulk pursue/unpursue');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Emit WebSocket events for each opportunity
      variables.opportunityIds.forEach(({ id, partitionDate }) => {
        emitOpportunityAction(
          variables.action === 'pursue' ? 'pursued' : 'unpursued',
          id,
          partitionDate
        );
      });

      // Invalidate and refetch opportunities
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });
}

// Query to get list of pursued opportunities for a user
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
    enabled: !!userId && userId !== 'anonymous',
  });
}