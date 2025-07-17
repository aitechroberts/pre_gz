// ===== src/app/api/opportunities/[id]/archive/route.ts =====
import { NextRequest, NextResponse } from 'next/server';
import { cosmosService } from '@/lib/cosmos';
import { pubSubClient } from '@/lib/pubsub-server';

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { id } = await context.params;
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const newArchivedState = await cosmosService.toggleOpportunityArchived(id, userId);
    
    // Broadcast the update to all connected clients
    await pubSubClient.sendToAll({
      type: "OPPORTUNITY_UPDATE",
      opportunityId: id,
      action: newArchivedState ? "archived" : "unarchived",
      userId,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ 
      success: true,
      archived: newArchivedState,
      message: newArchivedState ? 'Opportunity archived' : 'Opportunity unarchived'
    });
    
  } catch (error) {
    console.error('Error in archive route:', error);
    return NextResponse.json(
      { error: "Internal server error", success: false },
      { status: 500 },
    );
  }
}