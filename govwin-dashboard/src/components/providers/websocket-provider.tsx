// src/components/providers/websocket-provider.tsx
"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealTime } from "@/hooks/useRealTime";
import { useAuth } from "@/components/providers/auth-provider";
import { OpportunityDocument } from "@/lib/types";

// --------------------------------------------------------------------
// Context boiler-plate
// --------------------------------------------------------------------
const WebSocketContext = createContext<{ isConnected: boolean }>({
  isConnected: false,
});

export const useWebSocket = () => useContext(WebSocketContext);

// --------------------------------------------------------------------
// Provider
// --------------------------------------------------------------------
export function WebSocketProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentUserId =
    user?.homeAccountId || user?.localAccountId || "anonymous";

  // ----------------------------------------------------------------
  // ✅ Stable (memoised) message handler - only re-created when the
  //    query client instance or currentUserId actually changes.
  // ----------------------------------------------------------------
  const handleMessage = useCallback(
    (message: any) => {
      if (message.type !== "OPPORTUNITY_UPDATE") return;

      const { opportunityId, action, userId, timestamp } = message;

      // Ignore echoes of our own optimistic update
      if (userId === currentUserId) return;

      queryClient.setQueryData(["opportunities"], (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            data: {
              ...page.data,
              opportunities: page.data.opportunities.map(
                (opp: OpportunityDocument) => {
                  if (opp.id !== opportunityId) return opp;

                  switch (action) {
                    case "seen":
                      return {
                        ...opp,
                        seenBy: { ...opp.seenBy, [userId]: timestamp },
                      };

                    case "saved":
                      return {
                        ...opp,
                        userSaves: {
                          ...opp.userSaves,
                          [userId]: timestamp,
                        },
                        seenBy: { ...opp.seenBy, [userId]: timestamp },
                      };

                    case "unsaved": {
                      const { [userId]: _, ...rest } = opp.userSaves || {};
                      return { ...opp, userSaves: rest };
                    }

                    case "archived":
                      return {
                        ...opp,
                        archived: {
                          ...opp.archived,
                          [userId]: timestamp,
                        },
                        seenBy: { ...opp.seenBy, [userId]: timestamp },
                      };

                    case "unarchived": {
                      const { [userId]: _, ...rest } = opp.archived || {};
                      return { ...opp, archived: rest };
                    }

                    case "pursued":
                      return {
                        ...opp,
                        pursued: {
                          ...opp.pursued,
                          [userId]: timestamp,
                        },
                        seenBy: { ...opp.seenBy, [userId]: timestamp },
                      };

                    case "unpursued": {
                      const { [userId]: _, ...rest } = opp.pursued || {};
                      return { ...opp, pursued: rest };
                    }

                    default:
                      return opp;
                  }
                }
              ),
            },
          })),
        };
      });
    },
    [queryClient, currentUserId]
  );

  // Pass the memoised callback to the hook
  const { isConnected } = useRealTime(handleMessage);

  return (
    <WebSocketContext.Provider value={{ isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
}
