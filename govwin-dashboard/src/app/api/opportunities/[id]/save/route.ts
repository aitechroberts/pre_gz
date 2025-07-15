// app/api/opportunities/[id]/save/route.ts
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

    const result = await cosmosService.toggleOpportunitySaved(params.id, userId, partitionDate);
    
    return Response.json({ 
      success: result,
      message: result ? 'Opportunity saved/unsaved successfully' : 'Failed to update opportunity'
    });
    
  } catch (error) {
    console.error('Error in save route:', error);
    return Response.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}