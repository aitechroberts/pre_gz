// src/hooks/use-user-actions.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { OpportunityDocument } from '@/lib/types';

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
        throw new Error('Failed to toggle opportunity saved state');
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
                  const userSaves = opp.userSaves || [];
                  const isSaved = userSaves.includes(variables.userId);
                  
                  return {
                    ...opp,
                    userSaves: isSaved
                      ? userSaves.filter(id => id !== variables.userId)
                      : [...userSaves, variables.userId],
                    seenBy: {
                      ...opp.seenBy,
                      [variables.userId]: new Date().toISOString()
                    }
                    // 🆕 NO LONGER: Don't touch relevant or archived fields
                  };
                }
                return opp;
              })
            }
          }))
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
        throw new Error('Failed to toggle archive status');
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
                      archived: (() => {
                        const currentArchived = opp.archived || {};
                        if (currentArchived[variables.userId]) {
                          // Unarchive: remove user from archived object
                          const { [variables.userId]: removed, ...rest } = currentArchived;
                          return rest;
                        } else {
                          // Archive: add user to archived object
                          return { ...currentArchived, [variables.userId]: new Date().toISOString() };
                        }
                      })(),
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
              opportunities: page.data.opportunities.map((opp: OpportunityDocument) => 
                opp.id === variables.opportunityId
                  ? {
                      ...opp,
                      // 🆕 NEW: Toggle pursued status
                      pursued: (() => {
                        const currentPursued = opp.pursued || {};
                        if (currentPursued[variables.userId]) {
                          // Remove user from pursued (unpursue)
                          const { [variables.userId]: removed, ...rest } = currentPursued;
                          return rest;
                        } else {
                          // Add user to pursued (pursue)
                          return { ...currentPursued, [variables.userId]: new Date().toISOString() };
                        }
                      })(),
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

// 🔄 LEGACY: Keep old hook names for backward compatibility
export const useMarkViewed = useMarkSeen;