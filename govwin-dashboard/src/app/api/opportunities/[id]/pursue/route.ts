import { NextRequest, NextResponse } from 'next/server';
import { cosmosService } from '@/lib/cosmos';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await request.json();
    const { id } = await params;
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const isPursued = await cosmosService.toggleOpportunityPursued(id, userId);
    
    return NextResponse.json({
      success: true,
      data: { pursued: isPursued }
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to toggle opportunity pursued state',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}