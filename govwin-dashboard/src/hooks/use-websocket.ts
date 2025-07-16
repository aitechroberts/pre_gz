// hooks/use-websocket.ts - React Hook for WebSocket Integration
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WebSocketClient } from '@/lib/websocket-client';
import { OpportunityUpdateMessage, WebSocketMessage } from '@/lib/websocket-types';
import { OpportunityDocument } from '@/lib/types';

export function useWebSocket(userId: string) {
  const queryClient = useQueryClient();
  const clientRef = useRef<WebSocketClient | null>(null);
  const [connectionState, setConnectionState] = useState<string>('disconnected');

  useEffect(() => {
    if (!userId) return;

    // Create WebSocket client
    clientRef.current = new WebSocketClient(userId);

    // Handle connection state changes
    clientRef.current.on('connect', () => {
      setConnectionState('connected');
      console.log('WebSocket connected for user:', userId);
    });

    clientRef.current.on('disconnect', () => {
      setConnectionState('disconnected');
    });

    clientRef.current.on('error', (error: any) => {
      console.error('WebSocket error:', error);
      setConnectionState('error');
    });

    // Handle opportunity updates
    clientRef.current.on('OPPORTUNITY_UPDATE', (message: OpportunityUpdateMessage) => {
      handleOpportunityUpdate(message);
    });

    // Connect
    clientRef.current.connect();

    // Cleanup on unmount
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, [userId]);

  const handleOpportunityUpdate = (message: OpportunityUpdateMessage) => {
    const { opportunityId, partitionDate, field, value, userId: actionUserId } = message.data;
    
    // Don't update if this user made the change (already optimistically updated)
    if (actionUserId === userId) return;

    console.log('Received opportunity update:', message.data);

    // Update the React Query cache
    queryClient.setQueryData(['opportunities'], (oldData: any) => {
      if (!oldData) return oldData;

      return {
        ...oldData,
        pages: oldData.pages.map((page: any) => ({
          ...page,
          data: {
            ...page.data,
            opportunities: page.data.opportunities.map((opp: OpportunityDocument) => {
              if (opp.id === opportunityId && opp.partitionDate === partitionDate) {
                return {
                  ...opp,
                  [field]: value // Update the specific field
                };
              }
              return opp;
            })
          }
        }))
      };
    });

    // Also update any specific opportunity queries
    queryClient.setQueryData(['opportunity', opportunityId], (oldData: OpportunityDocument | undefined) => {
      if (!oldData || oldData.partitionDate !== partitionDate) return oldData;
      
      return {
        ...oldData,
        [field]: value
      };
    });
  };

  const broadcastUpdate = (
    opportunityId: string,
    partitionDate: string,
    field: 'seenBy' | 'archived' | 'pursued' | 'userSaves',
    value: { [userId: string]: string },
    action: string
  ) => {
    if (clientRef.current) {
      const message: OpportunityUpdateMessage = {
        type: 'OPPORTUNITY_UPDATE',
        data: {
          opportunityId,
          partitionDate,
          field,
          value,
          userId,
          action
        },
        timestamp: new Date().toISOString(),
        userId
      };

      clientRef.current.send(message);
    }
  };

  return {
    connectionState,
    broadcastUpdate,
    isConnected: connectionState === 'connected'
  };
}

// Update use-user-actions.ts to broadcast changes
// Add this to each mutation's onSuccess callback:

/* EXAMPLE: Updated useToggleSaved with WebSocket broadcasting
export function useToggleSaved() {
  const queryClient = useQueryClient();
  const { broadcastUpdate } = useWebSocket(userId); // Get from context or prop

  return useMutation({
    // ... existing mutationFn ...
    
    onSuccess: (data, variables) => {
      // Existing optimistic cache update code...
      
      // NEW: Broadcast the change to other users
      const opportunity = getCurrentOpportunity(variables.opportunityId); // Helper to get current opp
      if (opportunity) {
        broadcastUpdate(
          variables.opportunityId,
          variables.partitionDate,
          'userSaves',
          opportunity.userSaves, // Send the updated userSaves object
          data.isSaved ? 'save' : 'unsave'
        );
      }
    },
  });
}
*/