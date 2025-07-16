// src/contexts/websocket-context.tsx
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/components/providers/auth-provider';
import { useQueryClient } from '@tanstack/react-query';
import { OpportunityDocument } from '@/lib/types';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  emitOpportunityAction: (action: string, opportunityId: string, partitionDate: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  emitOpportunityAction: () => {},
});

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.homeAccountId || user?.localAccountId || 'anonymous';

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io({
      path: '/api/socket',
      autoConnect: true,
    });

    socketInstance.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      
      // Join user-specific room
      if (userId !== 'anonymous') {
        socketInstance.emit('join-user-room', userId);
      }
    });

    socketInstance.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    // Listen for opportunity updates from other users
    socketInstance.on('opportunity-updated', (data) => {
      const { action, opportunityId, userId: actionUserId, timestamp } = data;
      
      // Don't update if it's our own action (we already updated optimistically)
      if (actionUserId === userId) return;

      // Update React Query cache
      queryClient.setQueryData(['opportunities'], (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            data: {
              ...page.data,
              opportunities: page.data.opportunities.map((opp: OpportunityDocument) => {
                if (opp.id !== opportunityId) return opp;

                // Update based on action type
                switch (action) {
                  case 'seen':
                    return {
                      ...opp,
                      seenBy: {
                        ...opp.seenBy,
                        [actionUserId]: timestamp,
                      },
                    };
                  
                  case 'saved':
                    return {
                      ...opp,
                      userSaves: [...(opp.userSaves || []), actionUserId],
                      seenBy: {
                        ...opp.seenBy,
                        [actionUserId]: timestamp,
                      },
                    };
                  
                  case 'unsaved':
                    return {
                      ...opp,
                      userSaves: (opp.userSaves || []).filter(id => id !== actionUserId),
                    };
                  
                  case 'archived':
                    return {
                      ...opp,
                      archived: {
                        ...opp.archived,
                        [actionUserId]: timestamp,
                      },
                      seenBy: {
                        ...opp.seenBy,
                        [actionUserId]: timestamp,
                      },
                    };
                  
                  case 'unarchived':
                    const { [actionUserId]: removed, ...restArchived } = opp.archived || {};
                    return {
                      ...opp,
                      archived: restArchived,
                    };
                  
                  case 'pursued':
                    return {
                      ...opp,
                      pursued: {
                        ...opp.pursued,
                        [actionUserId]: timestamp,
                      },
                      seenBy: {
                        ...opp.seenBy,
                        [actionUserId]: timestamp,
                      },
                    };
                  
                  case 'unpursued':
                    const { [actionUserId]: removedPursue, ...restPursued } = opp.pursued || {};
                    return {
                      ...opp,
                      pursued: restPursued,
                    };
                  
                  default:
                    return opp;
                }
              }),
            },
          })),
        };
      });

      // Invalidate relevant queries to ensure consistency
      queryClient.invalidateQueries({ 
        queryKey: ['opportunities'],
        refetchType: 'none', // Don't refetch, just mark as stale
      });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [userId, queryClient]);

  const emitOpportunityAction = useCallback((
    action: string, 
    opportunityId: string,
    partitionDate: string
  ) => {
    if (socket && isConnected) {
      socket.emit('opportunity-action', {
        action,
        opportunityId,
        userId,
        partitionDate,
        timestamp: new Date().toISOString(),
      });
    }
  }, [socket, isConnected, userId]);

  return (
    <WebSocketContext.Provider value={{ socket, isConnected, emitOpportunityAction }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export const useWebSocket = () => useContext(WebSocketContext);