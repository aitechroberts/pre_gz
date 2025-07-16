// src/components/layout/connection-status.tsx
import { useWebSocket } from '@/contexts/websocket-context';
import { Badge } from '@/components/ui/badge';
import { WifiOff, Wifi } from 'lucide-react';

export function ConnectionStatus() {
  const { isConnected } = useWebSocket();

  return (
    <Badge variant={isConnected ? 'success' : 'secondary'} className="gap-1">
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