// app/api/opportunities/[id]/seen/route.ts
import { NextRequest } from 'next/server';
import { cosmosService } from '@/lib/cosmos';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    const result = await cosmosService.markOpportunitySeen(params.id, userId, partitionDate);
    
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