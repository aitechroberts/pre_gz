import { NextRequest, NextResponse } from 'next/server';
import { cosmosService } from '@/lib/cosmos';
import { pubSubClient } from '@/lib/pubsub-server';

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const { id } = await context.params;          // ⬅️ await the params

  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const success = await cosmosService.markOpportunitySeen(
      id,
      userId
    );

    if (success) {
      await pubSubClient.sendToAll({
        type: 'OPPORTUNITY_UPDATE',
        opportunityId: id,
        action: 'seen',
        userId,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success,
      message: success
        ? 'Opportunity marked as seen'
        : 'Failed to mark opportunity as seen',
    });
  } catch (error) {
    console.error('Error in seen route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
