import { NextRequest, NextResponse } from 'next/server';
import { cosmosService } from '@/lib/cosmos';
import { pubSubClient } from '@/lib/pubsub-server';

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const { id } = await context.params;          // ⬅️ await the params

  try {
    const { userId} = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId and partitionDate are required' },
        { status: 400 }
      );
    }

    const newSavedState = await cosmosService.toggleOpportunitySaved(
      id,
      userId
    );

    await pubSubClient.sendToAll({
      type: 'OPPORTUNITY_UPDATE',
      opportunityId: id,
      action: newSavedState ? 'saved' : 'unsaved',
      userId,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      saved: newSavedState,
      message: newSavedState ? 'Opportunity saved' : 'Opportunity unsaved',
    });
  } catch (error) {
    console.error('Error in save route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
