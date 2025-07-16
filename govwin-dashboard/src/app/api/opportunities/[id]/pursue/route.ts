// app/api/opportunities/[id]/pursue/route.ts
import { NextRequest } from 'next/server';
import { cosmosService } from '@/lib/cosmos';

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { userId, partitionDate } = await request.json();
    
    if (!userId) {
      return Response.json(
        { error: 'userId is required' }, 
        { status: 400 }
      );
    }

    if (!partitionDate) {
      return Response.json(
        { error: 'partitionDate is required' }, 
        { status: 400 }
      );
    }

    const result = await cosmosService.toggleOpportunityPursued(params.id, userId, partitionDate);
    
    return Response.json({ 
      success: result,
      message: result ? 'Opportunity pursued/unpursued successfully' : 'Failed to update opportunity'
    });
    
  } catch (error) {
    console.error('Error in pursue route:', error);
    return Response.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}