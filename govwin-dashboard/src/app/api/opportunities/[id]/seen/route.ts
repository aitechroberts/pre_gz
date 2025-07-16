// ===== src/app/api/opportunities/[id]/seen/route.ts =====
import { NextRequest } from 'next/server';
import { cosmosService } from '@/lib/cosmos';
import { pubSubClient } from '@/lib/pubsub-server';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, partitionDate } = await request.json();
    
    if (!userId || !partitionDate) {
      return Response.json(
        { error: 'userId and partitionDate are required' }, 
        { status: 400 }
      );
    }

    const result = await cosmosService.markOpportunitySeen(params.id, userId, partitionDate);
    
    if (result) {
      // Broadcast the update to all connected clients
      await pubSubClient.sendToAll({
        type: "OPPORTUNITY_UPDATE",
        opportunityId: params.id,
        action: "seen",
        userId,
        timestamp: new Date().toISOString(),
      });
    }
    
    return Response.json({ 
      success: result,
      message: result ? 'Opportunity marked as seen' : 'Failed to mark opportunity as seen'
    });
    
  } catch (error) {
    console.error('Error in seen route:', error);
    return Response.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}