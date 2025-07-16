// src/hooks/useRealTime.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";

export function useRealTime(onMessage: (data: unknown) => void) {
  const { user } = useAuth();

  // ------------------------------------------------------------
  // 1. Refs
  // ------------------------------------------------------------
  const socketRef = useRef<WebSocket | null>(null);

  // keep the latest onMessage in a ref so the effect
  // doesn’t need it in its dependency array
  const handlerRef = useRef(onMessage);
  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  // ------------------------------------------------------------
  // 2. Connection state (optional, for UI badges, etc.)
  // ------------------------------------------------------------
  const [isConnected, setConnected] = useState(false);

  // ------------------------------------------------------------
  // 3. Effect: open / close WebSocket when user changes
  // ------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    const userId =
      user.homeAccountId || user.localAccountId || "anonymous";

    (async () => {
      // ——— fetch negotiation token/url ———
      const res = await fetch(
        `/api/pubsub/negotiate?userId=${encodeURIComponent(userId)}`
      );
      const { url } = (await res.json()) as { url: string };

      // ——— open WebSocket ———
      const ws = new WebSocket(url);
      socketRef.current = ws;

        ws.onopen = () => { 
        console.log("✅ WebSocket connected"); 
        setConnected(true);
        };
        ws.onerror = (e) => { 
        console.error("WebSocket error:", e); 
        setConnected(false);
        };
        ws.onclose = () => { 
        console.warn("WebSocket closed"); 
        setConnected(false);
        };

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
        const raw = JSON.parse(event.data);
        // If the message has a 'data' field (Azure envelope), unwrap it; otherwise use raw
        const payload = raw.data ?? raw;
        handlerRef.current(payload); // call the latest message handler
        } catch (err) {
          console.error("Failed to parse WebSocket payload:", err);
        }
      };
    })().catch((err) => {
      console.error("Failed to establish WebSocket:", err);
    });
    // cleanup on unmount / user switch
    return () => socketRef.current?.close();
  }, [user]);

  return { isConnected };
}
