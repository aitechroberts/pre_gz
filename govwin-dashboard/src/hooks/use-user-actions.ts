// src/hooks/use-user-actions.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { OpportunityDocument } from '@/lib/types';

// Remove all WebSocket imports and emitOpportunityAction calls

export function useMarkSeen() {
  const queryClient = useQueryClient();

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
      // Optimistically update the cache
      queryClient.setQueryData(['opportunities'], (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            data: {
              ...page.data,
              opportunities: page.data.opportunities.map((opp: OpportunityDocument) => {
                if (opp.id === variables.opportunityId) {
                  const wasSaved = (opp.userSaves || {})[variables.userId] != null;

                  if (wasSaved) {
                    const { [variables.userId]: removed, ...rest } = opp.userSaves || {};
                    return { 
                      ...opp, 
                      userSaves: rest 
                    };
                  } else {
                    return {
                      ...opp,
                      userSaves: {
                        ...opp.userSaves,
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
      });
    },
  });
}

export function useArchiveOpportunity() {
  const queryClient = useQueryClient();

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
      // Optimistically update the cache
      queryClient.setQueryData(['opportunities'], (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            data: {
              ...page.data,
              opportunities: page.data.opportunities.map((opp: OpportunityDocument) => {
                if (opp.id === variables.opportunityId) {
                  const wasArchived = (opp.archived || {})[variables.userId] != null;
                  
                  if (wasArchived) {
                    const { [variables.userId]: removed, ...rest } = opp.archived || {};
                    return {
                      ...opp,
                      archived: rest,
                    };
                  } else {
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
      });
    },
  });
}

export function usePursueOpportunity() {
  const queryClient = useQueryClient();

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
      // Optimistically update the cache
      queryClient.setQueryData(['opportunities'], (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            data: {
              ...page.data,
              opportunities: page.data.opportunities.map((opp: OpportunityDocument) => {
                if (opp.id === variables.opportunityId) {
                  const wasPursued = (opp.pursued || {})[variables.userId] != null;
                  
                  if (wasPursued) {
                    const { [variables.userId]: removed, ...rest } = opp.pursued || {};
                    return {
                      ...opp,
                      pursued: rest,
                    };
                  } else {
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
      });
    },
  });
}