// ===== src/app/api/opportunities/[id]/archive/route.ts =====
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

    const newArchivedState = await cosmosService.toggleOpportunityArchived(params.id, userId, partitionDate);
    
    // Broadcast the update to all connected clients
    await pubSubClient.sendToAll({
      type: "OPPORTUNITY_UPDATE",
      opportunityId: params.id,
      action: newArchivedState ? "archived" : "unarchived",
      userId,
      timestamp: new Date().toISOString(),
    });
    
    return Response.json({ 
      success: true,
      archived: newArchivedState,
      message: newArchivedState ? 'Opportunity archived' : 'Opportunity unarchived'
    });
    
  } catch (error) {
    console.error('Error in archive route:', error);
    return Response.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}