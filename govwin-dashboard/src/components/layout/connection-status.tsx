// src/components/layout/connection-status.tsx
import { useWebSocket } from '@/components/providers/websocket-provider';
import { Badge } from '@/components/ui/badge';
import { WifiOff, Wifi } from 'lucide-react';

export function ConnectionStatus() {
  const { isConnected } = useWebSocket();

  return (
    <Badge 
      variant="secondary" 
      className={`gap-1 ${isConnected ? 'bg-green-500 hover:bg-green-600 text-white' : ''}`}
    >
      {isConnected ? (
        <>
          <Wifi className="h-3 w-3" />
          Live
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          Offline
        </>
      )}
    </Badge>
  );
}