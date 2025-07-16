// ===== src/app/api/opportunities/[id]/pursue/route.ts =====
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

    const newPursuedState = await cosmosService.toggleOpportunityPursued(params.id, userId, partitionDate);
    
    // Broadcast the update to all connected clients
    await pubSubClient.sendToAll({
      type: "OPPORTUNITY_UPDATE",
      opportunityId: params.id,
      action: newPursuedState ? "pursued" : "unpursued",
      userId,
      timestamp: new Date().toISOString(),
    });
    
    return Response.json({ 
      success: true,
      pursued: newPursuedState,
      message: newPursuedState ? 'Opportunity pursued' : 'Opportunity unpursued'
    });
    
  } catch (error) {
    console.error('Error in pursue route:', error);
    return Response.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}