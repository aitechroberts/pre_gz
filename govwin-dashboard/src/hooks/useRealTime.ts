// src/hooks/useRealTime.ts
"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";

export function useRealTime(onMessage: (data: any) => void) {
  const { user } = useAuth();
  const socketRef = useRef<WebSocket>();
  const [isConnected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) return;
    const userId = user.homeAccountId || user.localAccountId || "anonymous";

    (async () => {
      try {
        const res = await fetch(`/api/pubsub/negotiate?userId=${encodeURIComponent(userId)}`);
        const { url } = await res.json();
        const ws = new WebSocket(url);
        socketRef.current = ws;

        ws.onopen = () => {
          console.log("WebSocket connected");
          setConnected(true);
        };
        
        ws.onclose = () => {
          console.log("WebSocket disconnected");
          setConnected(false);
        };
        
        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          setConnected(false);
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            onMessage(data);
          } catch (err) {
            console.error("Failed to parse WebSocket message:", err);
          }
        };
      } catch (err) {
        console.error("Failed to connect to WebSocket:", err);
      }
    })();

    return () => {
      socketRef.current?.close();
    };
  }, [user, onMessage]);

  return { isConnected };
}