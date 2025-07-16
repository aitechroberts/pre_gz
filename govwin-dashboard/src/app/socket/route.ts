// src/app/api/socket/route.ts
import { Server as SocketIOServer } from 'socket.io';
import { NextRequest } from 'next/server';

// Store the socket server instance
let io: SocketIOServer | null = null;

export function GET(request: NextRequest) {
  if (!io) {
    // @ts-ignore - Next.js specific server access
    const httpServer = (global as any).__server;
    
    io = new SocketIOServer(httpServer, {
      path: '/api/socket',
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? process.env.NEXT_PUBLIC_APP_URL 
          : 'http://localhost:3000',
        methods: ['GET', 'POST'],
      },
    });

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Join user-specific room for targeted updates
      socket.on('join-user-room', (userId: string) => {
        socket.join(`user:${userId}`);
        console.log(`Socket ${socket.id} joined room user:${userId}`);
      });

      // Join opportunity-specific rooms for real-time updates
      socket.on('join-opportunity-room', (opportunityId: string) => {
        socket.join(`opportunity:${opportunityId}`);
      });

      socket.on('leave-opportunity-room', (opportunityId: string) => {
        socket.leave(`opportunity:${opportunityId}`);
      });

      // Handle opportunity actions
      socket.on('opportunity-action', (data) => {
        const { action, opportunityId, userId, timestamp } = data;
        
        // Broadcast to all users watching this opportunity
        socket.to(`opportunity:${opportunityId}`).emit('opportunity-updated', {
          action,
          opportunityId,
          userId,
          timestamp,
        });

        // Also broadcast to all connected clients for dashboard updates
        socket.broadcast.emit('opportunity-updated', {
          action,
          opportunityId,
          userId,
          timestamp,
        });
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }

  return new Response('Socket.IO server is running', { status: 200 });
}

// Export the io instance for use in other API routes
export function getIO(): SocketIOServer | null {
  return io;
}