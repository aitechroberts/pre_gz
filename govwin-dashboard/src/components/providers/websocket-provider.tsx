// src/components/providers/websocket-provider.tsx
"use client";
import React, { createContext, useContext } from "react";
import { useRealTime } from "@/hooks/useRealTime";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
import { OpportunityDocument } from "@/lib/types";

const WebSocketContext = createContext<{ isConnected: boolean }>({ isConnected: false });

export const useWebSocket = () => useContext(WebSocketContext);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentUserId = user?.homeAccountId || user?.localAccountId || "anonymous";

  const { isConnected } = useRealTime((message) => {
    // Only process OPPORTUNITY_UPDATE messages
    if (message.type !== "OPPORTUNITY_UPDATE") return;

    const { opportunityId, action, userId, timestamp } = message;

    // Skip updates from the current user (they already have optimistic updates)
    if (userId === currentUserId) return;

    // Update React Query cache
    queryClient.setQueryData(["opportunities"], (oldData: any) => {
      if (!oldData) return oldData;

      return {
        ...oldData,
        pages: oldData.pages.map((page: any) => ({
          ...page,
          data: {
            ...page.data,
            opportunities: page.data.opportunities.map((opp: OpportunityDocument) => {
              if (opp.id !== opportunityId) return opp;

              // Apply the update based on action type
              switch (action) {
                case "seen":
                  return {
                    ...opp,
                    seenBy: {
                      ...opp.seenBy,
                      [userId]: timestamp,
                    },
                  };

                case "saved":
                  return {
                    ...opp,
                    userSaves: [...(opp.userSaves || []), userId],
                    seenBy: {
                      ...opp.seenBy,
                      [userId]: timestamp,
                    },
                  };

                case "unsaved":
                  return {
                    ...opp,
                    userSaves: (opp.userSaves || []).filter((id) => id !== userId),
                  };

                case "archived":
                  return {
                    ...opp,
                    archived: {
                      ...opp.archived,
                      [userId]: timestamp,
                    },
                    seenBy: {
                      ...opp.seenBy,
                      [userId]: timestamp,
                    },
                  };

                case "unarchived":
                  const { [userId]: removed, ...restArchived } = opp.archived || {};
                  return {
                    ...opp,
                    archived: restArchived,
                  };

                case "pursued":
                  return {
                    ...opp,
                    pursued: {
                      ...opp.pursued,
                      [userId]: timestamp,
                    },
                    seenBy: {
                      ...opp.seenBy,
                      [userId]: timestamp,
                    },
                  };

                case "unpursued":
                  const { [userId]: removedPursue, ...restPursued } = opp.pursued || {};
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
  });

  return (
    <WebSocketContext.Provider value={{ isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
}