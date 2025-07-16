// hooks/use-user-actions.ts - FIXED VERSION
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
      // Optimistically update the cache - FIXED to use object format
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
                  const userSaves = opp.userSaves || {};
                  const isSaved = userSaves[variables.userId] != null; // FIXED: check object key
                  
                  const newUserSaves = { ...userSaves };
                  if (isSaved) {
                    delete newUserSaves[variables.userId]; // FIXED: remove key
                  } else {
                    newUserSaves[variables.userId] = new Date().toISOString(); // FIXED: add timestamp
                  }
                  
                  return {
                    ...opp,
                    userSaves: newUserSaves, // FIXED: object format
                    seenBy: {
                      ...opp.seenBy,
                      [variables.userId]: new Date().toISOString()
                    }
                    // REMOVED: relevant field updates
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
        throw new Error('Failed to archive opportunity');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Optimistically update the cache - FIXED
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
                      archived: {
                        ...opp.archived,
                        [variables.userId]: new Date().toISOString()
                      },
                      seenBy: {
                        ...opp.seenBy,
                        [variables.userId]: new Date().toISOString()
                      }
                      // REMOVED: relevant field updates
                      // REMOVED: userSaves modifications (archive is independent)
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
        throw new Error('Failed to pursue opportunity');
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
                      pursued: {
                        ...opp.pursued,
                        [variables.userId]: new Date().toISOString()
                      },
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