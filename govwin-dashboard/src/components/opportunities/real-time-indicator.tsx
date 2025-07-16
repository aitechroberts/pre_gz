// src/components/opportunities/real-time-indicator.tsx
import { useWebSocket } from '@/contexts/websocket-context';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

export function RealTimeIndicator({ seenByCount }: { seenByCount: number }) {
  const { isConnected } = useWebSocket();

  if (!isConnected) return null;

  return (
    <Badge variant="secondary" className="gap-1">
      <Users className="h-3 w-3" />
      {seenByCount} {seenByCount === 1 ? 'user' : 'users'} viewing
    </Badge>
  );
}