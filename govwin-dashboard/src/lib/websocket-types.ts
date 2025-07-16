// lib/websocket-types.ts - WebSocket Message Types
export type WebSocketMessageType = 
  | 'OPPORTUNITY_UPDATE'
  | 'USER_CONNECTED'
  | 'USER_DISCONNECTED'
  | 'PING'
  | 'PONG';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  data?: any;
  timestamp: string;
  userId?: string;
}

export interface OpportunityUpdateMessage extends WebSocketMessage {
  type: 'OPPORTUNITY_UPDATE';
  data: {
    opportunityId: string;
    partitionDate: string;
    field: 'seenBy' | 'archived' | 'pursued' | 'userSaves';
    value: { [userId: string]: string };
    userId: string; // Who made the change
    action: 'save' | 'unsave' | 'archive' | 'unarchive' | 'pursue' | 'unpursue' | 'mark_seen';
  };
}



// lib/websocket-server.ts - Backend WebSocket Server (Next.js API route)
// app/api/ws/route.ts
import { NextRequest } from 'next/server';
import { WebSocketMessage, OpportunityUpdateMessage } from '@/lib/websocket-types';

const clients = new Map<string, WebSocket>();

export async function GET(request: NextRequest) {
  // WebSocket upgrade handling for Next.js
  const { socket, response } = await upgradeToWebSocket(request);
  
  socket.onopen = () => {
    console.log('New WebSocket connection');
  };

  socket.onmessage = (event) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      handleMessage(socket, message);
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  };

  socket.onclose = () => {
    // Remove client from active connections
    for (const [userId, client] of clients.entries()) {
      if (client === socket) {
        clients.delete(userId);
        break;
      }
    }
  };

  return response;
}

function handleMessage(socket: WebSocket, message: WebSocketMessage) {
  switch (message.type) {
    case 'USER_CONNECTED':
      if (message.userId) {
        clients.set(message.userId, socket);
        console.log(`User ${message.userId} connected`);
      }
      break;

    case 'OPPORTUNITY_UPDATE':
      broadcastToAllClients(message);
      break;

    case 'PING':
      socket.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
      break;
  }
}

function broadcastToAllClients(message: WebSocketMessage) {
  for (const [userId, client] of clients.entries()) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message to user ${userId}:`, error);
        clients.delete(userId);
      }
    }
  }
}

export function broadcastOpportunityUpdate(
  opportunityId: string,
  partitionDate: string,
  field: 'seenBy' | 'archived' | 'pursued' | 'userSaves',
  value: { [userId: string]: string },
  userId: string,
  action: string
) {
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

  broadcastToAllClients(message);
}