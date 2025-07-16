import { NextRequest, NextResponse } from 'next/server';
import { cosmosService } from '@/lib/cosmos';
import { pubSubClient } from '@/lib/pubsub-server';

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const { id } = await context.params;          // ⬅️ await the params

  try {
    const { userId, partitionDate } = await request.json();

    if (!userId || !partitionDate) {
      return NextResponse.json(
        { error: 'userId and partitionDate are required' },
        { status: 400 }
      );
    }

    const newPursuedState = await cosmosService.toggleOpportunityPursued(
      id,
      userId,
      partitionDate
    );

    await pubSubClient.sendToAll({
      type: 'OPPORTUNITY_UPDATE',
      opportunityId: id,
      action: newPursuedState ? 'pursued' : 'unpursued',
      userId,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      pursued: newPursuedState,
      message: newPursuedState
        ? 'Opportunity pursued'
        : 'Opportunity unpursued',
    });
  } catch (error) {
    console.error('Error in pursue route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
